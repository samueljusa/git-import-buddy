import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SUPPORTED_COUNTRIES, findCountry } from "@/lib/payments/countries";

export type PriceRow = {
  id: string;
  label: string;
  tier: string;
  amount_eur: number;
  amount_eur_yearly: number | null;
  active: boolean;
  sort_order: number;
};

export type BillingPeriod = "monthly" | "yearly";

/** Liste publique des offres et de leur prix en euros. */
export const listPrices = createServerFn({ method: "GET" }).handler(async (): Promise<PriceRow[]> => {
  const { publicSupabase } = await import("@/lib/payments/public-client.server");
  const { data } = await publicSupabase()
    .from("product_prices")
    .select("id, label, tier, amount_eur, amount_eur_yearly, active, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((row) => ({
    ...row,
    amount_eur: Number(row.amount_eur),
    amount_eur_yearly: row.amount_eur_yearly === null ? null : Number(row.amount_eur_yearly),
  }));
});

/** Pays SwyChr pris en charge. */
export const listCountries = createServerFn({ method: "GET" }).handler(async () => SUPPORTED_COUNTRIES);

/** Moyens de paiement disponibles pour un pays. */
export const listPaymentMethods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { countryCode: string }) =>
    z.object({ countryCode: z.string().length(2) }).parse(input),
  )
  .handler(async ({ data }) => {
    const country = findCountry(data.countryCode);
    if (!country) return { ok: false as const, message: "Pays non pris en charge." };

    const { fetchPayoutMethods } = await import("@/lib/services/swychr.server");
    const result = await fetchPayoutMethods(country.code);
    if (!result.ok) return { ok: false as const, message: result.message };
    return { ok: true as const, methods: result.data };
  });

/** Devis : conversion du prix EUR vers la devise locale du pays choisi. */
export const quotePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; countryCode: string; period?: string }) =>
    z
      .object({
        productId: z.string().min(1),
        countryCode: z.string().length(2),
        period: z.enum(["monthly", "yearly"]).default("monthly"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const country = findCountry(data.countryCode);
    if (!country) return { ok: false as const, message: "Pays non pris en charge." };

    const { data: price } = await context.supabase
      .from("product_prices")
      .select("id, label, tier, amount_eur, amount_eur_yearly")
      .eq("id", data.productId)
      .eq("active", true)
      .maybeSingle();
    if (!price) return { ok: false as const, message: "Offre introuvable." };

    const amountEur =
      data.period === "yearly" && price.amount_eur_yearly !== null
        ? Number(price.amount_eur_yearly)
        : Number(price.amount_eur);

    const { convertFromEur } = await import("@/lib/services/fx.server");
    const conv = await convertFromEur(amountEur, country.currency, country.zeroDecimal);
    if (!conv.ok) return { ok: false as const, message: conv.message };

    return {
      ok: true as const,
      label: price.label,
      period: data.period,
      amountEur,
      amountLocal: conv.amount,
      currency: country.currency,
      rate: conv.rate,
    };
  });

/** Crée la commande en base puis génère le lien de paiement SwyChr. */
export const startPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        productId: z.string().min(1).max(40),
        countryCode: z.string().length(2),
        paymentMethod: z.string().min(1).max(60),
        mobile: z.string().min(6).max(20),
        fullName: z.string().min(2).max(80),
        period: z.enum(["monthly", "yearly"]).default("monthly"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const country = findCountry(data.countryCode);
    if (!country) return { ok: false as const, message: "Pays non pris en charge." };

    // L'e-mail est toujours celui du compte connecté.
    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : null;
    if (!email) return { ok: false as const, message: "Adresse e-mail du compte introuvable." };

    const { data: price } = await context.supabase
      .from("product_prices")
      .select("id, label, tier, amount_eur, amount_eur_yearly")
      .eq("id", data.productId)
      .eq("active", true)
      .maybeSingle();
    if (!price) return { ok: false as const, message: "Offre introuvable." };

    const amountEur =
      data.period === "yearly" && price.amount_eur_yearly !== null
        ? Number(price.amount_eur_yearly)
        : Number(price.amount_eur);

    const mobile = data.mobile.replace(/[^0-9]/g, "");
    if (mobile.length < 8) return { ok: false as const, message: "Numéro de téléphone invalide." };

    const { convertFromEur } = await import("@/lib/services/fx.server");
    const conv = await convertFromEur(amountEur, country.currency, country.zeroDecimal);
    if (!conv.ok) return { ok: false as const, message: conv.message };

    const transactionId = crypto.randomUUID();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: insertError } = await supabaseAdmin.from("orders").insert({
      transaction_id: transactionId,
      user_id: context.userId,
      product_id: price.id,
      tier: price.tier,
      status: "en_attente",
      period: data.period,
      amount_eur: amountEur,
      amount_local: conv.amount,
      currency: country.currency,
      exchange_rate: conv.rate,
      country_code: country.code,
      payment_method: data.paymentMethod,
      mobile,
      customer_name: data.fullName,
      customer_email: email,
    });
    if (insertError) return { ok: false as const, message: "Impossible d'enregistrer la commande." };

    const { createPaymentLink } = await import("@/lib/services/swychr.server");
    const result = await createPaymentLink({
      countryCode: country.code,
      name: data.fullName,
      transactionId,
      amount: conv.amount,
      currency: country.currency,
      email,
      mobile,
      description: `Abonnement ${price.label} (${data.period === "yearly" ? "annuel" : "mensuel"}) — Sam flash 2.0`,
    });

    if (!result.ok) {
      await supabaseAdmin
        .from("orders")
        .update({ status: "echouee", error_message: result.message })
        .eq("transaction_id", transactionId);
      return { ok: false as const, message: result.message };
    }

    await supabaseAdmin
      .from("orders")
      .update({
        provider_response: result.data.raw as never,
        payment_link: result.data.paymentLink,
        provider_transaction_id: result.data.providerTransactionId,
      })
      .eq("transaction_id", transactionId);

    return {
      ok: true as const,
      transactionId,
      paymentLink: result.data.paymentLink,
      amountLocal: conv.amount,
      currency: country.currency,
    };
  });

/** Statut d'une commande : vérifié chez le prestataire puis renvoyé au client. */
export const getOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transactionId: string }) =>
    z.object({ transactionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const PAID = ["paid", "success", "successful", "succeeded", "completed", "complete", "settled"];
    const FAILED = ["failed", "failure", "cancelled", "canceled", "expired", "declined", "rejected"];

    const { data: order } = await context.supabase
      .from("orders")
      .select(
        "transaction_id, provider_transaction_id, status, amount_local, currency, provider_message, error_message, tier, payment_link",
      )
      .eq("transaction_id", data.transactionId)
      .maybeSingle();
    if (!order) return { ok: false as const, message: "Commande introuvable." };

    if (order.status !== "en_attente") return { ok: true as const, order };

    const { fetchPaymentLinkStatus } = await import("@/lib/services/swychr.server");
    const remote = await fetchPaymentLinkStatus(order.provider_transaction_id ?? order.transaction_id);
    if (!remote.ok || !remote.data.status) return { ok: true as const, order };


    const normalized = remote.data.status?.toLowerCase() ?? "";
    let next: "payee" | "echouee" | null = null;
    if (PAID.includes(normalized)) next = "payee";
    else if (FAILED.includes(normalized)) next = "echouee";
    if (!next) return { ok: true as const, order };

    const { applyOrderOutcome } = await import("@/lib/payments/webhook.server");
    await applyOrderOutcome(order.transaction_id, next, remote.data.status, remote.data.raw);

    return {
      ok: true as const,
      order: { ...order, status: next, provider_message: remote.data.status },
    };
  });


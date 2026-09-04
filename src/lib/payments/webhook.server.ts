import { z } from "zod";
import { verifyCallbackToken } from "@/lib/payments/token.server";

const payloadSchema = z
  .object({
    transaction_id: z.string().uuid().optional(),
    transactionId: z.string().uuid().optional(),
    message: z.string().max(500).optional(),
    status: z.string().max(60).optional(),
  })
  .passthrough();

const SUBSCRIPTION_DAYS = 30;

/**
 * Applique le résultat d'un paiement à une commande : met à jour son statut et,
 * en cas de succès, active l'abonnement 30 jours. Idempotent.
 */
export async function applyOrderOutcome(
  transactionId: string,
  outcome: "payee" | "echouee",
  providerMessage: string | null,
  payload: Record<string, unknown>,
): Promise<"ok" | "introuvable"> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, tier, status, period")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (!order) return "introuvable";
  if (order.status !== "en_attente") return "ok";

  await supabaseAdmin
    .from("orders")
    .update({
      status: outcome,
      provider_message: providerMessage,
      webhook_payload: payload as never,
      last_checked_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (outcome === "payee" && order.user_id) {
    const days = order.period === "yearly" ? 365 : SUBSCRIPTION_DAYS;
    const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", order.user_id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("subscriptions")
        .update({
          tier: order.tier,
          status: "active",
          started_at: new Date().toISOString(),
          ends_at: endsAt,
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("subscriptions").insert({
        user_id: order.user_id,
        tier: order.tier,
        status: "active",
        ends_at: endsAt,
      });
    }
  }

  return "ok";
}


/**
 * Traite les callbacks SwyChr. L'appelant est authentifié par un jeton HMAC
 * dérivé de la clé API serveur et transmis dans l'URL de callback.
 */
export async function handlePaymentWebhook(
  request: Request,
  outcome: "payee" | "echouee",
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  let body: Record<string, unknown> = {};
  if (request.method === "POST") {
    const raw = await request.text();
    if (raw) {
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return new Response("Payload invalide", { status: 400 });
      }
    }
  }

  const parsed = payloadSchema.safeParse({
    ...body,
    transaction_id:
      (body["transaction_id"] as string | undefined) ??
      url.searchParams.get("transaction_id") ??
      undefined,
  });
  if (!parsed.success) return new Response("Payload invalide", { status: 400 });

  const transactionId = parsed.data.transaction_id ?? parsed.data.transactionId;
  if (!transactionId) return new Response("transaction_id manquant", { status: 400 });
  if (!verifyCallbackToken(transactionId, token)) {
    return new Response("Signature invalide", { status: 401 });
  }

  const result = await applyOrderOutcome(
    transactionId,
    outcome,
    parsed.data.message ?? parsed.data.status ?? null,
    body,
  );
  if (result === "introuvable") return new Response("Commande introuvable", { status: 404 });

  return new Response("ok");
}


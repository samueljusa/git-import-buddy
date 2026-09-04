import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminStats = {
  users: number;
  generations: number;
  generationsToday: number;
  errors: number;
  pendingModeration: number;
  activeSubscriptions: number;
  secondsToday: number;
};

export type AdminGeneration = {
  id: string;
  prompt: string;
  media_type: string;
  status: string;
  media_url: string | null;
  error_message: string | null;
  duration_seconds: number;
  created_at: string;
};

/** Vérifie le rôle admin via le client authentifié (RLS), jamais via le service role. */
async function assertAdmin(context: {
  supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null; error: unknown }> };
  userId: string;
}) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Accès refusé");
}


export type StaffRole = "admin" | "moderator" | "support" | "finance" | "user";

/** Rôles de l'utilisateur connecté (utilisé pour afficher le bureau d'administration). */
export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as StaffRole);
    return {
      isAdmin: roles.includes("admin"),
      roles,
      isStaff: roles.some((r) => r !== "user"),
    };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);

    const [profiles, generations, todayGen, errors, pending, subs, usage] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("generations").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("generations")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00Z`),
      supabaseAdmin
        .from("generations")
        .select("id", { count: "exact", head: true })
        .eq("status", "error"),
      supabaseAdmin
        .from("community_gallery")
        .select("id", { count: "exact", head: true })
        .eq("status", "en_attente"),
      supabaseAdmin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabaseAdmin.from("daily_usage").select("seconds_used").eq("usage_date", today),
    ]);

    const stats: AdminStats = {
      users: profiles.count ?? 0,
      generations: generations.count ?? 0,
      generationsToday: todayGen.count ?? 0,
      errors: errors.count ?? 0,
      pendingModeration: pending.count ?? 0,
      activeSubscriptions: subs.count ?? 0,
      secondsToday: (usage.data ?? []).reduce((sum, r) => sum + (r.seconds_used ?? 0), 0),
    };
    return stats;
  });

export const listRecentGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("generations")
      .select(
        "id, prompt, media_type, status, media_url, error_message, duration_seconds, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(40);
    return (data ?? []) as AdminGeneration[];
  });


/** Générations en échec (OpenRouter / Grok Imagine), pour re-traitement. */
export const listFailedGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("generations")
      .select(
        "id, user_id, prompt, media_type, resolution, duration, aspect_ratio, status, media_url, error_message, duration_seconds, created_at",
      )
      .eq("status", "error")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });


/** Relance une génération en échec pour le compte de son propriétaire. */
export const retryGenerationAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Identifiant manquant");
    return { id: String(input.id) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("generations")
      .select("user_id, prompt, media_type, resolution, duration, aspect_ratio")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Génération introuvable");

    const { runGeneration } = await import("@/lib/services/generation.server");
    return await runGeneration(row.user_id, {
      prompt: row.prompt,
      mediaType: row.media_type === "image" ? "image" : "video",
      resolution: row.resolution ?? "720p",
      duration: row.duration ?? "6s",
      aspectRatio: row.aspect_ratio ?? "2:3",
    });
  });

export type AdminPrice = {
  id: string;
  label: string;
  tier: string;
  amount_eur: number;
  amount_eur_yearly: number | null;
  active: boolean;
  sort_order: number;
};

/** Liste des offres et de leur prix EUR (admin ou finance). */
export const listAdminPrices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPrice[]> => {
    const { data } = await context.supabase
      .from("product_prices")
      .select("id, label, tier, amount_eur, amount_eur_yearly, active, sort_order")
      .order("sort_order", { ascending: true });
    return (data ?? []).map((row) => ({
      ...row,
      amount_eur: Number(row.amount_eur),
      amount_eur_yearly: row.amount_eur_yearly === null ? null : Number(row.amount_eur_yearly),
    }));
  });

/** Met à jour les prix EUR et l'état d'une offre (admin ou finance via RLS). */
export const updateAdminPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    amountEur: number;
    amountEurYearly: number | null;
    active: boolean;
  }) => {
    if (typeof input?.id !== "string" || input.id.length === 0) throw new Error("Offre invalide");
    const amount = Number(input.amountEur);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000) throw new Error("Montant invalide");
    let yearly: number | null = null;
    if (input.amountEurYearly !== null && input.amountEurYearly !== undefined) {
      const y = Number(input.amountEurYearly);
      if (!Number.isFinite(y) || y < 0 || y > 1000000) throw new Error("Montant annuel invalide");
      yearly = Math.round(y * 100) / 100;
    }
    return {
      id: input.id,
      amountEur: Math.round(amount * 100) / 100,
      amountEurYearly: yearly,
      active: Boolean(input.active),
    };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_prices")
      .update({
        amount_eur: data.amountEur,
        amount_eur_yearly: data.amountEurYearly,
        active: data.active,
      })
      .eq("id", data.id);
    if (error) return { ok: false as const, message: "Mise à jour impossible." };
    return { ok: true as const };
  });

export type AdminOrder = {
  transaction_id: string;
  status: string;
  amount_eur: number;
  amount_local: number;
  currency: string;
  country_code: string;
  payment_method: string;
  customer_email: string;
  created_at: string;
};

/** Dernières commandes de paiement (admin). */
export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOrder[]> => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("orders")
      .select(
        "transaction_id, status, amount_eur, amount_local, currency, country_code, payment_method, customer_email, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25);
    return (data ?? []).map((row) => ({
      ...row,
      amount_eur: Number(row.amount_eur),
      amount_local: Number(row.amount_local),
    }));
  });

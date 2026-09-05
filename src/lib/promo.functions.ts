import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type PromoSettings = {
  enabled: boolean;
  prices: Record<string, number | null>;
};

const SETTINGS_ID = "global";
/** Durée de l'offre de lancement, en jours. */
export const PROMO_DAYS = 2;

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Réglages publics de l'offre promotionnelle de lancement. */
export const getPromoSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<PromoSettings> => {
    const { data } = await publicClient()
      .from("app_settings")
      .select("promo_enabled, promo_prices")
      .eq("id", SETTINGS_ID)
      .maybeSingle();
    return {
      enabled: Boolean(data?.promo_enabled),
      prices: (data?.promo_prices ?? {}) as Record<string, number | null>,
    };
  },
);

/** État de l'offre pour l'utilisateur connecté (déjà utilisée ou non). */
export const getMyPromoState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("promo_claimed_at")
      .eq("id", context.userId)
      .maybeSingle();
    return { claimed: Boolean(data?.promo_claimed_at) };
  });

/**
 * Active l'offre de lancement (Super Grok offert 2 jours) pour l'utilisateur
 * connecté, une seule fois par compte.
 */
export const activatePromoOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("promo_enabled")
      .eq("id", SETTINGS_ID)
      .maybeSingle();

    if (!settings?.promo_enabled) {
      return { ok: false as const, message: "L'offre de lancement n'est pas active." };
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("promo_claimed_at")
      .eq("id", context.userId)
      .maybeSingle();

    if (profile?.promo_claimed_at) {
      return { ok: false as const, message: "Offre déjà utilisée sur ce compte." };
    }

    const endsAt = new Date(Date.now() + PROMO_DAYS * 24 * 60 * 60 * 1000).toISOString();


    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({
          tier: "super_grok",
          plan_type: "super_grok_monthly",
          status: "active",
          is_active: true,
          started_at: new Date().toISOString(),
          ends_at: endsAt,
          auto_renew: false,
        })
        .eq("id", existing.id);
      if (error) return { ok: false as const, message: "Activation impossible pour le moment." };
    } else {
      const { error } = await supabaseAdmin.from("subscriptions").insert({
        user_id: context.userId,
        tier: "super_grok",
        plan_type: "super_grok_monthly",
        status: "active",
        is_active: true,
        ends_at: endsAt,
        auto_renew: false,
      });
      if (error) return { ok: false as const, message: "Activation impossible pour le moment." };
    }

    await supabaseAdmin
      .from("profiles")
      .update({ promo_claimed_at: new Date().toISOString() })
      .eq("id", context.userId);

    return { ok: true as const, endsAt };

  });

/** Active / désactive l'offre de lancement et ses prix (administrateur). */
export const setPromoSettings = createServerFn({ method: "POST" })
  .inputValidator((input: { enabled: boolean; prices?: Record<string, number | null> }) => ({
    enabled: Boolean(input?.enabled),
    prices: (input?.prices ?? {}) as Record<string, number | null>,
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Accès refusé");

    const { error } = await context.supabase
      .from("app_settings")
      .update({ promo_enabled: data.enabled, promo_prices: data.prices })
      .eq("id", SETTINGS_ID);
    if (error) return { ok: false as const, message: "Enregistrement impossible." };
    return { ok: true as const };
  });

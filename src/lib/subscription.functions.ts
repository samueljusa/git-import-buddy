import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_LABEL, toPlanType, type PlanType } from "@/lib/plans";

export type MyPlan = {
  planType: PlanType;
  label: string;
  isActive: boolean;
  expiresAt: string | null;
};

/**
 * Formule active de l'utilisateur connecté : uniquement le badge et l'échéance.
 * Les décomptes en secondes restent gérés côté serveur.
 */
export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPlan> => {
    const { data } = await context.supabase
      .from("subscriptions")
      .select("tier, plan_type, status, is_active, ends_at")
      .eq("user_id", context.userId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const active =
      !!data &&
      data.status === "active" &&
      data.is_active !== false &&
      (!data.ends_at || new Date(data.ends_at) > new Date());

    const planType = active ? toPlanType(data.plan_type ?? data.tier) : "free";
    return {
      planType,
      label: PLAN_LABEL[planType],
      isActive: active,
      expiresAt: active ? (data?.ends_at ?? null) : null,
    };
  });

/**
 * Formules d'abonnement et limites de génération vidéo.
 * Les limites sont exprimées en secondes et appliquées côté serveur uniquement.
 */

export type PlanType =
  | "free"
  | "super_grok_monthly"
  | "superhearly_monthly"
  | "super_grok_annuel"
  | "super_grok_plus";

/** Limite quotidienne (période glissante de 24 h) en secondes de vidéo. */
export const PLAN_VIDEO_SECONDS: Record<PlanType, number> = {
  free: 30,
  super_grok_monthly: 190, // 3 min 10 s
  superhearly_monthly: 380, // 6 min 20 s
  super_grok_annuel: 950, // 15 min 50 s
  super_grok_plus: 1900, // 31 min 40 s
};

/** Durée de l'abonnement en mois. */
export const PLAN_MONTHS: Record<PlanType, number> = {
  free: 0,
  super_grok_monthly: 1,
  superhearly_monthly: 1,
  super_grok_annuel: 12,
  super_grok_plus: 1,
};

export const PLAN_LABEL: Record<PlanType, string> = {
  free: "Découverte",
  super_grok_monthly: "Super Grok",
  superhearly_monthly: "Superhearly",
  super_grok_annuel: "Super Grok Annuel",
  super_grok_plus: "Super Grok Plus",
};

/** Déduit la formule à partir de l'offre choisie et de la périodicité. */
export function planTypeFor(productId: string, period: "monthly" | "yearly"): PlanType {
  if (productId === "plus") return "super_grok_plus";
  if (productId === "heavy") return "superhearly_monthly";
  return period === "yearly" ? "super_grok_annuel" : "super_grok_monthly";
}

/** Normalise une valeur venue de la base en formule connue. */
export function toPlanType(value: string | null | undefined): PlanType {
  if (value && value in PLAN_VIDEO_SECONDS) return value as PlanType;
  if (value === "super_grok") return "super_grok_monthly";
  if (value === "superhearly") return "superhearly_monthly";
  return "free";
}

/** Date d'échéance d'un abonnement démarré maintenant. */
export function expiryFor(plan: PlanType, from = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + (PLAN_MONTHS[plan] || 1));
  return d.toISOString();
}

/** Rendu lisible d'une durée en secondes (ex. « 3 min 10 s »). */
export function formatDuration(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} h`);
  if (m > 0) parts.push(`${m} min`);
  if (s > 0 || parts.length === 0) parts.push(`${s} s`);
  return parts.join(" ");
}

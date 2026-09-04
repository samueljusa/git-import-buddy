export type Tier = "free" | "super_grok" | "superhearly";

export const TIER_DAILY_SECONDS: Record<Tier, number> = {
  free: 30,
  super_grok: 190,
  superhearly: 380,
};

export const TIER_LABEL: Record<Tier, string> = {
  free: "Découverte",
  super_grok: "Super Grok",
  superhearly: "Superhearly",
};

export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}min${String(s).padStart(2, "0")}`;
}

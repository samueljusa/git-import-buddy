/**
 * Conversion EUR → devise locale (serveur uniquement).
 * Le taux est mis en cache 6 heures pour éviter des appels excessifs.
 */

type RateCache = { rates: Record<string, number>; fetchedAt: number };

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cache: RateCache | null = null;

async function loadRates(): Promise<Record<string, number> | null> {
  const key = process.env["EXCHANGERATE_API_KEY"];
  const url = key
    ? `https://v6.exchangerate-api.com/v6/${key}/latest/EUR`
    : "https://open.er-api.com/v6/latest/EUR";

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    const rates = (json["conversion_rates"] ?? json["rates"]) as
      | Record<string, number>
      | undefined;
    if (!rates || typeof rates !== "object") return null;
    return rates;
  } catch {
    return null;
  }
}

export type ConversionResult =
  | { ok: true; rate: number; amount: number; cached: boolean }
  | { ok: false; message: string };

/** Convertit un montant EUR vers `currency`, avec arrondi adapté à la devise. */
export async function convertFromEur(
  amountEur: number,
  currency: string,
  zeroDecimal: boolean,
): Promise<ConversionResult> {
  const fresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (!fresh) {
    const rates = await loadRates();
    if (rates) cache = { rates, fetchedAt: Date.now() };
  }

  if (!cache) {
    return { ok: false, message: "Taux de change indisponible pour le moment." };
  }

  const rate = cache.rates[currency.toUpperCase()];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return { ok: false, message: `Taux de change introuvable pour ${currency}.` };
  }

  const raw = amountEur * rate;
  const amount = zeroDecimal ? Math.ceil(raw) : Math.round(raw * 100) / 100;

  return { ok: true, rate, amount, cached: Boolean(fresh) };
}

/**
 * Pays africains pris en charge par SwyChr / AccountPe (18 pays)
 * et devise locale associée. Module client-safe (aucun secret).
 */
export type SupportedCountry = {
  code: string;
  name: string;
  currency: string;
  /** Devises sans sous-unité : le montant envoyé doit être entier. */
  zeroDecimal: boolean;
};

export const SUPPORTED_COUNTRIES: SupportedCountry[] = [
  { code: "BJ", name: "Bénin", currency: "XOF", zeroDecimal: true },
  { code: "BF", name: "Burkina Faso", currency: "XOF", zeroDecimal: true },
  { code: "CM", name: "Cameroun", currency: "XAF", zeroDecimal: true },
  { code: "CF", name: "République centrafricaine", currency: "XAF", zeroDecimal: true },
  { code: "TD", name: "Tchad", currency: "XAF", zeroDecimal: true },
  { code: "CG", name: "Congo-Brazzaville", currency: "XAF", zeroDecimal: true },
  { code: "CD", name: "République démocratique du Congo", currency: "CDF", zeroDecimal: true },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", zeroDecimal: true },
  { code: "GA", name: "Gabon", currency: "XAF", zeroDecimal: true },
  { code: "GH", name: "Ghana", currency: "GHS", zeroDecimal: false },
  { code: "GN", name: "Guinée", currency: "GNF", zeroDecimal: true },
  { code: "KE", name: "Kenya", currency: "KES", zeroDecimal: false },
  { code: "ML", name: "Mali", currency: "XOF", zeroDecimal: true },
  { code: "NE", name: "Niger", currency: "XOF", zeroDecimal: true },
  { code: "NG", name: "Nigeria", currency: "NGN", zeroDecimal: false },
  { code: "RW", name: "Rwanda", currency: "RWF", zeroDecimal: true },
  { code: "SN", name: "Sénégal", currency: "XOF", zeroDecimal: true },
  { code: "TG", name: "Togo", currency: "XOF", zeroDecimal: true },
];

export function findCountry(code: string): SupportedCountry | undefined {
  return SUPPORTED_COUNTRIES.find((c) => c.code === code.toUpperCase());
}

export function formatLocalAmount(amount: number, currency: string): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(amount)} ${currency}`;
}

/**
 * Préfixes réels par opérateur, quand l'API renvoie un format générique
 * identique pour tous les opérateurs d'un pays (cas de la RDC).
 */
const OPERATOR_PREFIXES: Record<string, { match: string[]; prefixes: string[] }[]> = {
  CD: [
    { match: ["airtel"], prefixes: ["99", "97"] },
    { match: ["vodacom", "mpesa", "m-pesa"], prefixes: ["81", "82", "83"] },
    { match: ["orange"], prefixes: ["84", "85", "89"] },
    { match: ["africell"], prefixes: ["90"] },
  ],
};

/** Préfixes attendus pour un opérateur donné, ou `null` si non spécifié. */
export function operatorPrefixes(countryCode: string, methodLabel: string): string[] | null {
  const rules = OPERATOR_PREFIXES[countryCode.toUpperCase()];
  if (!rules) return null;
  const label = methodLabel.toLowerCase();
  const rule = rules.find((r) => r.match.some((m) => label.includes(m)));
  return rule ? rule.prefixes : null;
}


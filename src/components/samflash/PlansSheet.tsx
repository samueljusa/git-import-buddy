import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listPrices, type PriceRow } from "@/lib/payments.functions";
import { activatePromoOffer, getPromoSettings, PROMO_DAYS } from "@/lib/promo.functions";
import { toast } from "@/lib/toast";
import { CheckoutSheet } from "@/components/samflash/CheckoutSheet";
import {
  X,
  Zap,
  Sparkles,
  Rocket,
  FolderPlus,
  MonitorPlay,
  Brain,
  Infinity as InfinityIcon,
  Check,
} from "lucide-react";
import nightSky from "@/assets/night-sky.jpg";

type PlanId = "base" | "plus" | "heavy";

type Plan = {
  id: PlanId;
  label: string;
  badge?: string;
  tagline: React.ReactNode;
  features: { icon: React.ElementType; title: string; sub?: string }[];
  monthly: string;
  monthlyNote?: string;
  yearly?: { price: string; perMonth: string };
  cta: string;
  footnote: string;
};

const PLANS: Plan[] = [
  {
    id: "base",
    label: "Super grok",
    tagline: <>Créez sans limite avec Super grok</>,
    features: [
      {
        icon: Sparkles,
        title: "Créez des images et des vidéos IA époustouflantes",
        sub: "Avec des vidéos HD 720p de 6 secondes",
      },
      { icon: FolderPlus, title: "Importez plus de fichiers pour des réponses plus pertinentes" },
      { icon: Zap, title: "Des réponses fulgurantes" },
    ],
    monthly: "35 € /mois",
    yearly: { price: "349 € /an", perMonth: "29,08 € /mois" },
    cta: "Passer à Super grok",
    footnote: "Facturation mensuelle, annulez à tout moment",
  },
  {
    id: "plus",
    label: "Super grok plus",
    tagline: <>Plus de créations, plus de puissance</>,
    features: [
      { icon: Check, title: "Tout dans Super grok" },
      { icon: MonitorPlay, title: "Vidéo 1080p en création" },
      { icon: Rocket, title: "Générations prioritaires" },
      { icon: InfinityIcon, title: "Crédits mensuels étendus" },
    ],
    monthly: "79 € /mois",
    cta: "Passer à Super grok plus",
    footnote: "Facturation mensuelle, annulez à tout moment",
  },
  {
    id: "heavy",
    label: "Super grok heavy",
    badge: "Heavy",
    tagline: <>La version la plus puissante de Sam flash</>,
    features: [
      { icon: Check, title: "Tout dans Super grok plus" },
      { icon: MonitorPlay, title: "Vidéo native 1080p en création" },
      { icon: Rocket, title: "Utilisation la plus élevée à la vitesse la plus rapide" },
      { icon: Brain, title: "Résolution des problèmes les plus complexes" },
      { icon: Sparkles, title: "Accès anticipé aux nouveaux modèles" },
    ],
    monthly: "349 € /mois",
    cta: "Passer à Super grok heavy",
    footnote: "Facturation mensuelle, annulez à tout moment",
  },
];


export function PlansSheet({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState<PlanId>("base");
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [notice] = useState<string | null>(null);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [promo, setPromo] = useState<{ enabled: boolean; prices: Record<string, number | null> }>({
    enabled: false,
    prices: {},
  });
  const [activating, setActivating] = useState(false);
  const fetchPrices = useServerFn(listPrices);
  const fetchPromo = useServerFn(getPromoSettings);
  const activatePromo = useServerFn(activatePromoOffer);
  const plan = PLANS.find((p) => p.id === active)!;
  const price = prices.find((p) => p.id === active);

  useEffect(() => {
    setPeriod("monthly");
  }, [active]);

  useEffect(() => {
    fetchPrices({})
      .then((rows) => setPrices(rows as PriceRow[]))
      .catch(() => setPrices([]));
  }, [fetchPrices]);

  useEffect(() => {
    fetchPromo({})
      .then((p) => setPromo(p))
      .catch(() => setPromo({ enabled: false, prices: {} }));
  }, [fetchPromo]);

  const promoAmount = promo.enabled ? (promo.prices[active] ?? null) : null;
  const promoFree = promo.enabled && promoAmount === 0;

  const claimPromo = async () => {
    setActivating(true);
    try {
      const result = await activatePromo({});
      if (result.ok) {
        toast.success(`Offre de lancement activée : Super grok vous est offert ${PROMO_DAYS} jours.`);
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation impossible.");
    } finally {
      setActivating(false);
    }
  };

  const basePriceLabel = price ? `${price.amount_eur.toFixed(2)} € /mois` : plan.monthly;
  const monthlyLabel =
    promoAmount !== null
      ? promoAmount === 0
        ? "GRATUIT"
        : `${promoAmount.toFixed(2)} € /mois`
      : basePriceLabel;
  const yearlyAmount = price?.amount_eur_yearly ?? null;
  const yearlyLabel = yearlyAmount !== null ? `${yearlyAmount.toFixed(2)} € /an` : plan.yearly?.price;
  const yearlyPerMonth =
    yearlyAmount !== null
      ? `${(yearlyAmount / 12).toFixed(2)} € /mois`
      : plan.yearly?.perMonth;
  const hasYearly = yearlyAmount !== null || Boolean(plan.yearly);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-70"
        style={{
          backgroundImage: `linear-gradient(to bottom, transparent, var(--background)), url(${nightSky})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div className="relative flex flex-1 flex-col px-5 pb-10 pt-4">
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="mt-2 text-center">
          <h2 className="inline-flex items-center gap-3 text-4xl font-semibold tracking-tight">
            Sam flash
            {plan.badge && (
              <span className="rounded-xl bg-secondary px-3 py-1 text-lg font-medium">
                {plan.badge}
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm font-medium text-primary/90">powered by xia grok</p>
          <p className="mt-2 text-xl font-medium text-foreground/90">{plan.tagline}</p>
        </div>


        <div className="mx-auto mt-6 flex w-full max-w-sm rounded-full border border-border bg-secondary/40 p-1 backdrop-blur-xl">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(p.id)}
              className={`flex-1 rounded-full py-2.5 text-[15px] font-medium transition-colors ${
                active === p.id
                  ? "bg-secondary text-foreground shadow-[var(--shadow-glow)]"
                  : "text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-5 rounded-3xl border border-border bg-card/50 p-5 backdrop-blur-xl">
          {plan.features.map((f) => (
            <div key={f.title} className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                <f.icon className="h-5 w-5 text-foreground" />
              </span>
              <span>
                <span className="block text-[17px] font-medium leading-snug">{f.title}</span>
                {f.sub && (
                  <span className="mt-1 block text-sm text-muted-foreground">{f.sub}</span>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6">
          {hasYearly ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPeriod("monthly")}
                className={`rounded-2xl border p-4 text-left ${
                  period === "monthly" ? "border-primary bg-secondary/60" : "border-border bg-card/40"
                }`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">Mensuel</span>
                  {promoAmount !== null ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary-foreground">
                      Promo lancement
                    </span>
                  ) : (
                    plan.monthlyNote && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                        {plan.monthlyNote}
                      </span>
                    )
                  )}
                </span>
                {promoAmount !== null && (
                  <span className="mt-2 block text-sm text-muted-foreground line-through">
                    {basePriceLabel}
                  </span>
                )}
                <span
                  className={`block font-semibold ${
                    promoFree ? "text-3xl text-primary" : "mt-2 text-2xl"
                  }`}
                >
                  {monthlyLabel}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPeriod("yearly")}
                className={`rounded-2xl border p-4 text-left ${
                  period === "yearly" ? "border-primary bg-secondary/60" : "border-border bg-card/40"
                }`}
              >
                <span className="text-muted-foreground">Annuel</span>
                <span className="mt-2 block text-2xl font-semibold">{yearlyLabel}</span>
                <span className="block text-sm text-muted-foreground">{yearlyPerMonth}</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card/40 p-4">
              <span className="text-muted-foreground">Mensuel</span>
              <span className="mt-1 block text-3xl font-semibold">{monthlyLabel}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={activating}
          onClick={() => (promoFree ? void claimPromo() : setCheckoutOpen(true))}
          className="mt-6 w-full rounded-full bg-foreground py-4 text-[17px] font-semibold text-background transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {activating
            ? "Activation…"
            : promoFree
              ? "Activer l'offre de lancement (offerte)"
              : plan.cta}
        </button>

        {checkoutOpen && (
          <CheckoutSheet
            productId={active}
            productLabel={price?.label ?? plan.label}
            period={period}
            onClose={() => setCheckoutOpen(false)}
          />
        )}

        <p className="mt-3 text-center text-sm text-muted-foreground">
          {promoFree
            ? `Offre de lancement : ${PROMO_DAYS} jours offerts, sans paiement.`
            : plan.footnote}
        </p>
        {notice && <p className="mt-2 text-center text-sm text-primary">{notice}</p>}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Conditions d'utilisation · Politique de confidentialité · Restaurer les achats
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          sam flash 2.0 powered by xia Grok
        </p>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { activatePromoOffer, getPromoSettings, PROMO_DAYS } from "@/lib/promo.functions";
import { toast } from "@/lib/toast";

type Sub = { tier: string; status: string; ends_at: string | null; auto_renew: boolean | null };

function remaining(endsAt: string): { expired: boolean; label: string } {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return { expired: true, label: "" };
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    expired: false,
    label: days > 0 ? `${days} j ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`,
  };
}

/** Bandeau de l'offre de lancement : compteur restant, réactivable après expiration. */
export function PromoBanner({ enabled }: { enabled: boolean }) {
  const [promoOn, setPromoOn] = useState(false);
  const [sub, setSub] = useState<Sub | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const fetchPromo = useServerFn(getPromoSettings);
  const activate = useServerFn(activatePromoOffer);

  const loadSub = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("tier, status, ends_at, auto_renew")
        .maybeSingle();
      setSub((data as Sub | null) ?? null);
    } catch {
      setSub(null);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchPromo({})
      .then((p) => setPromoOn(p.enabled))
      .catch(() => setPromoOn(false));
    void loadSub();
  }, [enabled, fetchPromo, loadSub]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!enabled || !promoOn) return null;

  const active =
    sub?.status === "active" && sub.ends_at ? remaining(sub.ends_at) : { expired: true, label: "" };
  void now;

  const claim = async () => {
    setBusy(true);
    try {
      const result = await activate({});
      if (result.ok) {
        toast.success(`Offre activée : Super grok offert ${PROMO_DAYS} jours.`);
        await loadSub();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Activation impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 backdrop-blur-xl">
      {active.expired ? (
        <>
          <Gift className="h-5 w-5 shrink-0 text-primary" />
          <p className="min-w-0 text-sm">
            <span className="font-semibold">Offre de lancement</span> — Super grok offert{" "}
            {PROMO_DAYS} jours.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void claim()}
            className="ml-auto shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Activation…" : "Activer"}
          </button>
        </>
      ) : (
        <>
          <Timer className="h-5 w-5 shrink-0 text-primary" />
          <p className="min-w-0 text-sm">
            <span className="font-semibold">Offre active</span> — temps restant{" "}
            <span className="font-mono tabular-nums">{active.label}</span>
          </p>
        </>
      )}
    </div>
  );
}

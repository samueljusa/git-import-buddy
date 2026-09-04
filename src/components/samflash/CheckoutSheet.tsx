import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, CreditCard, Loader2, Smartphone, X, AlertTriangle } from "lucide-react";
import {
  listPaymentMethods,
  quotePrice,
  startPayment,
  getOrderStatus,
} from "@/lib/payments.functions";
import { SUPPORTED_COUNTRIES, formatLocalAmount, operatorPrefixes } from "@/lib/payments/countries";
import { useAuth } from "@/hooks/useAuth";

type Step = "mode" | "country" | "method" | "details" | "card" | "waiting" | "done" | "failed";

type Method = {
  code: string;
  label: string;
  mobileFormat: string | null;
  length: number | null;
  prefix: string | null;
};

export function CheckoutSheet({
  productId,
  productLabel,
  period = "monthly",
  onClose,
}: {
  productId: string;
  productLabel: string;
  period?: "monthly" | "yearly";
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const fetchMethods = useServerFn(listPaymentMethods);
  const fetchQuote = useServerFn(quotePrice);
  const pay = useServerFn(startPayment);
  const fetchStatus = useServerFn(getOrderStatus);

  const [step, setStep] = useState<Step>("mode");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [country, setCountry] = useState<string>("");
  const [methods, setMethods] = useState<Method[]>([]);
  const [method, setMethod] = useState<Method | null>(null);
  const [mobile, setMobile] = useState("");
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const email = profile?.email ?? user?.email ?? "";
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  const [quote, setQuote] = useState<{ amountLocal: number; currency: string; amountEur: number } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const selectedCountry = useMemo(
    () => SUPPORTED_COUNTRIES.find((c) => c.code === country) ?? null,
    [country],
  );

  const chooseCountry = useCallback(
    async (code: string) => {
      setCountry(code);
      setError(null);
      setBusy(true);
      setStep("method");
      try {
        const [m, q] = await Promise.all([
          fetchMethods({ data: { countryCode: code } }),
          fetchQuote({ data: { productId, countryCode: code, period } }),
        ]);
        if (m.ok) setMethods(m.methods);
        else setError(m.message);
        if (q.ok) setQuote({ amountLocal: q.amountLocal, currency: q.currency, amountEur: q.amountEur });
        else setError((prev) => prev ?? q.message);
      } catch {
        setError("Impossible de charger les moyens de paiement.");
      } finally {
        setBusy(false);
      }
    },
    [fetchMethods, fetchQuote, productId, period],
  );

  /** Préfixes réels attendus pour l'opérateur choisi (ex. Airtel RDC : 99/97). */
  const prefixes = useMemo(
    () => (selectedCountry && method ? operatorPrefixes(selectedCountry.code, method.label) : null),
    [selectedCountry, method],
  );

  const mobileValid = useMemo(() => {
    const digits = mobile.replace(/\D/g, "");
    if (digits.length < 8) return false;
    if (method?.length && digits.length !== method.length) return false;
    if (prefixes && prefixes.length > 0 && !prefixes.some((p) => digits.startsWith(p))) return false;
    return true;
  }, [mobile, method, prefixes]);

  const submit = useCallback(async () => {
    if (!method || !selectedCountry) return;
    setBusy(true);
    setError(null);
    try {
      const res = await pay({
        data: {
          productId,
          countryCode: selectedCountry.code,
          paymentMethod: method.code,
          mobile: mobile.replace(/\D/g, ""),
          fullName: fullName.trim(),
          period,
        },
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setTransactionId(res.transactionId);
      setPaymentLink(res.paymentLink);
      setStep("waiting");
      window.open(res.paymentLink, "_blank", "noopener,noreferrer");
    } catch {
      setError("Paiement impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  }, [method, selectedCountry, pay, productId, mobile, fullName]);


  useEffect(() => {
    if (step !== "waiting" || !transactionId) return;
    let stopped = false;

    const tick = async () => {
      try {
        const res = await fetchStatus({ data: { transactionId } });
        if (stopped || !res.ok) return;
        setStatusMessage(res.order.provider_message ?? null);
        if (res.order.status === "payee") setStep("done");
        else if (res.order.status === "echouee") {
          setError(res.order.error_message ?? res.order.provider_message ?? "Paiement refusé.");
          setStep("failed");
        }
      } catch {
        /* on réessaie au prochain cycle */
      }
    };

    void tick();
    pollRef.current = window.setInterval(() => void tick(), 4000);
    return () => {
      stopped = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [step, transactionId, fetchStatus]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl">
      <header className="flex items-center gap-3 px-4 py-3">
        {step !== "mode" && step !== "waiting" && step !== "done" ? (
          <button
            type="button"
            aria-label="Retour"
            onClick={() =>
              setStep(
                step === "details" ? "method" : step === "method" ? "country" : "mode",
              )
            }
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <span className="h-9 w-9" />
        )}
        <div>
          <p className="text-sm text-muted-foreground">Abonnement</p>
          <h2 className="text-lg font-semibold">{productLabel}</h2>
        </div>
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-10">
        {error && (
          <p className="mb-4 flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {step === "mode" && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">Choisissez votre mode de paiement</p>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("country");
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/40 px-4 py-4 text-left"
                >
                  <Smartphone className="h-5 w-5 text-primary" />
                  <span>
                    <span className="block font-medium">Mobile Money</span>
                    <span className="block text-xs text-muted-foreground">
                      MTN, Orange, Wave… paiement en devise locale
                    </span>
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("card");
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/40 px-4 py-4 text-left"
                >
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span>
                    <span className="block font-medium">Carte bancaire / Virement</span>
                    <span className="block text-xs text-muted-foreground">
                      Paiement direct en euros, sans conversion
                    </span>
                  </span>
                </button>
              </li>
            </ul>
          </>
        )}

        {step === "card" && (
          <div className="space-y-4">
            <p className="rounded-2xl border border-border bg-card/40 p-3 text-xs text-muted-foreground">
              Le paiement par carte n'est pas encore actif : le prestataire reste à connecter.
            </p>
            <div>
              <label htmlFor="cb-name" className="text-sm text-muted-foreground">
                Nom du porteur
              </label>
              <input
                id="cb-name"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-border bg-card/40 px-4 py-3"
                placeholder="Nom inscrit sur la carte"
              />
            </div>
            <div>
              <label htmlFor="cb-number" className="text-sm text-muted-foreground">
                Numéro de carte
              </label>
              <input
                id="cb-number"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-border bg-card/40 px-4 py-3"
                placeholder="1234 5678 9012 3456"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="cb-exp" className="text-sm text-muted-foreground">
                  Expiration
                </label>
                <input
                  id="cb-exp"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-border bg-card/40 px-4 py-3"
                  placeholder="MM/AA"
                />
              </div>
              <div className="w-28">
                <label htmlFor="cb-cvv" className="text-sm text-muted-foreground">
                  CVV
                </label>
                <input
                  id="cb-cvv"
                  inputMode="numeric"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-border bg-card/40 px-4 py-3"
                  placeholder="123"
                />
              </div>
            </div>
            <button
              type="button"
              disabled
              className="w-full rounded-full bg-foreground py-4 text-[17px] font-semibold text-background disabled:opacity-50"
            >
              Payer par carte (bientôt disponible)
            </button>
          </div>
        )}

        {step === "country" && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">Sélectionnez votre pays</p>
            <ul className="space-y-2">
              {SUPPORTED_COUNTRIES.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => void chooseCountry(c.code)}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-card/40 px-4 py-3 text-left"
                  >
                    <span>{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.currency}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {step === "method" && (
          <>
            {quote && (
              <div className="mb-4 rounded-2xl border border-border bg-card/40 p-4">
                <p className="text-sm text-muted-foreground">Montant à payer</p>
                <p className="text-2xl font-semibold">
                  {formatLocalAmount(quote.amountLocal, quote.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  soit {quote.amountEur.toFixed(2)} € — {selectedCountry?.name}
                </p>
              </div>
            )}
            <p className="mb-3 text-sm text-muted-foreground">Choisissez un moyen de paiement</p>
            {busy && <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-muted-foreground" />}
            <ul className="space-y-2">
              {methods.map((m) => (
                <li key={m.code}>
                  <button
                    type="button"
                    onClick={() => {
                      setMethod(m);
                      setStep("details");
                    }}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-card/40 px-4 py-3 text-left"
                  >
                    <span>{m.label}</span>
                    {m.mobileFormat && (
                      <span className="text-xs text-muted-foreground">{m.mobileFormat}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {!busy && methods.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucun moyen de paiement disponible pour ce pays.
              </p>
            )}
          </>
        )}

        {step === "details" && (
          <div className="space-y-4">
            <div>
              <label htmlFor="ck-name" className="text-sm text-muted-foreground">
                Nom complet
              </label>
              <input
                id="ck-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-border bg-card/40 px-4 py-3"
                placeholder="Votre nom"
              />
            </div>
            <p className="rounded-2xl border border-border bg-card/40 p-3 text-xs text-muted-foreground">
              Le reçu sera envoyé à <span className="font-medium text-foreground">{email}</span>{" "}
              (l'adresse de votre compte).
            </p>
            <div>
              <label htmlFor="ck-mobile" className="text-sm text-muted-foreground">
                Numéro {method?.label ? `(${method.label})` : ""}
              </label>
              <input
                id="ck-mobile"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-border bg-card/40 px-4 py-3"
                placeholder={method?.mobileFormat ?? "Ex : 2376XXXXXXXX"}
              />
              {(method?.length || prefixes) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {method?.length ? `Format attendu : ${method.length} chiffres` : ""}
                  {prefixes && prefixes.length > 0
                    ? `${method?.length ? ", " : ""}commence par ${prefixes.join(" ou ")}`
                    : method?.prefix
                      ? `, préfixe ${method.prefix}`
                      : ""}
                </p>
              )}
            </div>

            {quote && (
              <div className="rounded-2xl border border-border bg-card/40 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">
                    {formatLocalAmount(quote.amountLocal, quote.currency)}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={busy || !mobileValid || fullName.trim().length < 2}
              onClick={() => void submit()}
              className="w-full rounded-full bg-foreground py-4 text-[17px] font-semibold text-background disabled:opacity-50"
            >
              {busy ? "Envoi…" : "Payer maintenant"}
            </button>
          </div>
        )}

        {step === "waiting" && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-lg font-semibold">Paiement en attente</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Validez la demande sur votre téléphone. Cette page se met à jour automatiquement.
            </p>
            {statusMessage && <p className="text-xs text-muted-foreground">{statusMessage}</p>}
            {paymentLink && (
              <a
                href={paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
              >
                Ouvrir la page de paiement
              </a>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20">
              <Check className="h-7 w-7 text-primary" />
            </span>
            <p className="text-lg font-semibold">Paiement confirmé</p>
            <p className="text-sm text-muted-foreground">Votre abonnement {productLabel} est actif.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-full bg-foreground px-6 py-3 font-semibold text-background"
            >
              Continuer
            </button>
          </div>
        )}

        {step === "failed" && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/20">
              <X className="h-7 w-7 text-destructive" />
            </span>
            <p className="text-lg font-semibold">Paiement échoué</p>
            <button
              type="button"
              onClick={() => setStep("details")}
              className="mt-2 rounded-full bg-foreground px-6 py-3 font-semibold text-background"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

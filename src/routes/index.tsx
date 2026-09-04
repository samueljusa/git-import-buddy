import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Loader2, ChevronLeft } from "lucide-react";
import nightSky from "@/assets/night-sky.jpg";
import logoAsset from "@/assets/sam-flash-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s['next'] === "string" && s['next'].startsWith("/") ? { next: s['next'] } : {},

  head: () => ({
    meta: [
      { title: "Sam flash 2.0 — Créez images et vidéos IA" },
      {
        name: "description",
        content:
          "Sam flash 2.0 powered by xia Grok : générez des vidéos et images IA en quelques secondes depuis votre mobile.",
      },
      { property: "og:title", content: "Sam flash 2.0 — Créez images et vidéos IA" },
      {
        property: "og:description",
        content: "Générez des vidéos et images IA en quelques secondes avec Sam flash 2.0.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { session, loading } = useAuth();

  const goNext = () => {
    if (next) window.location.href = next;
    else void navigate({ to: "/app" });
  };
  const [mode, setMode] = useState<"providers" | "email">("providers");
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, next]);

  const google = async () => {
    setBusy(true);
    setMessage(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: next
        ? `${window.location.origin}/?next=${encodeURIComponent(next)}`
        : window.location.origin,
    });
    if (result.error) {
      setMessage("Connexion Google impossible pour le moment.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    goNext();
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    if (signUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });
      setBusy(false);
      setMessage(
        error
          ? error.message
          : "Compte créé. Vérifiez votre e-mail pour confirmer votre inscription.",
      );
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMessage(error.message);
    else goNext();
  };

  return (
    <main
      className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-background px-6 py-12"
      style={{
        backgroundImage: `linear-gradient(to bottom, oklch(0.16 0.06 265 / 0.75), oklch(0.12 0.05 265 / 0.95)), url(${nightSky})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="animate-float">
          <img
            src={logoAsset.url}
            alt="Logo Sam flash 2.0"
            className="mx-auto mb-5 h-28 w-28 rounded-full object-cover shadow-2xl"
          />
          <h1 className="max-w-xs text-4xl font-semibold leading-tight tracking-tight text-foreground">
            Sam flash 2.0
          </h1>
          <p className="mt-2 text-sm tracking-[0.2em] text-muted-foreground">powered by xia Grok</p>
          <p className="mt-6 font-mono text-base text-muted-foreground">Understand the Universe_</p>
        </div>
      </div>

      <div className="animate-float space-y-3">
        {mode === "providers" ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={google}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-secondary/50 py-4 text-[17px] font-medium backdrop-blur-2xl transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="text-xl font-semibold">G</span>}
              Continuer avec Google
            </button>
            <button
              type="button"
              onClick={() => setMode("email")}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-primary/60 bg-secondary/50 py-4 text-[17px] font-medium backdrop-blur-2xl transition-transform active:scale-[0.98]"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              <Mail className="h-5 w-5" />
              Continuer avec l'e-mail
            </button>
          </>
        ) : (
          <form onSubmit={submitEmail} className="space-y-3">
            <button
              type="button"
              onClick={() => setMode("providers")}
              className="flex items-center gap-1 text-sm text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> Retour
            </button>
            {signUp && (
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nom complet"
                className="w-full rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-[17px] outline-none backdrop-blur-2xl placeholder:text-muted-foreground"
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              className="w-full rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-[17px] outline-none backdrop-blur-2xl placeholder:text-muted-foreground"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="w-full rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-[17px] outline-none backdrop-blur-2xl placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-[17px] font-semibold text-primary-foreground disabled:opacity-60"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              {busy && <Loader2 className="h-5 w-5 animate-spin" />}
              {signUp ? "Créer mon compte" : "Se connecter"}
            </button>
            <button
              type="button"
              onClick={() => setSignUp((v) => !v)}
              className="w-full text-center text-sm text-muted-foreground"
            >
              {signUp ? "J'ai déjà un compte" : "Créer un compte"}
            </button>
          </form>
        )}

        {message && (
          <p className="pt-2 text-center text-sm text-muted-foreground">{message}</p>
        )}

        <p className="pt-4 text-center text-xs text-muted-foreground">
          En continuant, vous acceptez les Conditions d'utilisation et la Politique de
          confidentialité
        </p>
      </div>
    </main>
  );
}

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Props = {
  prompt: string;
  mediaType: "image" | "video";
  /** Durée estimée en secondes, utilisée pour animer la barre de progression. */
  estimate?: number;
};

/** Aperçu temps réel d'une génération en cours (progression estimée, effet shimmer). */
export function PendingCard({ prompt, mediaType, estimate = 45 }: Props) {
  const { t } = useI18n();
  const [progress, setProgress] = useState(4);

  useEffect(() => {
    setProgress(4);
    const started = Date.now();
    const id = window.setInterval(() => {
      const ratio = (Date.now() - started) / (estimate * 1000);
      // Courbe asymptotique : on approche 95 % sans jamais l'atteindre avant la fin réelle.
      setProgress(Math.min(95, 4 + 91 * (1 - Math.exp(-2.2 * ratio))));
    }, 400);
    return () => window.clearInterval(id);
  }, [estimate, prompt]);

  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-xl">
      <div
        aria-hidden
        className="absolute inset-0 animate-[promptShimmer_1.6s_linear_infinite] bg-[linear-gradient(110deg,transparent_25%,color-mix(in_oklch,var(--primary)_22%,transparent)_45%,transparent_65%)] bg-[length:250%_100%]"
      />
      <div className="relative flex h-full flex-col justify-end gap-2 p-3">
        <p className="text-[11px] text-muted-foreground line-clamp-3">{prompt}</p>
        <div className="flex items-center justify-between text-[11px] font-medium">
          <span>{mediaType === "video" ? t("renderingVideo") : t("renderingImage")}</span>
          <span className="tabular-nums text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

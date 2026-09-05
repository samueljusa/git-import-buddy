import { useRef, useState } from "react";
import { Plus, Image as ImageIcon, Video, Smile, ArrowUp, Loader2, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateMedia } from "@/lib/generation.functions";
import { enhancePrompt } from "@/lib/prompt.functions";
import { useI18n } from "@/lib/i18n";
import { playChime } from "@/lib/chime";
import { toast } from "@/lib/toast";


const chip = (active: boolean) =>
  `shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
    active ? "bg-foreground text-background" : "text-muted-foreground"
  }`;

/** Message clair selon la limite atteinte. */
function quotaMessage(
  code: "image_daily" | "video_daily" | "video_pause" | "video_seconds" | "subscription_expired",
  retryAt: string | null,
  remainingSeconds?: number,
) {
  const when = retryAt
    ? new Date(retryAt).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  if (code === "subscription_expired") {
    return "Votre abonnement est arrivé à expiration. Veuillez vous réabonner pour continuer à utiliser les fonctionnalités pro de Sam Flash 2.0.";
  }
  if (code === "video_seconds") {
    const left = remainingSeconds ?? 0;
    if (left > 0) {
      return `⚠️ Limite quotidienne atteinte : il vous reste seulement ${left} secondes de génération vidéo. Veuillez revenir lorsque votre quota sera renouvelé${when ? ` (le ${when})` : ""}.`;
    }
    return `🚫 Limite quotidienne atteinte : vous avez utilisé toutes vos secondes de génération vidéo pour cette période.${when ? ` Votre quota sera renouvelé le ${when}.` : ""}`;
  }
  if (code === "image_daily")
    return "Limite de 5 images par jour atteinte. Revenez demain ou passez à une offre supérieure.";
  if (code === "video_daily")
    return "Limite de 9 vidéos par jour atteinte. Revenez demain ou passez à une offre supérieure.";
  return when
    ? `Pause de 3 h après 5 vidéos. Nouvelle génération possible à ${when}.`
    : "Pause de 3 h après 5 vidéos. Réessayez un peu plus tard.";
}

type Props = {
  onStart?: (info: { prompt: string; mediaType: "image" | "video" }) => void;
  onSettled?: () => void;
  onGenerated?: () => void;
  onQuotaExceeded?: () => void;
};

export function PromptBar({ onStart, onSettled, onGenerated, onQuotaExceeded }: Props) {
  const { t, lang } = useI18n();
  const [res, setRes] = useState("720p");
  const [dur, setDur] = useState("6s");
  const [ratio, setRatio] = useState("2:3");
  const [mode, setMode] = useState<"image" | "video">("video");
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const focusInput = () => inputRef.current?.focus();
  const blurInput = () => {
    inputRef.current?.blur();
    setPromptFocused(false);
  };

  const generate = useServerFn(generateMedia);
  const enhance = useServerFn(enhancePrompt);

  const runEnhance = async () => {
    const prompt = text.trim();
    if (!prompt || enhancing || busy) return;
    setEnhancing(true);
    setSent(t("enhancing"));
    try {
      const result = await enhance({ data: { prompt, mediaType: mode, language: lang } });
      if (result.ok) {
        setText(result.prompt);
        playChime("success");
        setSent(t("enhanceDone"));
        focusInput();
      } else {
        setSent(result.message ?? t("enhanceFail"));
      }
    } catch (error) {
      setSent(error instanceof Error ? error.message : t("enhanceFail"));
    } finally {
      setEnhancing(false);
      setTimeout(() => setSent(null), 2600);
    }
  };


  const submit = async () => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setText("");
    blurInput();
    playChime("send");
    onStart?.({ prompt, mediaType: mode });

    setSent(
      mode === "video"
        ? `${t("video")} ${res} · ${dur} · ${ratio}…`
        : `${t("image")} ${res} · ${ratio}…`,
    );
    try {
      const result = await generate({
        data: { prompt, mediaType: mode, resolution: res, duration: dur, aspectRatio: ratio },
      });
      if (result.ok) {
        playChime("success");
        setSent(t("genDone"));
        onGenerated?.();
      } else if (result.reason === "quota") {
        playChime("error");
        setText(prompt);
        const message = quotaMessage(result.code, result.retryAt, result.remainingSeconds);
        setSent(message);
        toast.error(message);
        onQuotaExceeded?.();
      } else {
        playChime("error");
        setText(prompt);
        setSent(result.message ?? t("genFail"));
      }
    } catch (error) {
      playChime("error");
      setText(prompt);
      setSent(error instanceof Error ? error.message : t("genFail"));
    } finally {
      setBusy(false);
      onSettled?.();
      setTimeout(() => setSent(null), 2600);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-4">
      {sent && (
        <div className="mx-auto mb-2 w-fit rounded-full bg-card px-4 py-2 text-sm animate-fade-in">
          {sent}
        </div>
      )}
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 p-1 backdrop-blur-xl">
          {(mode === "video" ? ["480p", "720p"] : ["480p", "720p", "1080p"]).map((r) => (
            <button key={r} type="button" onClick={() => setRes(r)} className={chip(res === r)}>
              {r}
            </button>
          ))}
        </div>
        {mode === "video" && (
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 p-1 backdrop-blur-xl">
            {["3s", "6s"].map((d) => (
              <button key={d} type="button" onClick={() => setDur(d)} className={chip(dur === d)}>
                {d}
              </button>
            ))}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 p-1 backdrop-blur-xl">
          {["9:16", "2:3", "3:4", "1:1", "16:9"].map((r) => (
            <button key={r} type="button" onClick={() => setRatio(r)} className={chip(ratio === r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`relative overflow-hidden rounded-[28px] border bg-card/60 p-3 backdrop-blur-2xl transition-[border-color,box-shadow,background-color] duration-300 ease-out ${
          promptFocused
            ? "border-ring/50 bg-card/80 shadow-[0_10px_40px_-18px_color-mix(in_oklch,var(--ring)_55%,transparent)] ring-1 ring-ring/20"
            : "border-border"
        }`}
      >
        {enhancing && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-[promptShimmer_1.2s_linear_infinite] bg-[linear-gradient(110deg,transparent_25%,color-mix(in_oklch,var(--primary)_28%,transparent)_45%,transparent_65%)] bg-[length:250%_100%]"
          />
        )}

        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setPromptFocused(true)}
          onBlur={() => setPromptFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          disabled={enhancing}
          placeholder={
            t("promptPlaceholder")
          }
          className={`block w-full resize-none overflow-y-auto bg-transparent px-2 pb-3 text-[17px] leading-6 outline-none transition-[min-height] duration-300 ease-out [field-sizing:content] placeholder:text-muted-foreground ${
            promptFocused || text ? "min-h-24 max-h-56" : "min-h-11 max-h-56"
          }`}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Ajouter"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary"
          >
            <Plus className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
            <button
              type="button"
              aria-label="Image"
              onClick={() => {
                setMode("image");
                focusInput();
              }}
              className={`flex items-center gap-2 rounded-full px-3 py-2 ${
                mode === "image" ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              <ImageIcon className="h-5 w-5" />
              {mode === "image" && <span className="text-sm font-medium">{t("image")}</span>}
            </button>
            <button
              type="button"
              aria-label="Vidéo"
              onClick={() => {
                setMode("video");
                setRes((r) => (r === "1080p" ? "720p" : r));
                focusInput();
              }}
              className={`flex items-center gap-2 rounded-full px-3 py-2 ${
                mode === "video" ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              <Video className="h-5 w-5" />
              {mode === "video" && <span className="text-sm font-medium">{t("video")}</span>}
            </button>
            <button
              type="button"
              aria-label="Emoji"
              className="rounded-full px-3 py-2 text-muted-foreground"
            >
              <Smile className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            aria-label={t("enhance")}
            title={t("enhance")}
            onClick={() => void runEnhance()}
            className="group relative ml-auto flex h-11 items-center gap-2 rounded-full bg-secondary px-3 text-foreground transition-colors disabled:opacity-40"
            disabled={!text.trim() || enhancing || busy}
          >
            {enhancing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            <span className="hidden text-sm font-medium sm:inline">{t("enhance")}</span>
          </button>
          <button
            type="button"
            aria-label={t("send")}
            onClick={() => void submit()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            disabled={!text.trim() || busy || enhancing}
          >

            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Captions, Download, Film, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { deleteGeneration, generateMedia, retryGeneration } from "@/lib/generation.functions";
import { generateSubtitles } from "@/lib/subtitles.functions";
import { useI18n } from "@/lib/i18n";
import { playChime } from "@/lib/chime";
import type { Generation } from "@/hooks/useGenerations";

type Props = {
  item: Generation;
  onClose: () => void;
  onChanged?: () => void;
};

const action =
  "flex flex-1 items-center justify-center gap-2 rounded-2xl bg-secondary/80 px-3 py-3 text-sm font-medium backdrop-blur-xl transition-colors disabled:opacity-40";

export function MediaViewer({ item, onClose, onChanged }: Props) {
  const { t, lang } = useI18n();
  const isVideo = item.media_type === "video";
  const [busy, setBusy] = useState<null | "subs" | "retry" | "toVideo" | "delete">(null);
  const [vttUrl, setVttUrl] = useState<string | null>(null);
  const [subsOn, setSubsOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const subtitles = useServerFn(generateSubtitles);
  const retry = useServerFn(retryGeneration);
  const generate = useServerFn(generateMedia);
  const removeItem = useServerFn(deleteGeneration);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => () => { if (vttUrl) URL.revokeObjectURL(vttUrl); }, [vttUrl]);

  const filename = useMemo(
    () => `sam-flash-${item.id.slice(0, 8)}.${isVideo ? "mp4" : "png"}`,
    [item.id, isVideo],
  );

  const download = async () => {
    if (!item.media_url) return;
    try {
      const res = await fetch(item.media_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      playChime("success");
      toast.success(t("downloadOk"));
    } catch {
      window.open(item.media_url, "_blank", "noopener");
    }
  };

  const toggleSubtitles = async () => {
    if (vttUrl) {
      setSubsOn((v) => !v);
      return;
    }
    setBusy("subs");
    try {
      const result = await subtitles({ data: { id: item.id, language: lang } });
      if (result.ok) {
        const url = URL.createObjectURL(new Blob([result.vtt], { type: "text/vtt" }));
        setVttUrl(url);
        setSubsOn(true);
        playChime("success");
        toast.success(t("subsOk"));
      } else {
        playChime("error");
        toast.error(result.message ?? t("subsFail"));
      }
    } catch {
      toast.error(t("subsFail"));
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async () => {
    setBusy("retry");
    try {
      const result = await retry({ data: { id: item.id } });
      if (result.ok) {
        playChime("success");
        toast.success(t("genDone"));
        onChanged?.();
        onClose();
      } else {
        playChime("error");
        toast.error(result.reason === "quota" ? t("quotaReached") : (result.message ?? t("genFail")));
      }
    } catch {
      toast.error(t("genFail"));
    } finally {
      setBusy(null);
    }
  };

  const toVideo = async () => {
    setBusy("toVideo");
    try {
      const result = await generate({
        data: {
          prompt: item.prompt,
          mediaType: "video",
          resolution: item.resolution ?? "720p",
          duration: "6s",
          aspectRatio: item.aspect_ratio ?? "2:3",
        },
      });
      if (result.ok) {
        playChime("success");
        toast.success(t("genDone"));
        onChanged?.();
        onClose();
      } else {
        playChime("error");
        toast.error(result.reason === "quota" ? t("quotaReached") : (result.message ?? t("genFail")));
      }
    } catch {
      toast.error(t("genFail"));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm("Supprimer définitivement cette création ?")) return;
    setBusy("delete");
    try {
      const result = await removeItem({ data: { id: item.id } });
      if (result.ok) {
        toast.success("Création supprimée.");
        onChanged?.();
        onClose();
      } else {
        playChime("error");
        toast.error(result.message);
      }
    } catch {
      toast.error("Suppression impossible.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/80 backdrop-blur-2xl animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-sm font-medium">{isVideo ? t("video") : t("image")}</span>
        <button
          type="button"
          aria-label={t("close")}
          onClick={onClose}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden px-4">
        {item.media_url ? (
          isVideo ? (
            <video
              ref={videoRef}
              key={vttUrl ?? "novtt"}
              src={item.media_url}
              controls
              playsInline
              autoPlay
              className="max-h-full w-full rounded-3xl border border-border object-contain shadow-2xl"
            >
              {vttUrl && (
                <track kind="subtitles" srcLang={lang} label="Sous-titres" src={vttUrl} default={subsOn} />
              )}
            </video>
          ) : (
            <img
              src={item.media_url}
              alt={item.prompt}
              className="max-h-full w-full rounded-3xl border border-border object-contain shadow-2xl"
            />
          )
        ) : (
          <p className="px-6 text-center text-sm text-muted-foreground">
            {item.error_message ?? t("processing")}
          </p>
        )}
      </div>

      <div className="px-4 pt-3 text-xs text-muted-foreground line-clamp-3">{item.prompt}</div>

      <div className="flex gap-2 px-4 pb-8 pt-3">
        <button type="button" onClick={() => void download()} className={action} disabled={!item.media_url}>
          <Download className="h-4 w-4" />
          {t("download")}
        </button>
        {isVideo ? (
          <button
            type="button"
            onClick={() => void toggleSubtitles()}
            className={`${action} ${subsOn ? "bg-foreground text-background" : ""}`}
            disabled={!item.media_url || busy === "subs"}
          >
            {busy === "subs" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Captions className="h-4 w-4" />}
            {t("subtitles")}
          </button>
        ) : (
          <button type="button" onClick={() => void toVideo()} className={action} disabled={busy === "toVideo"}>
            {busy === "toVideo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            {t("toVideo")}
          </button>
        )}
        <button type="button" onClick={() => void regenerate()} className={action} disabled={busy === "retry"}>
          {busy === "retry" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {t("regenerate")}
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          aria-label="Supprimer la création"
          className={`${action} text-destructive`}
          disabled={busy === "delete"}
        >
          {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

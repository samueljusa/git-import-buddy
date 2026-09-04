import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "@/lib/toast";
import { ChevronRight, Play, Share2, Sparkles, User } from "lucide-react";
import { submitToGallery } from "@/lib/community.functions";
import { SupportReplyNotifier } from "@/components/samflash/SupportReplyNotifier";

import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { SettingsSheet } from "@/components/samflash/SettingsSheet";
import { PromptBar } from "@/components/samflash/PromptBar";
import { PlansSheet } from "@/components/samflash/PlansSheet";
import { useGenerations, type Generation } from "@/hooks/useGenerations";
import { PendingCard } from "@/components/samflash/PendingCard";
import { MediaViewer } from "@/components/samflash/MediaViewer";
import logoAsset from "@/assets/sam-flash-logo.png.asset.json";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Sam flash 2.0 — Studio de création IA" },
      {
        name: "description",
        content:
          "Studio Sam flash 2.0 : décrivez votre idée et générez des vidéos et images IA en quelques secondes.",
      },
      { property: "og:title", content: "Sam flash 2.0 — Studio de création IA" },
      {
        property: "og:description",
        content: "Décrivez votre idée et générez vidéos et images IA avec Sam flash 2.0.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppFeed,
});

function AppFeed() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [pending, setPending] = useState<{ prompt: string; mediaType: "image" | "video" } | null>(
    null,
  );
  const [viewer, setViewer] = useState<Generation | null>(null);
  const navigate = useNavigate();
  const { t } = useI18n();
  const { session, loading } = useAuth();
  const { items, loading: feedLoading, refresh } = useGenerations(!!session);
  const submit = useServerFn(submitToGallery);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  const share = async (id: string) => {
    try {
      await submit({ data: { id, consent: true } });
      toast.success(t("shareOk"));
    } catch {
      toast.error(t("shareErr"));
    }
  };

  return (
    <div
      className="min-h-screen bg-background pb-64"
      style={{ background: "var(--gradient-hero)" }}
    >
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-background/60 px-4 py-3 backdrop-blur-xl">
        <img
          src={logoAsset.url}
          alt="Logo Sam flash 2.0"
          className="h-10 w-10 rounded-full object-cover shadow-md"
        />
        <div className="min-w-0">
          <span className="block text-xl font-semibold leading-tight tracking-tight">
            Sam flash 2.0
          </span>
          <span className="block text-[11px] leading-tight text-muted-foreground">
            powered by xai grok
          </span>
        </div>
        <button
          type="button"
          aria-label={t("seePlans")}
          onClick={() => setPlansOpen(true)}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          {t("subscriptionBtn")}
        </button>
        <button
          type="button"
          aria-label={t("openSettings")}
          onClick={() => setSettingsOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"
        >
          <User className="h-5 w-5 text-muted-foreground" />
        </button>
      </header>


      <section className="pt-6">
        <div className="flex items-center gap-2 px-4">
          <h1 className="text-2xl font-semibold">{t("myCreations")}</h1>
          <Link
            to="/galerie"
            className="ml-auto rounded-full bg-secondary px-3 py-1.5 text-xs font-medium"
          >
            {t("gallery")}
          </Link>

          <button
            type="button"
            onClick={() => void refresh()}
            aria-label={t("refresh")}
            className="flex items-center gap-1 text-muted-foreground"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 px-4">
          {pending && (
            <PendingCard
              prompt={pending.prompt}
              mediaType={pending.mediaType}
              estimate={pending.mediaType === "video" ? 75 : 25}
            />
          )}
          {feedLoading && items.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] animate-pulse rounded-2xl border border-border bg-card/40 backdrop-blur-xl"
                />
              ))
            : items.map((g) => (
                <div
                  key={g.id}
                  className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-xl"
                >
                  <button
                    type="button"
                    aria-label={t("openMedia")}
                    onClick={() => setViewer(g)}
                    className="block h-full w-full text-left"
                  >
                    {g.media_url ? (
                      g.media_type === "video" ? (
                        <video
                          src={g.media_url}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <img
                          src={g.media_url}
                          alt={g.prompt}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )
                    ) : (
                      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
                        {g.status === "processing"
                          ? t("processing")
                          : (g.error_message ?? g.prompt)}
                      </div>
                    )}
                  </button>
                  {g.media_type === "video" && g.media_url && (
                    <span className="pointer-events-none absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 backdrop-blur-md">
                      <Play className="h-4 w-4" />
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={t("shareGallery")}
                    onClick={() => void share(g.id)}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 backdrop-blur-md"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-background/70 px-2 py-1 text-[11px] line-clamp-2 backdrop-blur-md">
                    {g.prompt}
                  </div>
                </div>
              ))}
          {!feedLoading && items.length === 0 && !pending && (
            <p className="col-span-2 py-10 text-center text-sm text-muted-foreground">
              {t("emptyFeed")}
            </p>
          )}
        </div>
      </section>

      <PromptBar
        onStart={(p) => setPending(p)}
        onSettled={() => setPending(null)}
        onGenerated={() => void refresh()}
        onQuotaExceeded={() => setPlansOpen(true)}
      />

      <SupportReplyNotifier enabled={!!session} />
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {plansOpen && <PlansSheet onClose={() => setPlansOpen(false)} />}
      {viewer && (
        <MediaViewer
          item={viewer}
          onClose={() => setViewer(null)}
          onChanged={() => void refresh()}
        />
      )}
    </div>
  );
}

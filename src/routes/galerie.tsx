import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, ShieldCheck, Sparkles, X } from "lucide-react";
import {
  getModerationAccess,
  listCommunityGallery,
  listModerationQueue,
  moderateGeneration,
  type CommunityItem,
  type ModerationItem,
} from "@/lib/community.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/galerie")({
  head: () => ({
    meta: [
      { title: "Galerie communautaire — Sam flash 2.0" },
      {
        name: "description",
        content:
          "Découvrez les meilleures vidéos et images générées par la communauté Sam flash 2.0, publiées avec le consentement de leurs auteurs.",
      },
      { property: "og:title", content: "Galerie communautaire — Sam flash 2.0" },
      {
        property: "og:description",
        content: "Les meilleures créations IA de la communauté Sam flash 2.0.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const { session } = useAuth();
  const fetchGallery = useServerFn(listCommunityGallery);
  const fetchAccess = useServerFn(getModerationAccess);
  const fetchQueue = useServerFn(listModerationQueue);
  const moderate = useServerFn(moderateGeneration);

  const [items, setItems] = useState<CommunityItem[]>([]);
  const [queue, setQueue] = useState<ModerationItem[]>([]);
  const [canModerate, setCanModerate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await fetchGallery({})) as CommunityItem[]);
      if (session) {
        const access = await fetchAccess({});
        const allowed = access.isAdmin || access.isModerator;
        setCanModerate(allowed);
        if (allowed) setQueue((await fetchQueue({})) as ModerationItem[]);
      } else {
        setCanModerate(false);
        setQueue([]);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchGallery, fetchAccess, fetchQueue, session]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      await moderate({
        data: action === "reject" ? { id, action, reason: "Contenu inapproprié" } : { id, action },
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16" style={{ background: "var(--gradient-hero)" }}>
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-background/60 px-4 py-3 backdrop-blur-xl">
        <Link
          to="/app"
          aria-label="Retour au studio"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <span className="block text-lg font-semibold tracking-tight">Galerie communautaire</span>
          <span className="block text-[11px] text-muted-foreground">powered by xai grok</span>
        </div>
        <Sparkles className="ml-auto h-5 w-5 text-primary" />
      </header>

      <main className="px-4 pt-4">
        <h1 className="text-2xl font-semibold">Les meilleures créations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vidéos et images mises en avant, publiées avec consentement de leurs auteurs.
        </p>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {loading && items.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] animate-pulse rounded-2xl border border-border bg-card/40 backdrop-blur-xl"
                />
              ))
            : items.map((g) => (
                <article
                  key={g.id}
                  className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-xl"
                >
                  {g.media_url && g.media_type === "video" ? (
                    <video
                      src={g.media_url}
                      className="h-full w-full object-cover"
                      muted
                      loop
                      playsInline
                      controls
                    />
                  ) : g.media_url ? (
                    <img
                      src={g.media_url}
                      alt={g.prompt}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
                      {g.prompt}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-background/70 px-2 py-1 backdrop-blur-md">
                    <p className="line-clamp-2 text-[11px]">{g.prompt}</p>
                    <p className="text-[10px] text-muted-foreground">avec consentement</p>
                  </div>
                </article>
              ))}
        </section>

        {!loading && items.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucune création publiée pour le moment.
          </p>
        )}

        {canModerate && (
          <section className="mt-10">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Modération</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Validez ou rejetez les créations soumises à la galerie.
            </p>

            <div className="mt-4 space-y-3">
              {queue.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune soumission à traiter.</p>
              )}
              {queue.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-3 backdrop-blur-xl"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                    {g.media_url &&
                      (g.media_type === "video" ? (
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
                      ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm">{g.prompt}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {g.media_type} · {g.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Approuver"
                    disabled={busyId === g.id}
                    onClick={() => void act(g.id, "approve")}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Rejeter"
                    disabled={busyId === g.id}
                    onClick={() => void act(g.id, "reject")}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-destructive-foreground disabled:opacity-40"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

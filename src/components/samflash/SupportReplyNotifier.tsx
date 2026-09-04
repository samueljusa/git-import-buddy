import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquareWarning, X } from "lucide-react";
import { listSupportUpdates, type SupportUpdate } from "@/lib/support.functions";
import { playAppleChime } from "@/lib/chime";

const SEEN_KEY = "samflash.support.seenReplies";

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Affiche une notification (avec carillon) dès que le support répond à un ticket. */
export function SupportReplyNotifier({ enabled }: { enabled: boolean }) {
  const fetchUpdates = useServerFn(listSupportUpdates);
  const [current, setCurrent] = useState<SupportUpdate | null>(null);

  const check = useCallback(async () => {
    try {
      const updates = await fetchUpdates();
      const seen = readSeen();
      const fresh = updates.filter((u) => !seen.includes(u.replyId));
      if (fresh.length === 0) {
        if (seen.length === 0 && updates.length > 0) {
          localStorage.setItem(SEEN_KEY, JSON.stringify(updates.map((u) => u.replyId)));
        }
        return;
      }
      const next = fresh[0]!;
      localStorage.setItem(
        SEEN_KEY,
        JSON.stringify([...seen, ...fresh.map((u) => u.replyId)].slice(-200)),
      );
      setCurrent(next);
      playAppleChime();
      if (navigator.vibrate) navigator.vibrate(12);
    } catch {
      /* silencieux */
    }
  }, [fetchUpdates]);

  useEffect(() => {
    if (!enabled) return;
    void check();
    const id = window.setInterval(() => void check(), 45000);
    return () => window.clearInterval(id);
  }, [enabled, check]);

  useEffect(() => {
    if (!current) return;
    const id = window.setTimeout(() => setCurrent(null), 9000);
    return () => window.clearTimeout(id);
  }, [current]);

  if (!current) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex justify-center px-3">
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-3xl border border-border bg-card/80 px-4 py-3 shadow-2xl backdrop-blur-2xl animate-fade-in">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
          <MessageSquareWarning className="h-5 w-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight">
            Vous avez une réponse concernant votre ticket
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">« {current.subject} »</p>
          <p className="mt-1 line-clamp-2 text-sm text-foreground/80">{current.body}</p>
        </div>
        <button
          type="button"
          aria-label="Fermer la notification"
          onClick={() => setCurrent(null)}
          className="shrink-0 rounded-full p-1 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

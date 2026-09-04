import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listGenerations } from "@/lib/generation.functions";

export type Generation = {
  id: string;
  prompt: string;
  media_type: string;
  resolution: string | null;
  duration: string | null;
  aspect_ratio: string | null;
  media_url: string | null;
  status: string;
  duration_seconds: number;
  error_message: string | null;
  created_at: string;
};

export function useGenerations(enabled: boolean) {
  const fetchList = useServerFn(listGenerations);
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setItems((await fetchList({})) as Generation[]);
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchList]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, refresh };
}

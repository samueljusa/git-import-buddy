/**
 * Logique serveur de génération de médias (Fal.ai / Grok Imagine).
 * Règle de quota : la réservation est atomique puis remboursée intégralement
 * si le moteur échoue ou si le média n'est pas affichable.
 *
 * Limites offre découverte :
 *  - 5 images par jour
 *  - 9 vidéos par jour, avec une pause de 3 h après la 5ᵉ vidéo
 * Vidéos : 6 secondes maximum, 480p ou 720p.
 */

export type GenerationInput = {
  prompt: string;
  mediaType: "image" | "video";
  resolution: string;
  duration: string;
  aspectRatio: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
};

export type GenerationRow = {
  id: string;
  prompt: string;
  media_type: string;
  resolution: string | null;
  duration: string | null;
  aspect_ratio: string | null;
  media_url: string | null;
  storage_path?: string | null;
  status: string;
  duration_seconds: number;
  error_message: string | null;
  created_at: string;
};

export type QuotaReason =
  | "image_daily"
  | "video_daily"
  | "video_pause"
  | "video_seconds"
  | "subscription_expired";

export type GenerationResult =
  | { ok: true; id: string | null; status: "ready"; mediaUrl: string; seconds: number }
  | {
      ok: false;
      reason: "quota";
      code: QuotaReason;
      retryAt: string | null;
      remainingSeconds?: number;
      limitSeconds?: number;
    }
  | { ok: false; reason: "error"; message: string; id: string | null };


const SIGNED_URL_TTL = 60 * 60 * 6;

function extensionFor(contentType: string): string {
  if (contentType.includes("video")) return contentType.includes("webm") ? "webm" : "mp4";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

/** Régénère des URL signées fraîches à partir des chemins de stockage. */
export async function withFreshUrls<T extends GenerationRow>(rows: T[]): Promise<T[]> {
  const paths = rows.map((r) => r.storage_path).filter((p): p is string => Boolean(p));
  if (paths.length === 0) return rows;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const signed = new Map<string, string>();

  await Promise.all(
    paths.map(async (path) => {
      const { data } = await supabaseAdmin.storage
        .from("generations")
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (data?.signedUrl) signed.set(path, data.signedUrl);
    }),
  );

  return rows.map((row) =>
    row.storage_path && signed.has(row.storage_path)
      ? { ...row, media_url: signed.get(row.storage_path)! }
      : row,
  );
}

type MediaOutcome =
  | { ok: true; bytes: Uint8Array | null; contentType: string; mediaUrl: string | null }
  | { ok: false; error: string };

/** Génération image : Fal.ai (Grok Imagine, repli Flux Schnell). */
async function generateImage(input: GenerationInput): Promise<MediaOutcome> {
  const { isFalConfigured, generateImageWithFal } = await import("@/lib/services/fal.server");
  if (!isFalConfigured()) {
    return { ok: false, error: "Le moteur de génération d'images n'est pas disponible." };
  }
  const result = await generateImageWithFal(input);
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    bytes: result.bytes,
    contentType: result.contentType,
    mediaUrl: result.bytes ? null : result.mediaUrl,
  };
}

/** Génération vidéo : Fal.ai (text-to-video, image-to-video ou montage). */
async function generateVideo(input: GenerationInput): Promise<MediaOutcome> {
  const { isFalConfigured, generateVideoWithFal } = await import("@/lib/services/fal.server");
  if (!isFalConfigured()) {
    return { ok: false, error: "Le moteur de génération vidéo n'est pas disponible." };
  }
  const result = await generateVideoWithFal(input);
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    bytes: result.bytes,
    contentType: result.contentType,
    mediaUrl: result.bytes ? null : result.mediaUrl,
  };
}

export function secondsFor(input: GenerationInput): number {
  if (input.mediaType !== "video") return 2;
  const parsed = Number.parseInt(input.duration, 10);
  return Math.min(6, Number.isFinite(parsed) && parsed > 0 ? parsed : 6);
}

/** Exécute une génération complète pour un utilisateur donné. */
export async function runGeneration(
  userId: string,
  input: GenerationInput,
): Promise<GenerationResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const seconds = secondsFor(input);

  const { data: reserved, error: reserveError } = await supabaseAdmin.rpc("reserve_media_quota", {
    _user_id: userId,
    _media_type: input.mediaType,
  });
  if (reserveError) throw new Error(reserveError.message);

  const row = Array.isArray(reserved) ? reserved[0] : reserved;
  if (!row?.allowed) {
    return {
      ok: false,
      reason: "quota",
      code: (row?.reason ?? "image_daily") as QuotaReason,
      retryAt: row?.retry_at ?? null,
    };
  }

  let debited = true;
  const refund = async () => {
    if (!debited) return;
    debited = false;
    await supabaseAdmin.rpc("refund_media_quota", {
      _user_id: userId,
      _media_type: input.mediaType,
    });
  };

  const persist = async (fields: {
    mediaUrl: string | null;
    storagePath: string | null;
    status: string;
    errorMessage: string | null;
  }) => {
    const { data: inserted } = await supabaseAdmin
      .from("generations")
      .insert({
        user_id: userId,
        prompt: input.prompt,
        media_type: input.mediaType,
        resolution: input.resolution,
        duration: input.duration,
        aspect_ratio: input.aspectRatio,
        media_url: fields.mediaUrl,
        storage_path: fields.storagePath,
        duration_seconds: fields.status === "ready" ? seconds : 0,
        status: fields.status,
        error_message: fields.errorMessage,
      })
      .select("id")
      .single();
    return inserted?.id ?? null;
  };

  try {
    const outcome =
      input.mediaType === "image" ? await generateImage(input) : await generateVideo(input);
    if (!outcome.ok) throw new Error(outcome.error);

    let mediaUrl = outcome.mediaUrl;
    let storagePath: string | null = null;

    if (outcome.bytes) {
      const path = `${userId}/${crypto.randomUUID()}.${extensionFor(outcome.contentType)}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("generations")
        .upload(path, outcome.bytes, { contentType: outcome.contentType });
      if (upErr) throw new Error(upErr.message);

      const { data: signed } = await supabaseAdmin.storage
        .from("generations")
        .createSignedUrl(path, SIGNED_URL_TTL);
      storagePath = path;
      mediaUrl = signed?.signedUrl ?? null;
    }

    if (!mediaUrl) throw new Error("Média indisponible : aucun crédit n'a été débité");

    const id = await persist({ mediaUrl, storagePath, status: "ready", errorMessage: null });

    // Toute création réussie part automatiquement en modération.
    if (id) {
      await supabaseAdmin.from("community_gallery").insert({
        generation_id: id,
        user_id: userId,
        prompt: input.prompt,
        media_type: input.mediaType,
        media_url: mediaUrl,
        storage_path: storagePath,
        status: "en_attente",
      });
    }

    return { ok: true, id, status: "ready", mediaUrl, seconds };
  } catch (error) {
    await refund();
    const message = error instanceof Error ? error.message : "Génération impossible";
    const id = await persist({
      mediaUrl: null,
      storagePath: null,
      status: "error",
      errorMessage: message,
    });
    return { ok: false, reason: "error", message, id };
  }
}

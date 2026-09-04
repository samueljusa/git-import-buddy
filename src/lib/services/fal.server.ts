/**
 * Moteur de génération média Fal.ai (xAI Grok Imagine).
 *
 * Clé serveur uniquement : process.env.FAL_KEY (déjà fournie par l'hébergeur).
 * Aucune clé n'est jamais exposée au navigateur.
 *
 * Endpoints utilisés :
 *  - Image (text-to-image)       : xai/grok-imagine            (fallback fal-ai/flux/schnell)
 *  - Vidéo depuis un prompt      : xai/grok-imagine-video/texte-to-video
 *  - Vidéo depuis une image      : xai/grok-imagine-video/image-to-video
 *  - Retouche / montage vidéo    : xai/grok-imagine-video/edit-video
 */

export const FAL_MODELS = {
  image: "xai/grok-imagine",
  imageFallback: "fal-ai/flux/schnell",
  textToVideo: "xai/grok-imagine-video/texte-to-video",
  imageToVideo: "xai/grok-imagine-video/image-to-video",
  editVideo: "xai/grok-imagine-video/edit-video",
} as const;

export type FalMediaRequest = {
  prompt: string;
  resolution: string;
  duration: string;
  aspectRatio: string;
  /** Image source pour l'image-to-video ou le montage vidéo. */
  imageUrl?: string | null;
  /** Vidéo source pour la retouche / le montage. */
  videoUrl?: string | null;
};

export type FalResult =
  | { ok: true; mediaUrl: string; contentType: string; bytes: Uint8Array | null }
  | { ok: false; error: string };

const QUEUE_BASE = "https://queue.fal.run";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 8 * 60 * 1000;

export function isFalConfigured(): boolean {
  return Boolean(process.env["FAL_KEY"]);
}

function headers(): Record<string, string> {
  return {
    Authorization: `Key ${process.env["FAL_KEY"]}`,
    "Content-Type": "application/json",
  };
}

/** Résolution vidéo autorisée : 480p ou 720p uniquement. */
export function normalizeVideoResolution(res: string): "480p" | "720p" {
  return res === "480p" ? "480p" : "720p";
}

/** Durée vidéo plafonnée à 6 secondes. */
export function normalizeVideoDuration(duration: string): number {
  const parsed = Number.parseInt(duration, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 6;
  return Math.min(6, parsed);
}

function normalizeAspect(ratio: string): string {
  const allowed = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"];
  return allowed.includes(ratio) ? ratio : "9:16";
}

function readError(payload: unknown, status: number, fallback: string): string {
  const obj = payload as { detail?: unknown; error?: unknown; message?: unknown } | null;
  const detail = obj?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof (detail[0] as { msg?: string })?.msg === "string") {
    return (detail[0] as { msg: string }).msg;
  }
  if (typeof obj?.error === "string") return obj.error;
  if (typeof obj?.message === "string") return obj.message;
  return `${fallback} (${status})`;
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 300) };
  }
}

async function download(
  url: string,
  fallbackType: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return {
      bytes: new Uint8Array(buffer),
      contentType: res.headers.get("content-type") ?? fallbackType,
    };
  } catch {
    return null;
  }
}

type FalPayload = {
  images?: { url?: string; content_type?: string }[];
  image?: { url?: string; content_type?: string };
  video?: { url?: string; content_type?: string };
  videos?: { url?: string; content_type?: string }[];
  output?: { url?: string; content_type?: string };
};

function extractMedia(payload: FalPayload, kind: "image" | "video") {
  if (kind === "image") {
    return payload.images?.[0] ?? payload.image ?? payload.output ?? null;
  }
  return payload.video ?? payload.videos?.[0] ?? payload.output ?? null;
}

/** Soumet une requête à la file Fal.ai puis attend le résultat. */
async function runModel(
  model: string,
  input: Record<string, unknown>,
  kind: "image" | "video",
): Promise<FalResult> {
  if (!isFalConfigured()) return { ok: false, error: "Moteur de génération indisponible." };

  let submit: Response;
  try {
    submit = await fetch(`${QUEUE_BASE}/${model}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Appel Fal.ai impossible" };
  }

  const submitJson = (await parseJson(submit)) as {
    request_id?: string;
    status_url?: string;
    response_url?: string;
  } & FalPayload;

  if (!submit.ok) {
    return { ok: false, error: readError(submitJson, submit.status, `Modèle ${model} indisponible`) };
  }

  // Réponse synchrone (certains modèles répondent immédiatement).
  const immediate = extractMedia(submitJson, kind);
  if (!submitJson.request_id && immediate?.url) {
    return finalize(immediate, kind);
  }

  const statusUrl = submitJson.status_url ?? `${QUEUE_BASE}/${model}/requests/${submitJson.request_id}/status`;
  const responseUrl = submitJson.response_url ?? `${QUEUE_BASE}/${model}/requests/${submitJson.request_id}`;
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    let statusRes: Response;
    try {
      statusRes = await fetch(statusUrl, { headers: headers() });
    } catch {
      continue;
    }
    const statusJson = (await parseJson(statusRes)) as { status?: string };
    if (!statusRes.ok) {
      return { ok: false, error: readError(statusJson, statusRes.status, "Suivi de génération échoué") };
    }

    const status = (statusJson.status ?? "").toUpperCase();
    if (status === "COMPLETED") {
      const resultRes = await fetch(responseUrl, { headers: headers() });
      const resultJson = (await parseJson(resultRes)) as FalPayload;
      if (!resultRes.ok) {
        return { ok: false, error: readError(resultJson, resultRes.status, "Résultat indisponible") };
      }
      const media = extractMedia(resultJson, kind);
      if (!media?.url) return { ok: false, error: "Aucun média renvoyé par le moteur." };
      return finalize(media, kind);
    }

    if (status === "FAILED" || status === "ERROR" || status === "CANCELLED") {
      return { ok: false, error: readError(statusJson, 500, `Génération ${status.toLowerCase()}`) };
    }
  }

  return { ok: false, error: "La génération a dépassé le délai d'attente. Réessayez." };
}

async function finalize(
  media: { url?: string; content_type?: string },
  kind: "image" | "video",
): Promise<FalResult> {
  const fallbackType = kind === "video" ? "video/mp4" : "image/jpeg";
  const downloaded = await download(media.url!, media.content_type ?? fallbackType);
  if (!downloaded) return { ok: false, error: "Média généré mais inaccessible." };
  return {
    ok: true,
    mediaUrl: media.url!,
    contentType: downloaded.contentType,
    bytes: downloaded.bytes,
  };
}

/** Image (text-to-image) avec repli automatique sur Flux Schnell. */
export async function generateImageWithFal(req: FalMediaRequest): Promise<FalResult> {
  const primary = await runModel(
    FAL_MODELS.image,
    {
      prompt: req.prompt,
      aspect_ratio: normalizeAspect(req.aspectRatio),
      num_images: 1,
    },
    "image",
  );
  if (primary.ok) return primary;

  const fallback = await runModel(
    FAL_MODELS.imageFallback,
    {
      prompt: req.prompt,
      image_size: aspectToFluxSize(req.aspectRatio),
      num_images: 1,
    },
    "image",
  );
  if (fallback.ok) return fallback;

  return { ok: false, error: `${primary.error} · repli : ${fallback.error}` };
}

function aspectToFluxSize(ratio: string): string {
  switch (normalizeAspect(ratio)) {
    case "16:9":
    case "21:9":
      return "landscape_16_9";
    case "4:3":
    case "3:2":
      return "landscape_4_3";
    case "1:1":
      return "square_hd";
    case "3:4":
    case "2:3":
      return "portrait_4_3";
    default:
      return "portrait_16_9";
  }
}

/** Vidéo depuis un prompt texte (480p/720p, 6 s max). */
export async function generateVideoWithFal(req: FalMediaRequest): Promise<FalResult> {
  const duration = normalizeVideoDuration(req.duration);
  const resolution = normalizeVideoResolution(req.resolution);

  if (req.videoUrl) {
    return runModel(
      FAL_MODELS.editVideo,
      {
        prompt: req.prompt,
        video_url: req.videoUrl,
        resolution,
        duration,
      },
      "video",
    );
  }

  if (req.imageUrl) {
    return runModel(
      FAL_MODELS.imageToVideo,
      {
        prompt: req.prompt,
        image_url: req.imageUrl,
        resolution,
        duration,
        aspect_ratio: normalizeAspect(req.aspectRatio),
      },
      "video",
    );
  }

  return runModel(
    FAL_MODELS.textToVideo,
    {
      prompt: req.prompt,
      resolution,
      duration,
      aspect_ratio: normalizeAspect(req.aspectRatio),
    },
    "video",
  );
}

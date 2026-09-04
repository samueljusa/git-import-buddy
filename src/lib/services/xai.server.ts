/**
 * Service xAI Grok Imagine (images + vidéos réelles).
 *
 * Clés serveur uniquement :
 *  - XAI_API_KEY        (obligatoire)
 *  - XAI_BASE_URL       (optionnel, défaut https://api.x.ai/v1)
 *  - XAI_IMAGE_MODEL    (optionnel, défaut grok-imagine-image-2.0)
 *  - XAI_VIDEO_MODEL    (optionnel, défaut grok-imagine-video-1.5)
 *
 * Vidéo : /v1/videos/generations est asynchrone (request_id + polling sur
 * /v1/videos/{request_id} jusqu'à status "done").
 */

export type XaiMediaRequest = {
  prompt: string;
  resolution: string;
  duration: string;
  aspectRatio: string;
};

export type XaiMediaResult =
  | { ok: true; mediaUrl: string; contentType: string; bytes: Uint8Array | null }
  | { ok: false; error: string; code: "missing_key" | "http" | "empty" | "timeout" };

const DEFAULT_IMAGE_MODEL = "grok-imagine-image-2.0";
const DEFAULT_VIDEO_MODEL = "grok-imagine-video-1.5";

function baseUrl(): string {
  return (process.env["XAI_BASE_URL"] ?? "https://api.x.ai/v1").replace(/\/+$/, "");
}

export function isXaiConfigured(): boolean {
  return Boolean(process.env["XAI_API_KEY"]);
}

export function xaiModels() {
  return {
    image: process.env["XAI_IMAGE_MODEL"] ?? DEFAULT_IMAGE_MODEL,
    video: process.env["XAI_VIDEO_MODEL"] ?? DEFAULT_VIDEO_MODEL,
  };
}

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

function normalizeAspect(ratio: string): string {
  const allowed = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
  return allowed.includes(ratio) ? ratio : "9:16";
}

function normalizeResolution(res: string): "480p" | "720p" | "1080p" {
  return res === "480p" || res === "1080p" ? res : "720p";
}

function errorMessage(json: unknown, status: number, fallback: string): string {
  const obj = json as { error?: unknown; message?: unknown; detail?: unknown } | null;
  const err = obj?.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  if (typeof obj?.message === "string") return obj.message;
  if (typeof obj?.detail === "string") return obj.detail;
  return `${fallback} (${status})`;
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function downloadMedia(
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

/** Génère une image avec Grok Imagine. */
export async function generateImageWithXai(req: XaiMediaRequest): Promise<XaiMediaResult> {
  const apiKey = process.env["XAI_API_KEY"];
  if (!apiKey) return { ok: false, error: "Clé xAI non configurée", code: "missing_key" };

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/images/generations`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        model: xaiModels().image,
        prompt: `${req.prompt}. Format ${normalizeAspect(req.aspectRatio)}, qualité ${req.resolution}.`,
        n: 1,
        aspect_ratio: normalizeAspect(req.aspectRatio),
        response_format: "b64_json",
      }),
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Appel xAI impossible",
      code: "http",
    };
  }

  const text = await res.text();
  let json: {
    data?: { b64_json?: string; url?: string; mime_type?: string }[];
  } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    json = {};
  }

  if (!res.ok) {
    return { ok: false, error: errorMessage(json, res.status, "Grok Imagine a refusé la requête"), code: "http" };
  }

  const item = json.data?.[0];
  if (item?.b64_json) {
    return {
      ok: true,
      mediaUrl: "",
      contentType: item.mime_type ?? "image/jpeg",
      bytes: decodeBase64(item.b64_json),
    };
  }
  if (item?.url) {
    const downloaded = await downloadMedia(item.url, item.mime_type ?? "image/jpeg");
    if (!downloaded) return { ok: false, error: "Image Grok Imagine inaccessible", code: "empty" };
    return { ok: true, mediaUrl: item.url, contentType: downloaded.contentType, bytes: downloaded.bytes };
  }

  return { ok: false, error: "Aucune image renvoyée par Grok Imagine", code: "empty" };
}

/** Génère une vidéo avec Grok Imagine (asynchrone : création puis polling). */
export async function generateVideoWithXai(req: XaiMediaRequest): Promise<XaiMediaResult> {
  const apiKey = process.env["XAI_API_KEY"];
  if (!apiKey) return { ok: false, error: "Clé xAI non configurée", code: "missing_key" };

  const seconds = Math.min(15, Math.max(1, Number.parseInt(req.duration, 10) || 6));

  let createRes: Response;
  try {
    createRes = await fetch(`${baseUrl()}/videos/generations`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        model: xaiModels().video,
        prompt: req.prompt,
        duration: seconds,
        aspect_ratio: normalizeAspect(req.aspectRatio),
        resolution: normalizeResolution(req.resolution),
      }),
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Appel vidéo xAI impossible",
      code: "http",
    };
  }

  const createText = await createRes.text();
  let createJson: { request_id?: string } = {};
  try {
    createJson = JSON.parse(createText) as typeof createJson;
  } catch {
    createJson = {};
  }

  if (!createRes.ok || !createJson.request_id) {
    return {
      ok: false,
      error: errorMessage(createJson, createRes.status, "Génération vidéo refusée"),
      code: "http",
    };
  }

  // Polling : la génération prend généralement 1 à 3 minutes.
  const requestId = createJson.request_id;
  const deadline = Date.now() + 8 * 60 * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 6000));

    let pollRes: Response;
    try {
      pollRes = await fetch(`${baseUrl()}/videos/${requestId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch {
      continue;
    }

    const pollText = await pollRes.text();
    let poll: {
      status?: string;
      video?: { url?: string; mime_type?: string; b64_json?: string };
      error?: unknown;
    } = {};
    try {
      poll = JSON.parse(pollText) as typeof poll;
    } catch {
      poll = {};
    }

    if (!pollRes.ok) {
      return { ok: false, error: errorMessage(poll, pollRes.status, "Suivi de génération vidéo échoué"), code: "http" };
    }

    const status = (poll.status ?? "").toLowerCase();

    if (status === "done" || status === "completed" || status === "succeeded") {
      if (poll.video?.b64_json) {
        return {
          ok: true,
          mediaUrl: "",
          contentType: poll.video.mime_type ?? "video/mp4",
          bytes: decodeBase64(poll.video.b64_json),
        };
      }
      const url = poll.video?.url;
      if (!url) return { ok: false, error: "Vidéo générée mais aucune URL renvoyée", code: "empty" };
      const downloaded = await downloadMedia(url, poll.video?.mime_type ?? "video/mp4");
      if (!downloaded) return { ok: false, error: "Vidéo Grok Imagine inaccessible", code: "empty" };
      return { ok: true, mediaUrl: url, contentType: downloaded.contentType, bytes: downloaded.bytes };
    }

    if (status === "failed" || status === "expired" || status === "error" || status === "canceled") {
      return {
        ok: false,
        error: errorMessage(poll, 500, `Génération vidéo ${status}`),
        code: "http",
      };
    }
  }

  return {
    ok: false,
    error: "La génération vidéo a dépassé le délai d'attente. Réessayez.",
    code: "timeout",
  };
}

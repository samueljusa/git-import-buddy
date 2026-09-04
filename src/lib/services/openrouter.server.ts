/**
 * Service OpenRouter (génération d'images, et vidéo si un modèle vidéo est fourni).
 * Clés serveur uniquement :
 *  - OPENROUTER_API_KEY  (obligatoire)
 *  - OPENROUTER_IMAGE_MODEL (optionnel, défaut: google/gemini-3.1-flash-image)
 *  - OPENROUTER_VIDEO_MODEL (optionnel : aucun modèle vidéo public sur OpenRouter)
 *  - OPENROUTER_SITE_URL / OPENROUTER_APP_NAME (optionnel, attribution OpenRouter)
 * Jamais exposées au frontend, jamais préfixées VITE_.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image";

export type OpenRouterMediaRequest = {
  prompt: string;
  resolution: string;
  duration: string;
  aspectRatio: string;
  model?: string;
};

export type OpenRouterMediaResult =
  | { ok: true; mediaUrl: string; contentType: string; bytes: Uint8Array | null }
  | { ok: false; error: string; code: "missing_key" | "http" | "empty" | "unsupported" };

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env["OPENROUTER_API_KEY"]);
}

export function isOpenRouterVideoConfigured(): boolean {
  return Boolean(process.env["OPENROUTER_API_KEY"] && process.env["OPENROUTER_VIDEO_MODEL"]);
}

function headers(apiKey: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  // Attribution OpenRouter (recommandée, évite les rejets côté passerelle).
  const site = process.env["OPENROUTER_SITE_URL"];
  if (site) h["HTTP-Referer"] = site;
  h["X-Title"] = process.env["OPENROUTER_APP_NAME"] ?? "Sam flash 2.0";
  return h;
}

type ChatResponse = {
  error?: { message?: string };
  choices?: {
    message?: {
      content?: string | { type?: string; text?: string; image_url?: { url?: string } }[];
      images?: { type?: string; image_url?: { url?: string } }[];
    };
  }[];
};

/** Extrait la première URL (ou data URL) de média d'une réponse OpenRouter. */
function extractMediaUrl(json: ChatResponse): string | null {
  const message = json.choices?.[0]?.message;
  if (!message) return null;

  const fromImages = message.images?.[0]?.image_url?.url;
  if (fromImages) return fromImages;

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      const url = part?.image_url?.url;
      if (url) return url;
    }
  }

  if (typeof message.content === "string") {
    const match = message.content.match(/(data:(?:image|video)\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+)/i)
      ?? message.content.match(/(https?:\/\/\S+\.(?:png|jpe?g|webp|mp4|webm))/i);
    if (match) return match[1] ?? null;
  }

  return null;
}

function decodeDataUrl(url: string): { contentType: string; bytes: Uint8Array } | null {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const base64 = match[2] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { contentType: match[1] ?? "application/octet-stream", bytes };
}

async function callOpenRouter(
  model: string,
  prompt: string,
  modalities: string[],
): Promise<OpenRouterMediaResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) return { ok: false, error: "Clé OpenRouter non configurée", code: "missing_key" };

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        model,
        modalities,
        // Obligatoire : sans plafond, OpenRouter estime le coût maximal du modèle
        // et rejette la requête en 402 « Insufficient credits ».
        max_tokens: Number.parseInt(process.env["OPENROUTER_MAX_TOKENS"] ?? "4096", 10),
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      }),
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Appel OpenRouter impossible",
      code: "http",
    };
  }

  const text = await res.text();
  let json: ChatResponse = {};
  try {
    json = JSON.parse(text) as ChatResponse;
  } catch {
    json = {};
  }

  if (!res.ok) {
    return {
      ok: false,
      error: json.error?.message ?? `OpenRouter a refusé la requête (${res.status})`,
      code: "http",
    };
  }

  const url = extractMediaUrl(json);
  if (!url) {
    return { ok: false, error: "Aucun média renvoyé par le modèle", code: "empty" };
  }

  const decoded = decodeDataUrl(url);
  return {
    ok: true,
    mediaUrl: url,
    contentType: decoded?.contentType ?? (modalities.includes("video") ? "video/mp4" : "image/png"),
    bytes: decoded?.bytes ?? null,
  };
}

/** Modèles image essayés dans l'ordre (le modèle configuré passe en premier). */
export function imageModelChain(preferred?: string): string[] {
  const chain = [
    preferred,
    process.env["OPENROUTER_IMAGE_MODEL"],
    DEFAULT_IMAGE_MODEL,
    "google/gemini-3-pro-image",
    "openai/gpt-5-image-mini",
  ].filter((m): m is string => Boolean(m));
  return [...new Set(chain)];
}

/**
 * Génère une image via OpenRouter.
 * Les modèles sont essayés en cascade : si le modèle demandé n'est pas servi par
 * OpenRouter (c'est le cas de Grok Imagine, absent du catalogue OpenRouter),
 * on bascule automatiquement sur un modèle image disponible.
 */
export async function generateImageWithOpenRouter(
  req: OpenRouterMediaRequest,
): Promise<OpenRouterMediaResult> {
  const prompt = `${req.prompt}. Image strictement au format ${req.aspectRatio} (ratio largeur:hauteur exact, sans bandes ni recadrage), qualité ${req.resolution}, rendu photoréaliste soigné.`;
  const errors: string[] = [];

  for (const model of imageModelChain(req.model)) {
    const result = await callOpenRouter(model, prompt, ["image", "text"]);
    if (result.ok) return result;
    errors.push(`${model} : ${result.error}`);
    if (result.code === "missing_key") break;
  }

  return { ok: false, error: errors.join(" · ") || "Aucun modèle image disponible", code: "http" };
}

/**
 * Génère une vidéo via OpenRouter.
 * OpenRouter n'expose aucun modèle vidéo public : sans OPENROUTER_VIDEO_MODEL,
 * on renvoie `unsupported` (aucun crédit n'est débité côté appelant).
 */
export function generateVideoWithOpenRouter(
  req: OpenRouterMediaRequest,
): Promise<OpenRouterMediaResult> {
  const model = req.model ?? process.env["OPENROUTER_VIDEO_MODEL"];
  if (!model) {
    return Promise.resolve({
      ok: false as const,
      error:
        "La génération vidéo n'est pas encore disponible sur cette passerelle (aucun modèle vidéo configuré).",
      code: "unsupported" as const,
    });
  }
  const prompt = `${req.prompt}. Vidéo de ${req.duration}, ${req.resolution}, format ${req.aspectRatio}.`;
  return callOpenRouter(model, prompt, ["video", "text"]);
}

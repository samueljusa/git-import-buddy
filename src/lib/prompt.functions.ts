import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type EnhanceInput = {
  prompt: string;
  mediaType: "image" | "video";
  language?: string;
};

const SYSTEM = `Tu es un directeur artistique expert en prompts pour la génération vidéo/image par IA (Grok Imagine).
Transforme l'idée simple de l'utilisateur en UN SEUL prompt riche, cinématographique et prêt à l'emploi.
Le prompt doit décrire, en prose fluide et dense (80 à 140 mots) :
- les détails visuels de la scène (sujet, décor, textures, palette, style) ;
- le mouvement de caméra (travelling, plan drone, ralenti, focale, profondeur de champ) ;
- l'éclairage et l'ambiance (heure dorée, néons, contre-jour, brume, contraste) ;
- pour la vidéo : une section audio explicite décrivant les effets sonores et l'ambiance
  (ex. rugissement de moteur, pluie sur le métal, basses cinématographiques, souffle du vent).
Règles : réponds UNIQUEMENT par le prompt final, sans guillemets, sans titre, sans liste à puces,
sans commentaire ni explication. Écris dans la langue de l'utilisateur.`;

export const enhancePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EnhanceInput) => {
    if (!input?.prompt?.trim()) throw new Error("Prompt requis");
    return {
      prompt: input.prompt.trim().slice(0, 1200),
      mediaType: input.mediaType === "image" ? ("image" as const) : ("video" as const),
      language: String(input.language ?? "fr").slice(0, 8),
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, message: "Optimisation indisponible" };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Type de média : ${data.mediaType === "video" ? "vidéo" : "image"}. Langue de réponse : ${data.language}.\nIdée : ${data.prompt}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return { ok: false as const, message: "Trop de requêtes, réessayez" };
      if (res.status === 402) return { ok: false as const, message: "Crédits IA épuisés" };
      return { ok: false as const, message: "Optimisation impossible" };
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false as const, message: "Optimisation impossible" };
    return { ok: true as const, prompt: text.replace(/^["'«»\s]+|["'«»\s]+$/g, "") };
  });

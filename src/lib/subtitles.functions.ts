import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `Tu écris des sous-titres au format WebVTT pour une courte vidéo générée par IA.
À partir de la description de la scène et de sa durée, produis 3 à 6 cues courtes (max 8 mots),
réparties régulièrement sur toute la durée, décrivant l'action ou la narration.
Réponds UNIQUEMENT par un fichier WebVTT valide commençant par la ligne "WEBVTT",
avec des timestamps au format 00:00:00.000 --> 00:00:02.500. Aucun commentaire.`;

/** Génère une piste de sous-titres WebVTT pour une création vidéo de l'utilisateur. */
export const generateSubtitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; language?: string }) => {
    if (!input?.id) throw new Error("Identifiant manquant");
    return { id: String(input.id), language: String(input.language ?? "fr").slice(0, 8) };
  })
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("generations")
      .select("prompt, duration, media_type")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!row) return { ok: false as const, message: "Création introuvable" };
    if (row.media_type !== "video") return { ok: false as const, message: "Vidéo requise" };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, message: "Sous-titres indisponibles" };

    const seconds = Number.parseInt(String(row.duration ?? "6"), 10) || 6;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Durée : ${seconds} secondes. Langue des sous-titres : ${data.language}.\nScène : ${row.prompt}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return { ok: false as const, message: "Trop de requêtes, réessayez" };
      if (res.status === 402) return { ok: false as const, message: "Crédits IA épuisés" };
      return { ok: false as const, message: "Sous-titres impossibles" };
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    const vtt = raw.replace(/^```(?:vtt|text)?\s*|\s*```$/g, "").trim();
    if (!vtt.toUpperCase().startsWith("WEBVTT")) {
      return { ok: false as const, message: "Sous-titres impossibles" };
    }
    return { ok: true as const, vtt };
  });

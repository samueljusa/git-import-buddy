import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_generation",
  title: "Créer une génération",
  description:
    "Enregistre une nouvelle demande de génération (prompt, type de média, résolution, durée, ratio) pour le compte connecté.",
  inputSchema: {
    prompt: z.string().trim().describe("Description de l'image ou de la vidéo à créer."),
    media_type: z.enum(["image", "video"]).describe("Type de média demandé."),
    resolution: z.enum(["480p", "720p", "1080p"]).optional().describe("Résolution souhaitée."),
    duration: z.enum(["6s", "10s"]).optional().describe("Durée pour une vidéo."),
    aspect_ratio: z.enum(["2:3", "1:1", "16:9"]).optional().describe("Format d'image."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    if (!input.prompt) {
      return { content: [{ type: "text", text: "Le prompt est vide." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("generations")
      .insert({
        user_id: ctx.getUserId(),
        prompt: input.prompt,
        media_type: input.media_type,
        resolution: input.resolution ?? "720p",
        duration: input.duration ?? (input.media_type === "video" ? "6s" : null),
        aspect_ratio: input.aspect_ratio ?? "2:3",
      })
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { generation: data },
    };
  },
});

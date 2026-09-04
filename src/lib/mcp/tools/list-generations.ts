import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_generations",
  title: "Lister mes générations",
  description: "Liste les générations (images/vidéos) du compte connecté, les plus récentes d'abord.",
  inputSchema: {
    limit: z.number().int().optional().describe("Nombre maximum de résultats (défaut 20, max 100)."),
    media_type: z.enum(["image", "video"]).optional().describe("Filtrer par type de média."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, media_type }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("generations")
      .select("id, prompt, media_type, resolution, duration, aspect_ratio, media_url, created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (media_type) query = query.eq("media_type", media_type);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { generations: data ?? [] },
    };
  },
});

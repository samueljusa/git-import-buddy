import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_profile",
  title: "Mettre à jour mon profil",
  description: "Met à jour le nom complet du compte connecté.",
  inputSchema: {
    full_name: z.string().trim().describe("Nouveau nom complet."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ full_name }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié." }], isError: true };
    }
    if (!full_name) {
      return { content: [{ type: "text", text: "Le nom est vide." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name })
      .eq("id", ctx.getUserId())
      .select("id, email, full_name, credits_balance")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { profile: data },
    };
  },
});

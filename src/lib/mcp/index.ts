import { auth, defineMcp } from "@lovable.dev/mcp-js";

import getProfileTool from "./tools/get-profile";
import updateProfileTool from "./tools/update-profile";
import listGenerationsTool from "./tools/list-generations";
import createGenerationTool from "./tools/create-generation";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "sam-flash-interface",
  title: "Sam Flash Interface",
  version: "0.1.0",
  instructions:
    "Outils Sam flash 2.0 : consulter et mettre à jour le profil de l'utilisateur connecté, lister ses générations d'images/vidéos et enregistrer une nouvelle demande de génération.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfileTool, updateProfileTool, listGenerationsTool, createGenerationTool] as never,
});

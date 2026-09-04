import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type CommunityItem = {
  id: string;
  prompt: string;
  media_type: string;
  media_url: string | null;
  created_at: string;
};

export type ModerationItem = CommunityItem & {
  status: string;
  rejection_reason: string | null;
  generation_id: string | null;
};

const SIGNED_URL_TTL = 60 * 60 * 6;

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Les URL signées expirent : on les régénère à partir du chemin de stockage. */
async function withFreshMedia<T extends { media_url: string | null; storage_path?: string | null }>(
  rows: T[],
): Promise<T[]> {
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

type RoleReader = {
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => PromiseLike<{ data: { role: string }[] | null }>;
      };
    };
  };
  userId: string;
};

async function assertStaff(context: unknown) {
  const ctx = context as RoleReader;
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  const allowed = (data ?? []).some((r) => r.role === "admin" || r.role === "moderator");
  if (!allowed) throw new Error("Accès refusé");
}

/** Galerie publique : uniquement les créations approuvées par la modération. */
export const listCommunityGallery = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("community_gallery")
    .select("id, prompt, media_type, media_url, storage_path, created_at")
    .eq("status", "approuve")
    .order("created_at", { ascending: false })
    .limit(60);
  const rows = await withFreshMedia(data ?? []);
  return rows.map(({ storage_path: _p, ...item }) => item) as CommunityItem[];
});

/** Indique si l'utilisateur connecté est administrateur / modérateur. */
export const getModerationAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as string);
    return { isAdmin: roles.includes("admin"), isModerator: roles.includes("moderator") };
  });

/** Renvoie une création rejetée dans la file de modération. */
export const submitToGallery = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; consent: boolean }) => {
    if (!input?.id) throw new Error("Création introuvable");
    if (!input.consent) throw new Error("Consentement requis");
    return { id: String(input.id) };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("community_gallery")
      .update({ status: "en_attente", rejection_reason: null })
      .eq("generation_id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** File de modération : toutes les créations, quel que soit leur statut. */
export const listModerationQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data } = await context.supabase
      .from("community_gallery")
      .select("id, prompt, media_type, media_url, storage_path, created_at, status, rejection_reason, generation_id")
      .order("created_at", { ascending: false })
      .limit(120);
    const rows = await withFreshMedia(data ?? []);
    return rows.map(({ storage_path: _p, ...item }) => item) as ModerationItem[];
  });

/** Publie ou rejette une création soumise à la galerie. */
export const moderateGeneration = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; action: "approve" | "reject"; reason?: string }) => {
    if (!input?.id) throw new Error("Création introuvable");
    return {
      id: String(input.id),
      action: input.action === "approve" ? ("approve" as const) : ("reject" as const),
      reason: input.reason ? String(input.reason).slice(0, 500) : null,
    };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const approve = data.action === "approve";
    const { error } = await context.supabase
      .from("community_gallery")
      .update({
        status: approve ? "approuve" : "rejete",
        rejection_reason: approve ? null : (data.reason ?? "Contenu inapproprié"),
        moderated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Supprime définitivement une création de la galerie. */
export const deleteGalleryItem = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Création introuvable");
    return { id: String(input.id) };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await context.supabase.from("community_gallery").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

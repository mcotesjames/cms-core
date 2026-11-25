import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/**
 * Unpublished drafts are only readable by approved admins: the `draft` columns are not
 * selectable by visitors or signed-in users, so admin screens read them through these
 * admin-checked database functions.
 */
export async function fetchSiteDrafts(): Promise<Record<string, Json>> {
  const { data, error } = await supabase.rpc("admin_site_drafts");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.draft]));
}

export async function fetchPostDrafts(): Promise<Record<string, Json>> {
  const { data, error } = await supabase.rpc("admin_post_drafts");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.id, r.draft]));
}

type SiteRowFields = { content?: unknown; draft?: unknown; updated_at?: string };

/**
 * Writes a site_content row, creating it first if it doesn't exist. Never use `.upsert()` with
 * `draft` on this table: Postgres requires SELECT on every column an ON CONFLICT DO UPDATE sets,
 * and `draft` isn't selectable, so it fails with "permission denied for table site_content".
 * An insert that ignores duplicates followed by an update needs no SELECT on `draft`.
 */
export async function saveSiteRow(key: string, fields: SiteRowFields) {
  const created = await supabase
    .from("site_content")
    .upsert({ key, ...fields } as never, { onConflict: "key", ignoreDuplicates: true });
  if (created.error) return { error: created.error };
  const { error } = await supabase
    .from("site_content")
    .update(fields as never)
    .eq("key", key);
  return { error };
}

/** Live columns of every page row, each with its draft (or null). */
export async function fetchSiteRows(key?: string) {
  let q = supabase.from("site_content").select("key, content");
  if (key) q = q.eq("key", key);
  const [rows, drafts] = await Promise.all([q, fetchSiteDrafts()]);
  if (rows.error) throw rows.error;
  return (rows.data ?? []).map((r) => ({ ...r, draft: (drafts[r.key] ?? null) as Json | null }));
}

/** Every post column admins edit, live plus draft. */
export const ADMIN_POST_COLUMNS =
  "id, slug, title, excerpt, body, cover_url, published, published_at, created_at, modules, author, seo";

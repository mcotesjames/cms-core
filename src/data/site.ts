/**
 * Studio functions for site_content rows (pages, settings, menus, the `pages` index). Visitors
 * read live content through content.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { asEditor } from "./access";
import type { JsonObject } from "./shapes";

export type SiteRow = { key: string; content: JsonObject; draft: JsonObject | null };

const doc = z.record(z.string(), z.any());

async function load() {
  const { db, nowIso } = await import("./db.server");
  const schema = await import("./schema");
  return { d: await db(), nowIso, ...schema };
}

/** Live content and draft of one row (or every row). A missing row returns nothing. */
export const getSiteRows = createServerFn({ method: "GET" })
  .middleware([asEditor])
  .inputValidator(z.object({ key: z.string().optional() }))
  .handler(async ({ data }): Promise<SiteRow[]> => {
    const { d, siteContent } = await load();
    const q = d.select().from(siteContent);
    const rows = await (data.key ? q.where(eq(siteContent.key, data.key)) : q);
    return rows.map((r) => ({ key: r.key, content: r.data, draft: r.draft ?? null }));
  });

/**
 * Writes the given fields of a row, creating it if it doesn't exist. `content` is the live
 * content (only Settings screens and publishing write it); `draft: null` clears the draft.
 */
export const saveSiteRow = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(
    z.object({ key: z.string().min(1), content: doc.optional(), draft: doc.nullable().optional() }),
  )
  .handler(async ({ data }) => {
    const { d, siteContent, nowIso } = await load();
    // `updated_at` records when the live content last changed (the edge cache keys on it), so
    // draft-only saves leave it alone.
    const set: Partial<typeof siteContent.$inferInsert> = {};
    if (data.content !== undefined) {
      set.data = data.content as JsonObject;
      set.updatedAt = nowIso();
    }
    if (data.draft !== undefined) set.draft = (data.draft ?? null) as JsonObject | null;
    if (Object.keys(set).length === 0) return { ok: true };
    await d
      .insert(siteContent)
      .values({ key: data.key, data: {}, ...set })
      .onConflictDoUpdate({ target: siteContent.key, set });
    return { ok: true };
  });

/**
 * Publishes a row: `doc` (the editor's copy) becomes live and the draft is cleared. Keys in
 * `keep` are owned elsewhere (e.g. a page's `seo`, written by its Settings) and keep their
 * live values.
 */
export const publishSiteRow = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ key: z.string().min(1), doc, keep: z.array(z.string()).default([]) }))
  .handler(async ({ data }) => {
    const { d, siteContent, nowIso } = await load();
    const [row] = await d.select().from(siteContent).where(eq(siteContent.key, data.key)).limit(1);
    const live = row?.data ?? {};
    const next: JsonObject = { ...(data.doc as JsonObject) };
    for (const k of data.keep) {
      if (k in live) next[k] = live[k]!;
      else delete next[k];
    }
    const set = { data: next, draft: null, updatedAt: nowIso() };
    await d
      .insert(siteContent)
      .values({ key: data.key, ...set })
      .onConflictDoUpdate({ target: siteContent.key, set });
    return { ok: true };
  });

/** Drops a row's draft and returns its live content. */
export const discardSiteDraft = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ key: z.string().min(1) }))
  .handler(async ({ data }): Promise<JsonObject> => {
    const { d, siteContent } = await load();
    const [row] = await d
      .update(siteContent)
      .set({ draft: null })
      .where(eq(siteContent.key, data.key))
      .returning({ data: siteContent.data });
    return row?.data ?? {};
  });

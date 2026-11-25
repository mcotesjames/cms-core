/**
 * Public reads of live content: what visitors see. Every function here is `asVisitor` and reads
 * only live columns, never `draft`.
 */
import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { asVisitor } from "./access";
import {
  INSIGHT,
  RECORD_TYPES,
  toListItem,
  toPost,
  toRecord,
  type JsonObject,
  type ListItem,
  type Post,
  type RecordItem,
} from "./shapes";

/** Live content of every site_content row, keyed by row (`home`, `settings`, `page_…`). */
export const getSiteContent = createServerFn({ method: "GET" })
  .middleware([asVisitor])
  .handler(async (): Promise<Record<string, JsonObject>> => {
    const { db } = await import("./db.server");
    const { siteContent } = await import("./schema");
    const rows = await (
      await db()
    )
      .select({ key: siteContent.key, data: siteContent.data })
      .from(siteContent);
    return Object.fromEntries(rows.map((r) => [r.key, r.data]));
  });

/** The published items of every section list (pillars, cards, hotspots), in order. */
export const getListItems = createServerFn({ method: "GET" })
  .middleware([asVisitor])
  .handler(async (): Promise<Record<string, ListItem[]>> => {
    const { db } = await import("./db.server");
    const { listItems } = await import("./schema");
    const rows = await (
      await db()
    )
      .select()
      .from(listItems)
      .orderBy(asc(listItems.list), asc(listItems.position));
    const out: Record<string, ListItem[]> = {};
    for (const r of rows) (out[r.list] ??= []).push(toListItem(r));
    return out;
  });

/** Published insights, newest first. */
export const getPublishedPosts = createServerFn({ method: "GET" })
  .middleware([asVisitor])
  .handler(async (): Promise<Post[]> => {
    const { db } = await import("./db.server");
    const { entries } = await import("./schema");
    const rows = await (
      await db()
    )
      .select()
      .from(entries)
      .where(and(eq(entries.type, INSIGHT), eq(entries.published, true)))
      .orderBy(desc(entries.publishedAt));
    return rows.map((r) => ({ ...toPost({ ...r, draft: null }) }));
  });

/** One published insight by its address, or null. */
export const getPostBySlug = createServerFn({ method: "GET" })
  .middleware([asVisitor])
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }): Promise<Post | null> => {
    const { db } = await import("./db.server");
    const { entries } = await import("./schema");
    const [row] = await (
      await db()
    )
      .select()
      .from(entries)
      .where(
        and(eq(entries.type, INSIGHT), eq(entries.slug, data.slug), eq(entries.published, true)),
      )
      .limit(1);
    return row ? toPost({ ...row, draft: null }) : null;
  });

/** Every record of a type, in its stored order (callers sort as their type requires). */
export const getRecords = createServerFn({ method: "GET" })
  .middleware([asVisitor])
  .inputValidator(z.object({ table: z.enum(["investments", "publications"]) }))
  .handler(async ({ data }): Promise<RecordItem[]> => {
    const { db } = await import("./db.server");
    const { records } = await import("./schema");
    const rows = await (
      await db()
    )
      .select()
      .from(records)
      .where(eq(records.type, RECORD_TYPES[data.table]))
      .orderBy(asc(records.position));
    return rows.map((r) => toRecord({ ...r, draft: null }));
  });

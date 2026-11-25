/**
 * The shapes the site and Studio work with, and how stored rows map onto them. The tables are
 * generic (entries / records / list_items, spec section 2); these keep the components' shapes
 * stable while storage changes underneath.
 */
import type { entries, listItems, records } from "./schema";

/** Any JSON value: what server functions may return and what JSON columns hold. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

type EntryRow = typeof entries.$inferSelect;
type RecordRow = typeof records.$inferSelect;
type ListItemRow = typeof listItems.$inferSelect;

/** Content type keys in `entries.type`. */
export const INSIGHT = "insight";
/** Record type keys in `records.type`. */
export const RECORD_TYPES = { investments: "investment", publications: "publication" } as const;
export type RecordTable = keyof typeof RECORD_TYPES;

/** An insight as the site reads it (live columns only). */
export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_url: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
  modules: Json;
  author: string;
  seo: Json;
};

export const toPost = (r: EntryRow): Post => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  excerpt: r.standfirst,
  body: r.legacyBody,
  cover_url: r.cover,
  published: r.published,
  published_at: r.publishedAt,
  created_at: r.createdAt,
  modules: r.blocks as Json,
  author: r.author,
  seo: (r.seo ?? null) as Json,
});

/** Post fields → entry columns (only the fields given). */
export function fromPost(p: Partial<Post>): Partial<EntryRow> {
  const out: Partial<EntryRow> = {};
  if (p.slug !== undefined) out.slug = p.slug;
  if (p.title !== undefined) out.title = p.title;
  if (p.excerpt !== undefined) out.standfirst = p.excerpt;
  if (p.body !== undefined) out.legacyBody = p.body;
  if (p.cover_url !== undefined) out.cover = p.cover_url;
  if (p.published !== undefined) out.published = p.published;
  if (p.published_at !== undefined) out.publishedAt = p.published_at;
  if (p.modules !== undefined) out.blocks = (p.modules ?? []) as Json[];
  if (p.author !== undefined) out.author = p.author;
  if (p.seo !== undefined) out.seo = (p.seo ?? null) as JsonObject | null;
  return out;
}

/** A record as a flat row: its fields plus `id` (and `sort` = position). */
export type RecordItem = { id: string; sort: number } & JsonObject;
export const toRecord = (r: RecordRow): RecordItem => ({ ...r.data, id: r.id, sort: r.position });

/** A list item as a flat row: its fields plus `id` and `sort` (= position). */
export type ListItem = { id: string; sort: number } & JsonObject;
export const toListItem = (r: ListItemRow): ListItem => ({ ...r.data, id: r.id, sort: r.position });

/** Splits a flat row back into stored fields (dropping `id` and `sort`). */
export function rowData(row: Record<string, unknown>): JsonObject {
  const { id: _id, sort: _sort, ...data } = row;
  return data as JsonObject;
}

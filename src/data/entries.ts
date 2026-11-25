/**
 * Studio functions for content entries (insights): live columns plus `draft`. Field ownership
 * (spec section 5 → Page settings): the editor's Publish writes only the content it edits
 * (title, standfirst, cover, blocks); Settings is the only writer of author, publish date,
 * address and SEO, and saves them live (and into any open draft).
 */
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { asEditor } from "./access";
import { INSIGHT, toPost, type JsonObject, type Post } from "./shapes";

export type StudioPost = Post & { draft: JsonObject | null };

const byId = z.object({ id: z.string() });
const SLUG_TAKEN = "Another insight already uses this web address.";

async function load() {
  const { db, newId, nowIso } = await import("./db.server");
  const { entries } = await import("./schema");
  return { d: await db(), entries, newId, nowIso };
}

/** Runs a write, turning D1's unique-address failure into the message editors see. */
async function slugSafe(write: PromiseLike<unknown>) {
  try {
    await write;
  } catch (e) {
    const msg = e instanceof Error ? `${e.message} ${String(e.cause ?? "")}` : String(e);
    if (/UNIQUE constraint failed/i.test(msg)) throw new Error(SLUG_TAKEN);
    throw e;
  }
}

/** Every insight with its draft, unpublished first, then newest. */
export const listStudioPosts = createServerFn({ method: "GET" })
  .middleware([asEditor])
  .handler(async (): Promise<StudioPost[]> => {
    const { d, entries } = await load();
    const rows = await d
      .select()
      .from(entries)
      .where(eq(entries.type, INSIGHT))
      .orderBy(sql`${entries.publishedAt} IS NOT NULL`, desc(entries.publishedAt));
    return rows.map((r) => ({ ...toPost(r), draft: r.draft ?? null }));
  });

export const getStudioPost = createServerFn({ method: "GET" })
  .middleware([asEditor])
  .inputValidator(byId)
  .handler(async ({ data }): Promise<StudioPost | null> => {
    const { d, entries } = await load();
    const [r] = await d
      .select()
      .from(entries)
      .where(and(eq(entries.type, INSIGHT), eq(entries.id, data.id)))
      .limit(1);
    return r ? { ...toPost(r), draft: r.draft ?? null } : null;
  });

/** A new, unpublished insight with one empty text block. */
export const createPost = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ firstBlockId: z.string() }))
  .handler(async ({ data }) => {
    const { d, entries, newId } = await load();
    const id = newId();
    await d.insert(entries).values({
      id,
      type: INSIGHT,
      title: "Untitled insight",
      slug: `untitled-${Date.now().toString(36)}`,
      blocks: [{ id: data.firstBlockId, type: "rich_text", body: "" }],
    });
    return { id };
  });

/** An unpublished copy of an insight's live content, with a free address. */
export const duplicatePost = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(byId)
  .handler(async ({ data }) => {
    const { d, entries, newId } = await load();
    const [src] = await d.select().from(entries).where(eq(entries.id, data.id)).limit(1);
    if (!src) throw new Error("That insight no longer exists.");
    const id = newId();
    await d.insert(entries).values({
      ...src,
      id,
      title: `${src.title} (copy)`,
      slug: `${src.slug}-copy-${Date.now().toString(36)}`,
      published: false,
      draft: null,
      createdAt: undefined,
      updatedAt: undefined,
    });
    return { id };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(byId)
  .handler(async ({ data }) => {
    const { d, entries } = await load();
    await d.delete(entries).where(and(eq(entries.type, INSIGHT), eq(entries.id, data.id)));
    return { ok: true };
  });

export const savePostDraft = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ id: z.string(), draft: z.record(z.string(), z.any()) }))
  .handler(async ({ data }) => {
    const { d, entries, nowIso } = await load();
    await d
      .update(entries)
      .set({ draft: data.draft as JsonObject, updatedAt: nowIso() })
      .where(eq(entries.id, data.id));
    return { ok: true };
  });

/**
 * Publishes the editor's content. Author, date, address and SEO keep their live values (owned by
 * Settings); the publish date is set on the first publish if Settings left it empty.
 */
export const publishPost = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(
    z.object({
      id: z.string(),
      title: z.string(),
      excerpt: z.string(),
      cover_url: z.string(),
      modules: z.array(z.any()),
    }),
  )
  .handler(async ({ data }) => {
    const { d, entries, nowIso } = await load();
    const [cur] = await d
      .select({ publishedAt: entries.publishedAt })
      .from(entries)
      .where(eq(entries.id, data.id))
      .limit(1);
    if (!cur) throw new Error("That insight no longer exists.");
    const published_at = cur.publishedAt ?? nowIso();
    await slugSafe(
      d
        .update(entries)
        .set({
          title: data.title,
          standfirst: data.excerpt,
          cover: data.cover_url,
          blocks: data.modules,
          publishedAt: published_at,
          published: true,
          draft: null,
          updatedAt: nowIso(),
        })
        .where(eq(entries.id, data.id)),
    );
    return { published_at };
  });

export const unpublishPost = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(byId)
  .handler(async ({ data }) => {
    const { d, entries, nowIso } = await load();
    await d
      .update(entries)
      .set({ published: false, updatedAt: nowIso() })
      .where(eq(entries.id, data.id));
    return { ok: true };
  });

export const discardPostDraft = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(byId)
  .handler(async ({ data }) => {
    const { d, entries } = await load();
    await d.update(entries).set({ draft: null }).where(eq(entries.id, data.id));
    return { ok: true };
  });

/** Settings: author, publish date, address and SEO go live now, and into any open draft. */
export const savePostSettings = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(
    z.object({
      id: z.string(),
      author: z.string(),
      published_at: z.string().nullable(),
      slug: z.string().min(1),
      seo: z.record(z.string(), z.any()),
    }),
  )
  .handler(async ({ data }) => {
    const { d, entries, nowIso } = await load();
    const [cur] = await d.select().from(entries).where(eq(entries.id, data.id)).limit(1);
    if (!cur) throw new Error("That insight no longer exists.");
    const values = {
      author: data.author,
      published_at: data.published_at,
      slug: data.slug,
      seo: data.seo as JsonObject,
    };
    await slugSafe(
      d
        .update(entries)
        .set({
          author: data.author,
          publishedAt: data.published_at,
          slug: data.slug,
          seo: data.seo as JsonObject,
          ...(cur.draft ? { draft: { ...cur.draft, ...values } } : {}),
          updatedAt: nowIso(),
        })
        .where(eq(entries.id, data.id)),
    );
    return { ok: true };
  });

/** Drafts of every insight that has one, keyed by id. */
export const listPostDrafts = createServerFn({ method: "GET" })
  .middleware([asEditor])
  .handler(async (): Promise<Record<string, JsonObject>> => {
    const { d, entries } = await load();
    const rows = await d
      .select({ id: entries.id, draft: entries.draft })
      .from(entries)
      .where(and(eq(entries.type, INSIGHT), sql`${entries.draft} IS NOT NULL`));
    return Object.fromEntries(rows.map((r) => [r.id, r.draft!]));
  });

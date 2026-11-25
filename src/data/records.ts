/**
 * Records (spec: Core scope → Records). Studio functions edit drafts, publish, reorder and delete;
 * visitors read only published, live data (`getPublishedRecords`, never `draft`).
 *
 * `published_at` changes only when live content changes (publish, reorder, delete), so the edge
 * cache's content version — which includes the latest one — never moves on a draft save.
 */
import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, isNull, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { asEditor, asVisitor } from "./access";
import type { Json, JsonObject } from "./shapes";

const doc = z.record(z.string(), z.any());

async function load() {
  const { db, nowIso } = await import("./db.server");
  const schema = await import("./schema");
  return { d: await db(), nowIso, ...schema };
}

export type RecordRow = {
  id: string;
  type: string;
  data: JsonObject;
  draft: JsonObject | null;
  position: number;
  publishedAt: string | null;
};

/** A type's records (not deleted), drafts included, in position order. */
export const listRecords = createServerFn({ method: "GET" })
  .middleware([asEditor])
  .inputValidator(z.object({ type: z.string().optional() }))
  .handler(async ({ data }): Promise<RecordRow[]> => {
    const { d, records } = await load();
    const rows = await d
      .select()
      .from(records)
      .where(
        data.type
          ? and(eq(records.type, data.type), isNull(records.deletedAt))
          : isNull(records.deletedAt),
      )
      .orderBy(asc(records.position));
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      data: r.data,
      draft: r.draft ?? null,
      position: r.position,
      publishedAt: r.publishedAt ?? null,
    }));
  });

/** Saves a record's draft, creating the record (at the end of its list) if it's new. */
export const saveRecordDraft = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ id: z.string().min(1), type: z.string().min(1), draft: doc }))
  .handler(async ({ data }) => {
    const { recordType } = await import("@/lib/records");
    if (!recordType(data.type)) throw new Error("Unknown record type.");
    const { d, records, nowIso } = await load();
    const [existing] = await d
      .select({ id: records.id })
      .from(records)
      .where(eq(records.id, data.id));
    if (existing) {
      await d
        .update(records)
        .set({ draft: data.draft as JsonObject, updatedAt: nowIso() })
        .where(eq(records.id, data.id));
    } else {
      const last = await d
        .select({ position: records.position })
        .from(records)
        .where(eq(records.type, data.type));
      const position = last.reduce((m, r) => Math.max(m, r.position), -1) + 1;
      await d.insert(records).values({
        id: data.id,
        type: data.type,
        data: {},
        draft: data.draft as JsonObject,
        position,
      });
    }
    return { ok: true };
  });

/**
 * Publishes a record's draft after checking it against its type's fields (on the server, so the
 * rules hold however the request is made). Returns the problems instead when it isn't valid.
 */
export const publishRecord = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }): Promise<{ ok: boolean; errors: Record<string, string> }> => {
    const { recordType } = await import("@/lib/records");
    const { validateValues } = await import("@/lib/fields");
    const { d, records, nowIso } = await load();
    const [row] = await d.select().from(records).where(eq(records.id, data.id));
    if (!row || row.deletedAt) throw new Error("That record no longer exists.");
    const type = recordType(row.type);
    if (!type) throw new Error("Unknown record type.");
    const values = (row.draft ?? row.data) as Record<string, unknown>;
    const errors = validateValues(type.fields, values);
    if (Object.keys(errors).length) return { ok: false, errors };
    const now = nowIso();
    await d
      .update(records)
      .set({ data: values as JsonObject, draft: null, publishedAt: now, updatedAt: now })
      .where(eq(records.id, data.id));
    return { ok: true, errors: {} };
  });

/** Throws away a record's draft. A record that was never published is removed (hidden) instead. */
export const discardRecordDraft = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { d, records, nowIso } = await load();
    const [row] = await d.select().from(records).where(eq(records.id, data.id));
    if (!row) return { ok: true };
    await d
      .update(records)
      .set(row.publishedAt ? { draft: null } : { draft: null, deletedAt: nowIso() })
      .where(eq(records.id, data.id));
    return { ok: true };
  });

/** Deletes a record: hidden everywhere at once (kept in the database, spec section 11). */
export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { d, records, nowIso } = await load();
    const now = nowIso();
    await d
      .update(records)
      .set({ deletedAt: now, publishedAt: now, draft: null })
      .where(eq(records.id, data.id));
    return { ok: true };
  });

/** Moves a record one place in its type's manual order (live straight away). */
export const moveRecord = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(
    z.object({
      type: z.string().min(1),
      id: z.string().min(1),
      dir: z.union([z.literal(-1), z.literal(1)]),
    }),
  )
  .handler(async ({ data }) => {
    const { d, records, nowIso } = await load();
    const rows = await d
      .select({ id: records.id, position: records.position })
      .from(records)
      .where(and(eq(records.type, data.type), isNull(records.deletedAt)))
      .orderBy(asc(records.position));
    const i = rows.findIndex((r) => r.id === data.id);
    const j = i + data.dir;
    if (i < 0 || j < 0 || j >= rows.length) return { ok: false };
    const order = rows.map((r) => r.id);
    [order[i], order[j]] = [order[j]!, order[i]!];
    const now = nowIso();
    await d.batch(
      order.map((id, position) =>
        d.update(records).set({ position, publishedAt: now }).where(eq(records.id, id)),
      ) as [never, ...never[]],
    );
    return { ok: true };
  });

/** Where a record is used (page sections that reference it, live or draft), to warn before deleting. */
export const recordUsages = createServerFn({ method: "GET" })
  .middleware([asEditor])
  .inputValidator(z.object({ type: z.string().min(1), id: z.string().min(1) }))
  .handler(async ({ data }): Promise<string[]> => {
    const { recordUsage } = await import("@/lib/records");
    const { allPages } = await import("@/lib/pages");
    const { d, siteContent } = await load();
    const rows = await d.select().from(siteContent);
    const live = Object.fromEntries(rows.map((r) => [r.key, r.data]));
    const titles = new Map<string, string>(
      allPages(live).map((p) => [p.key, p.key === "home" ? "Homepage" : p.title]),
    );
    return recordUsage(
      rows.map((r) => ({ key: r.key, content: r.data, draft: r.draft ?? null })),
      (key) => titles.get(key) ?? key,
      data.type,
      data.id,
    );
  });

/** Every published record's live data, grouped by type (what visitors see; never drafts). */
export const getPublishedRecords = createServerFn({ method: "GET" })
  .middleware([asVisitor])
  .handler(
    async (): Promise<Record<string, Array<{ id: string; position: number; data: Json }>>> => {
      const { d, records } = await load();
      const rows = await d
        .select({
          id: records.id,
          type: records.type,
          position: records.position,
          data: records.data,
        })
        .from(records)
        .where(and(isNull(records.deletedAt), isNotNull(records.publishedAt)))
        .orderBy(asc(records.position));
      const out: Record<string, Array<{ id: string; position: number; data: Json }>> = {};
      for (const r of rows)
        (out[r.type] ??= []).push({ id: r.id, position: r.position, data: r.data });
      return out;
    },
  );

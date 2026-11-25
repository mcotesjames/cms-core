/**
 * Studio functions for records (investments, publications …). Records still save straight to
 * live, as in the original build; their draft step is a roadmap item (spec Phase 7).
 */
import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { asEditor } from "./access";
import { RECORD_TYPES, rowData, toRecord, type RecordItem, type RecordTable } from "./shapes";

const table = z.enum(Object.keys(RECORD_TYPES) as [RecordTable, ...RecordTable[]]);

async function load() {
  const { db, newId, nowIso } = await import("./db.server");
  const { records } = await import("./schema");
  return { d: await db(), records, newId, nowIso };
}

/** Every record of a type: in manual order, or sorted A–Z by `order` when given. */
export const listStudioRecords = createServerFn({ method: "GET" })
  .middleware([asEditor])
  .inputValidator(z.object({ table, order: z.string().optional() }))
  .handler(async ({ data }): Promise<RecordItem[]> => {
    const { d, records } = await load();
    const rows = (
      await d
        .select()
        .from(records)
        .where(eq(records.type, RECORD_TYPES[data.table]))
        .orderBy(asc(records.position))
    ).map(toRecord);
    const key = data.order;
    if (!key || key === "sort") return rows;
    return rows.sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? "")));
  });

/** Saves a record's fields (new records go last) and returns it as saved. */
export const saveRecord = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ table, row: z.record(z.string(), z.any()) }))
  .handler(async ({ data }): Promise<RecordItem> => {
    const { d, records, newId, nowIso } = await load();
    const type = RECORD_TYPES[data.table];
    const fields = rowData(data.row);
    const id = typeof data.row["id"] === "string" ? (data.row["id"] as string) : null;
    if (id) {
      const [cur] = await d
        .select()
        .from(records)
        .where(and(eq(records.id, id), eq(records.type, type)))
        .limit(1);
      if (!cur) throw new Error("That record no longer exists.");
      const [saved] = await d
        .update(records)
        .set({ data: { ...cur.data, ...fields }, updatedAt: nowIso() })
        .where(eq(records.id, id))
        .returning();
      return toRecord(saved!);
    }
    const [last] = await d
      .select({ p: max(records.position) })
      .from(records)
      .where(eq(records.type, type));
    const [saved] = await d
      .insert(records)
      .values({ id: newId(), type, data: fields, position: (last?.p ?? -1) + 1 })
      .returning();
    return toRecord(saved!);
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ table, id: z.string() }))
  .handler(async ({ data }) => {
    const { d, records } = await load();
    await d
      .delete(records)
      .where(and(eq(records.id, data.id), eq(records.type, RECORD_TYPES[data.table])));
    return { ok: true };
  });

/** Sets the manual order: `ids` in their new order. */
export const reorderRecords = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ table, ids: z.array(z.string()) }))
  .handler(async ({ data }) => {
    const { d, records } = await load();
    const type = RECORD_TYPES[data.table];
    await d.batch(
      data.ids.map((id, position) =>
        d
          .update(records)
          .set({ position })
          .where(and(eq(records.id, id), eq(records.type, type))),
      ) as unknown as Parameters<typeof d.batch>[0],
    );
    return { ok: true };
  });

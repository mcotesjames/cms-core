import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteRecord,
  discardRecordDraft,
  listRecords,
  moveRecord,
  publishRecord,
  recordUsages,
  saveRecordDraft,
  type RecordRow,
} from "@/data/records";
import { publishedRecordsQuery } from "@/lib/records-live";
import { recordTitle, recordType, sortRecords, type RecordTypeDef } from "@/lib/records";
import type { ChoiceOption } from "@/lib/fields";

/** Every record the Studio can see (all types, drafts included). */
export const studioRecordsQuery = queryOptions({
  queryKey: ["records_studio"],
  queryFn: () => listRecords({ data: {} }),
  staleTime: 10_000,
});

/** A record's current values in the Studio: its draft if it has one, else its live data. */
export const currentValues = (r: RecordRow) => (r.draft ?? r.data) as Record<string, unknown>;

/** The records of one type, in its order, plus the actions the Studio needs. */
export function useRecords(type: RecordTypeDef) {
  const qc = useQueryClient();
  const q = useQuery(studioRecordsQuery);
  const rows = (q.data ?? []).filter((r) => r.type === type.key);
  const list = sortRecords(
    type,
    rows.map((r) => ({ position: r.position, values: currentValues(r), row: r })),
  ).map((x) => x.row);
  const refresh = async (live = false) => {
    await qc.invalidateQueries({ queryKey: studioRecordsQuery.queryKey });
    if (live) await qc.invalidateQueries({ queryKey: publishedRecordsQuery.queryKey });
  };
  return {
    loading: q.isPending,
    list,
    refresh,
    saveDraft: (id: string, draft: Record<string, unknown>) =>
      saveRecordDraft({ data: { id, type: type.key, draft } }),
    publish: async (id: string) => {
      const r = await publishRecord({ data: { id } });
      if (r.ok) await refresh(true);
      return r;
    },
    discard: async (id: string) => {
      await discardRecordDraft({ data: { id } });
      await refresh();
    },
    remove: async (id: string) => {
      await deleteRecord({ data: { id } });
      await refresh(true);
    },
    move: async (id: string, dir: -1 | 1) => {
      await moveRecord({ data: { type: type.key, id, dir } });
      await refresh(true);
    },
    usages: (id: string) => recordUsages({ data: { type: type.key, id } }),
  };
}

/** Options for reference fields: every record of a type, by title (unpublished ones marked). */
export function useReferenceOptions(): (to: string) => ChoiceOption[] {
  const q = useQuery(studioRecordsQuery);
  return (to) => {
    const type = recordType(to);
    if (!type) return [];
    return sortRecords(
      type,
      (q.data ?? [])
        .filter((r) => r.type === to)
        .map((r) => ({ position: r.position, values: currentValues(r), row: r })),
    ).map(({ row, values }) => ({
      value: row.id,
      label: `${recordTitle(type, values)}${row.publishedAt ? "" : " (draft)"}`,
    }));
  };
}

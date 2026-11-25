import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getPublishedRecords } from "@/data/records";
import { recordType, sortRecords, type PublicRecord } from "./records";

/** Every published record's live data, grouped by type (loaded once by the root loader). */
export const publishedRecordsQuery = queryOptions({
  queryKey: ["records_live"],
  queryFn: () => getPublishedRecords(),
  staleTime: 60_000,
});

/**
 * A record type's published records in its order, for a site's sections. `filter` keeps records
 * whose yes/no or choice field matches (e.g. `{ featured: true }`); `limit` caps the count.
 */
export function usePublishedRecords(
  type: string,
  opts: { filter?: Record<string, unknown>; limit?: number | null } = {},
): PublicRecord[] {
  const all = useSuspenseQuery(publishedRecordsQuery).data[type] ?? [];
  const def = recordType(type);
  if (!def) return [];
  const rows = all.map((r) => ({
    position: r.position,
    values: { ...(r.data as Record<string, unknown>), id: r.id } as PublicRecord,
  }));
  let list = sortRecords(def, rows).map((r) => r.values);
  for (const [field, want] of Object.entries(opts.filter ?? {})) {
    list = list.filter((r) => {
      const v = r[field];
      return Array.isArray(v) ? v.includes(want) : v === want;
    });
  }
  return opts.limit && opts.limit > 0 ? list.slice(0, opts.limit) : list;
}

/** Published records picked by a reference field, in the order they were picked (missing ones skipped). */
export function useReferencedRecords(type: string, ids: unknown): PublicRecord[] {
  const all = usePublishedRecords(type);
  if (!Array.isArray(ids)) return [];
  const byId = new Map(all.map((r) => [r.id, r]));
  return ids.flatMap((id) => (typeof id === "string" && byId.has(id) ? [byId.get(id)!] : []));
}

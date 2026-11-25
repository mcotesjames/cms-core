/**
 * Records (spec: Core scope → Records): reusable structured data without its own page — team
 * members, services, logos… A site declares each type in site.config.ts `recordTypes` (name,
 * fields, title field, ordering); the platform provides the Studio list and form drawer, drafts and
 * Publish, the public list for sections, and references.
 *
 * Storage: the `records` table, one row per record: `data` (live), `draft`, `position` (manual
 * order), `published_at` (live content last changed; null = never published), `deleted_at`.
 */
import type { SiteRecordType } from "./site-config";
import { site } from "./site";
import { sectionDef, SECTION_TYPES } from "./page-sections";

export type RecordTypeDef = SiteRecordType & { key: string };

/** A record as a site component sees it: its live field values plus its id. */
export type PublicRecord = { id: string } & Record<string, unknown>;

/** A record as the Studio sees it. */
export type StudioRecord = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  draft: Record<string, unknown> | null;
  position: number;
  publishedAt: string | null;
};

/** The site's record types, in declaration order. */
export function recordTypes(): RecordTypeDef[] {
  return Object.entries(site.recordTypes ?? {}).map(([key, t]) => ({ key, ...t }));
}

export function recordType(key: string): RecordTypeDef | null {
  const t = site.recordTypes?.[key];
  return t ? { key, ...t } : null;
}

/** A record's title from its values ("Untitled" when empty). */
export function recordTitle(
  type: RecordTypeDef,
  values: Record<string, unknown> | null | undefined,
): string {
  const v = values?.[type.titleField];
  return typeof v === "string" && v.trim() ? v.trim() : "Untitled";
}

/** Live, unpublished changes, or never published. */
export function recordStatus(
  r: Pick<StudioRecord, "draft" | "publishedAt">,
): "live" | "changes" | "draft" {
  if (!r.publishedAt) return "draft";
  return r.draft ? "changes" : "live";
}

/** Sorts records by their type's ordering (manual position, or a field). */
export function sortRecords<T extends { position?: number; values: Record<string, unknown> }>(
  type: RecordTypeDef,
  list: T[],
): T[] {
  const out = [...list];
  if (type.ordering === "manual") return out.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const { field, direction = "asc" } = type.ordering;
  const sign = direction === "desc" ? -1 : 1;
  return out.sort((a, b) => {
    const x = a.values[field];
    const y = b.values[field];
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
    return String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true }) * sign;
  });
}

/**
 * Where a record is referenced: page sections whose reference fields point at it (live or draft),
 * as readable places ("Homepage → Team"). Used to warn before deleting.
 */
export function recordUsage(
  rows: Array<{
    key: string;
    content: Record<string, unknown>;
    draft: Record<string, unknown> | null;
  }>,
  pageTitle: (key: string) => string,
  type: string,
  id: string,
): string[] {
  const places = new Set<string>();
  for (const row of rows) {
    for (const doc of [row.content, row.draft]) {
      const data = (doc?.["section_data"] ?? {}) as Record<string, Record<string, unknown>>;
      for (const section of Object.values(data)) {
        if (!section || !(String(section["type"]) in SECTION_TYPES)) continue;
        const def = sectionDef(String(section["type"]));
        for (const f of def.fields)
          if (f.type === "reference" && f.to === type) {
            const v = section[f.name];
            if (Array.isArray(v) && v.includes(id))
              places.add(`${pageTitle(row.key)} → ${def.label}`);
          }
      }
    }
  }
  return [...places];
}

/**
 * Studio-side helpers for reading and writing drafts. Drafts are only ever read through Studio
 * server functions (src/data/), which check the signed-in user; public reads never include them.
 */
import { getSiteRows, saveSiteRow as saveSiteRowFn } from "@/data/site";
import { listPostDrafts } from "@/data/entries";
import type { JsonObject } from "@/data/shapes";

export type { JsonObject };

/** Drafts of every insight that has one, keyed by id. */
export function fetchPostDrafts(): Promise<Record<string, JsonObject>> {
  return listPostDrafts();
}

type SiteRowFields = { content?: unknown; draft?: unknown };

/** Writes a site_content row's live content and/or draft, creating the row if it's missing. */
export async function saveSiteRow(
  key: string,
  fields: SiteRowFields,
): Promise<{ error: Error | null }> {
  try {
    await saveSiteRowFn({
      data: {
        key,
        ...(fields.content !== undefined ? { content: fields.content as JsonObject } : {}),
        ...(fields.draft !== undefined
          ? { draft: (fields.draft ?? null) as JsonObject | null }
          : {}),
      },
    });
    return { error: null };
  } catch (e) {
    return { error: e as Error };
  }
}

/** Live content of every page row (or one), each with its draft (or null). */
export function fetchSiteRows(key?: string) {
  return getSiteRows({ data: key ? { key } : {} });
}

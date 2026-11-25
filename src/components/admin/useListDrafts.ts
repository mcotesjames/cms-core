import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSiteRows, saveSiteRow } from "@/lib/admin-drafts";
import { publishLists } from "@/data/site";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { homeQuery } from "@/lib/content";
import {
  LIST_NAMES,
  currentList,
  type ListName,
  type ListRow,
  type ListsDraft,
} from "@/lib/list-drafts";
import type { SaveState } from "./useSiteDraft";

const ROW = "lists";

/**
 * Edits the shared lists (pillars, cards, hotspots) through a draft kept in the site_content
 * row "lists". Live items stay in list_items until publish().
 */
export function useListDrafts() {
  const qc = useQueryClient();
  const live = useQuery(homeQuery).data as Partial<Record<ListName, ListRow[]>> | undefined;
  const [draft, setDraft] = useState<ListsDraft | null | undefined>(undefined);
  const [save, setSave] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    fetchSiteRows(ROW)
      .then(
        (rows) => ({ data: rows[0], error: null }),
        (error: Error) => ({ data: undefined, error }),
      )
      .then(({ data, error }) => {
        if (error) {
          toast.error(error.message);
          setDraft(null);
          return;
        }
        setDraft((data?.draft as ListsDraft | null) ?? null);
      });
  }, []);

  const persist = (next: ListsDraft | null) => {
    setSave("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { error } = await saveSiteRow(ROW, { draft: next });
      setSave(error ? "error" : "saved");
      if (error) toast.error(error.message);
    }, 900);
  };

  const ready = live !== undefined && draft !== undefined;
  const list = useCallback((name: ListName) => currentList(live ?? {}, draft, name), [live, draft]);
  /** Every list as the canvas should show it (drafts where edited). */
  const lists = Object.fromEntries(LIST_NAMES.map((n) => [n, list(n)])) as Record<
    ListName,
    ListRow[]
  >;

  const update = (name: ListName, rows: ListRow[]) => {
    const next = { ...(draft ?? {}), [name]: rows };
    setDraft(next);
    persist(next);
  };

  const hasDraft = !!draft && Object.keys(draft).length > 0;

  const publish = async () => {
    if (!draft || !live) return true;
    clearTimeout(timer.current);
    try {
      await publishLists({ data: { lists: draft as Record<string, ListRow[]> } });
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
    setDraft(null);
    setSave("idle");
    await qc.invalidateQueries({ queryKey: homeQuery.queryKey });
    return true;
  };

  const discard = async () => {
    clearTimeout(timer.current);
    const { error } = await saveSiteRow(ROW, { draft: null });
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft(null);
    setSave("idle");
  };

  return { ready, list, lists, update, hasDraft, publish, discard, save };
}

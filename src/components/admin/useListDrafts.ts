import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchSiteRows,
  fetchPostDrafts,
  ADMIN_POST_COLUMNS,
  saveSiteRow,
} from "@/lib/admin-drafts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { homeQuery } from "@/lib/content";
import {
  LIST_NAMES,
  LISTS,
  currentList,
  planPublish,
  type ListName,
  type ListRow,
  type ListsDraft,
} from "@/lib/list-drafts";
import type { SaveState } from "./useSiteDraft";

const ROW = "lists";

/**
 * Edits the shared lists (pillars, cards, hotspots) through a draft kept in the site_content
 * row "lists". Live items stay in their tables until publish().
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
    for (const name of Object.keys(draft) as ListName[]) {
      const { table } = LISTS[name];
      const { upserts, deletes } = planPublish(live[name] ?? [], draft[name] ?? []);
      if (upserts.length) {
        const { error } = await supabase.from(table).upsert(upserts as never, { onConflict: "id" });
        if (error) {
          toast.error(`${LISTS[name].title}: ${error.message}`);
          return false;
        }
      }
      if (deletes.length) {
        const { error } = await supabase.from(table).delete().in("id", deletes);
        if (error) {
          toast.error(`${LISTS[name].title}: ${error.message}`);
          return false;
        }
      }
    }
    const { error } = await saveSiteRow(ROW, { draft: null });
    if (error) {
      toast.error(error.message);
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

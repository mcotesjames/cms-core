import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSiteRows, saveSiteRow } from "@/lib/admin-drafts";
import { discardSiteDraft, publishSiteRow } from "@/data/site";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Doc = Record<string, any>;
export type SaveState = "idle" | "saving" | "saved" | "error";

/** Edits a site_content row through its draft; publishing copies the draft to the live content. */
export function useSiteDraft(key: string) {
  const qc = useQueryClient();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setDoc(null);
    // A row may not exist yet (e.g. "menus" before its first edit): start from an empty doc.
    fetchSiteRows(key)
      .then(
        (rows) => ({ data: rows[0], error: null }),
        (error: Error) => ({ data: undefined, error }),
      )
      .then(({ data, error }) => {
        if (error) {
          toast.error(error.message);
          return;
        }
        setDoc((data?.draft ?? data?.content ?? {}) as Doc);
        setHasDraft(data?.draft != null);
      });
  }, [key]);

  const update = useCallback(
    (next: Doc) => {
      setDoc(next);
      setHasDraft(true);
      setSave("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        // Creates the row on the first edit of a new one (e.g. "menus").
        const { error } = await saveSiteRow(key, { draft: next });
        setSave(error ? "error" : "saved");
        if (error) toast.error(error.message);
      }, 900);
    },
    [key],
  );

  /**
   * Copies the draft live. `keep` lists keys owned elsewhere (e.g. a page's `seo`, saved live from
   * its Settings): their live values are kept rather than replaced by the editor's copy.
   */
  const publish = async (opts: { keep?: string[] } = {}) => {
    if (!doc) return;
    clearTimeout(timer.current);
    try {
      await publishSiteRow({ data: { key, doc, keep: opts.keep ?? [] } });
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    setHasDraft(false);
    setSave("idle");
    qc.invalidateQueries({ queryKey: ["site_content"] });
    toast.success("Published to the live site");
  };

  /** ask = false when the caller has already confirmed (e.g. discarding several drafts at once). */
  const discard = async (ask = true) => {
    if (ask && !confirm("Discard unpublished changes?")) return;
    clearTimeout(timer.current);
    let live: Doc;
    try {
      live = await discardSiteDraft({ data: { key } });
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    setDoc(live);
    setHasDraft(false);
    setSave("idle");
  };

  return { doc, update, publish, discard, hasDraft, save };
}

export function getPath(o: Doc, path: string): any {
  return path.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
}
export function setPath(o: Doc, path: string, v: unknown): Doc {
  const [k, ...rest] = path.split(".");
  return { ...o, [k!]: rest.length ? setPath(o[k!] ?? {}, rest.join("."), v) : v };
}

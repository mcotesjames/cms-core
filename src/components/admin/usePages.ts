import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchSiteRows, saveSiteRow } from "@/lib/admin-drafts";
import { siteContentQuery } from "@/lib/site-content";
import { newSectionId } from "@/lib/page-sections";
import {
  allPages,
  customPages,
  duplicateDoc,
  fixedPageNames,
  isFixedPage,
  newPageDoc,
  newPageKey,
  uniqueSlug,
  type CustomPage,
  type CustomPageKey,
  type PageKey,
} from "@/lib/pages";
import type { TemplateKey } from "@/lib/templates";

type Registry = { list: CustomPage[]; names: Record<string, string> };

/** The site_content row "pages": created pages, plus built-in pages' changed names. */
export const pagesQuery = queryOptions({
  queryKey: ["admin", "pages"],
  queryFn: async (): Promise<Registry> => {
    const [row] = await fetchSiteRows("pages");
    const site = { pages: row?.content };
    return { list: customPages(site), names: fixedPageNames(site) };
  },
});

/**
 * Every page and the actions on them. The page list (names, web addresses, published) saves
 * straight away; each page's content goes through draft and publish as usual.
 */
export function usePages() {
  const qc = useQueryClient();
  const q = useQuery(pagesQuery);
  const reg: Registry = q.data ?? { list: [], names: {} };
  const save = async (next: Registry) => {
    const { error } = await saveSiteRow("pages", { content: next });
    if (error) toast.error(error.message);
    await Promise.all([
      qc.invalidateQueries({ queryKey: pagesQuery.queryKey }),
      qc.invalidateQueries({ queryKey: siteContentQuery.queryKey }),
    ]);
    return !error;
  };
  /** The latest saved list, so two quick changes never overwrite each other. */
  const current = async (): Promise<Registry> => qc.fetchQuery({ ...pagesQuery, staleTime: 0 });
  /** Adds an unpublished page with the given content; returns its key. */
  const add = async (
    title: string,
    slug: string,
    draft: unknown,
  ): Promise<CustomPageKey | null> => {
    const key = newPageKey();
    const row = await saveSiteRow(key, { content: {}, draft });
    if (row.error) {
      toast.error(row.error.message);
      return null;
    }
    const now = await current();
    return (await save({ ...now, list: [...now.list, { key, title, slug, published: false }] }))
      ? key
      : null;
  };
  return {
    ready: !!q.data,
    /** Created pages only. */
    list: reg.list,
    /** Every page, built-in first, with any changed names. */
    all: allPages({ pages: reg }),
    /** Creates an unpublished page with a hero and its template's starting sections; returns its key. */
    create: (title: string, slug: string, template: TemplateKey = "standard") =>
      add(title, slug, newPageDoc(title, template, newSectionId)),
    /**
     * Copies any page (built-in or created) into a new, unpublished created page with the same
     * sections and text. `site` is the content to copy from (the source's draft if it has one).
     */
    async duplicate(source: PageKey, title: string, site: Record<string, unknown>) {
      const now = await current();
      const copyTitle = `${title} (copy)`;
      return add(
        copyTitle,
        uniqueSlug(copyTitle, now.list),
        duplicateDoc(site, source, newSectionId),
      );
    },
    /** Changes a page's name (any page) or web address (created pages only). */
    async update(key: string, patch: Partial<Pick<CustomPage, "title" | "slug" | "published">>) {
      const now = await current();
      if (isFixedPage(key)) {
        if (patch.title === undefined) return true;
        return save({ ...now, names: { ...now.names, [key]: patch.title } });
      }
      return save({ ...now, list: now.list.map((p) => (p.key === key ? { ...p, ...patch } : p)) });
    },
    /** Takes a created page off the site and out of the Studio. Its content row is kept. */
    async remove(key: string) {
      const now = await current();
      return save({ ...now, list: now.list.filter((p) => p.key !== key) });
    },
  };
}

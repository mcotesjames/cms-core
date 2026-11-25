import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getSiteContent } from "@/data/content";
import { normalizeSiteContent } from "./site-content-shape";

/** A page row: its hero (`intro`), sections, and SEO overrides (lib/page-sections.ts, lib/seo.ts). */
export type PageDoc = {
  intro: { title: string; summary: string };
  sections?: string[];
  section_data?: Record<string, { type: string } & Record<string, string>>;
  seo?: unknown;
};

export type SiteContent = {
  home: PageDoc;
  /** Editable menus (lib/menus.ts); absent until first edited, when the defaults are used. */
  menus?: unknown;
  settings: {
    contact_email: string;
    footer_heading: string;
    footer_tagline: string;
    /** Settings → SEO (lib/seo.ts). */
    seo?: { site_name?: string; title_suffix?: string; default_image?: string };
  };
  /** Pages created in the Studio (lib/pages.ts), each with its own row keyed `page_<letters>`. */
  pages?: { list?: unknown[] };
} & Record<`page_${string}`, PageDoc | undefined>;

/** Live (published) page and settings content, keyed by page. */
export const siteContentQuery = queryOptions({
  queryKey: ["site_content"],
  queryFn: async () => normalizeSiteContent(await getSiteContent()) as unknown as SiteContent,
  staleTime: 60_000,
});

export function useSiteContent() {
  return useSuspenseQuery(siteContentQuery).data;
}

import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getSiteContent } from "@/data/content";
import { normalizeSiteContent } from "./site-content-shape";

/** Flexible sections every page row can carry (see lib/page-sections.ts). */
type Sections = {
  sections?: string[];
  section_data?: Record<string, { type: string } & Record<string, string>>;
};

export type SiteContent = {
  home: Sections & {
    hero: { headline: string; cta_label: string };
    intro: { text: string };
    what: { eyebrow: string; intro: string };
    bio: { name: string; description: string; portrait_url: string; portrait_alt: string };
  };
  insights: Sections & { intro: { title: string; note: string }; list_label: string };
  investments: Sections & {
    intro: { eyebrow: string; title_line_1: string; title_line_2: string; summary: string };
  };
  publications: Sections & {
    intro: { eyebrow: string; title: string; summary: string };
    selected_label: string;
    footnote: string;
  };
  /** Editable menus (lib/menus.ts); absent until first edited, when the defaults are used. */
  menus?: unknown;
  settings: {
    substack_url: string;
    contact_email: string;
    enquiry_recipient: string;
    footer_heading: string;
    footer_tagline: string;
    investments_disclaimer: string;
    /** Settings → SEO (lib/seo.ts). */
    seo?: { site_name?: string; title_suffix?: string; default_image?: string };
  };
  /** Pages created in the Studio (lib/pages.ts), each with its own row keyed `page_<letters>`. */
  pages?: { list?: unknown[] };
};

/** Live (published) page and settings content, keyed by page. */
export const siteContentQuery = queryOptions({
  queryKey: ["site_content"],
  queryFn: async () => normalizeSiteContent(await getSiteContent()) as unknown as SiteContent,
  staleTime: 60_000,
});

export function useSiteContent() {
  return useSuspenseQuery(siteContentQuery).data;
}

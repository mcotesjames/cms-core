import { createFileRoute } from "@tanstack/react-router";
import { canvasSsr } from "@/lib/studio-mode";
import { organisationLd, pageSeo, readSeoSettings, seoHead } from "@/lib/seo";
import { siteContentQuery } from "@/lib/site-content";
import { PageView } from "@/components/sections/PageSections";

/** The homepage: the built-in page `home`, built from its hero and sections like any page. */
export const Route = createFileRoute("/")({
  ssr: canvasSsr,
  // SEO from the CMS (page settings), with automatic fallbacks: see lib/seo.ts.
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const site = loaderData as unknown as Record<string, unknown>;
    return seoHead(pageSeo(site, "home", { title: "Homepage", path: "/" }), {
      jsonLd: organisationLd(readSeoSettings(site["settings"])),
    });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(siteContentQuery),
  component: () => <PageView page="home" fallbackTitle="Homepage" />,
});

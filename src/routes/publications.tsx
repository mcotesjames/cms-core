import { canvasSsr } from "@/lib/studio-mode";
import { LetterReveal } from "@/components/LetterReveal";
import { pageSeo, seoHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Header, Footer } from "@/components/SiteChrome";
import { siteContentQuery, useSiteContent } from "@/lib/site-content";
import { useShow } from "@/lib/show-if";
import { PageSections, StudioHero, ensureSectionData } from "@/components/sections/PageSections";

export const Route = createFileRoute("/publications")({
  ssr: canvasSsr,
  // SEO from the CMS (page settings), with automatic fallbacks: see lib/seo.ts.
  head: ({ loaderData }) =>
    loaderData
      ? seoHead(
          pageSeo(loaderData as unknown as Record<string, unknown>, "publications", {
            title: "Publications page",
            path: "/publications",
          }),
        )
      : {},
  loader: async ({ context }) => {
    await ensureSectionData(context.queryClient);
    return context.queryClient.ensureQueryData(siteContentQuery);
  },
  component: Publications,
});

function Publications() {
  const page = useSiteContent().publications;
  const show = useShow();
  const { eyebrow, title, summary } = page.intro;
  return (
    <div className="site-publications-page">
      <Header />

      <main id="publications-content" className="site-publications-content">
        <StudioHero page="publications">
          {show(eyebrow, title, summary) && (
            <header className="site-publications-intro">
              {show(eyebrow) && (
                <p className="site-publications-eyebrow" data-cms="publications:intro.eyebrow">
                  {eyebrow}
                </p>
              )}
              {show(title) && (
                <h1 data-cms="publications:intro.title">
                  <LetterReveal text={title} />
                </h1>
              )}
              {show(summary) && (
                <p
                  className="site-publications-summary"
                  data-cms="publications:intro.summary"
                  data-cms-multiline
                >
                  {summary}
                </p>
              )}
              <div className="site-publications-divider" aria-hidden="true" />
            </header>
          )}
        </StudioHero>
        <PageSections page="publications" />
      </main>
      <Footer />
    </div>
  );
}

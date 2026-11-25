import { canvasSsr } from "@/lib/studio-mode";
import { LetterReveal } from "@/components/LetterReveal";
import { pageSeo, seoHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Header, Footer } from "@/components/SiteChrome";
import { siteContentQuery, useSiteContent } from "@/lib/site-content";
import { useShow } from "@/lib/show-if";
import { PageSections, StudioHero, ensureSectionData } from "@/components/sections/PageSections";

export const Route = createFileRoute("/investments")({
  ssr: canvasSsr,
  // SEO from the CMS (page settings), with automatic fallbacks: see lib/seo.ts.
  head: ({ loaderData }) =>
    loaderData
      ? seoHead(
          pageSeo(loaderData as unknown as Record<string, unknown>, "investments", {
            title: "Investments page",
            path: "/investments",
          }),
        )
      : {},
  loader: async ({ context }) => {
    await ensureSectionData(context.queryClient);
    return context.queryClient.ensureQueryData(siteContentQuery);
  },
  component: Investments,
});

function Investments() {
  const page = useSiteContent().investments;
  const show = useShow();
  const { eyebrow, title_line_1: line1, title_line_2: line2, summary } = page.intro;
  return (
    <div className="site-investments-page">
      <Header />
      <main id="investments-content" className="site-investments-content">
        <StudioHero page="investments">
          {show(eyebrow, line1, line2, summary) && (
            <header className="site-investments-intro">
              {show(eyebrow) && (
                <p className="site-investments-eyebrow" data-cms="investments:intro.eyebrow">
                  {eyebrow}
                </p>
              )}
              {show(line1, line2) && (
                <h1>
                  {show(line1) && (
                    <span data-cms="investments:intro.title_line_1">
                      <LetterReveal text={line1} />
                    </span>
                  )}
                  {show(line1) && show(line2) && (
                    <>
                      <br className="site-investments-break" />{" "}
                    </>
                  )}
                  {show(line2) && (
                    <span data-cms="investments:intro.title_line_2">
                      <LetterReveal
                        text={line2}
                        start={show(line1) ? line1.replace(/\s+/g, "").length : 0}
                      />
                    </span>
                  )}
                </h1>
              )}
              {show(summary) && (
                <p
                  className="site-investments-summary"
                  data-cms="investments:intro.summary"
                  data-cms-multiline
                >
                  {summary}
                </p>
              )}
            </header>
          )}
        </StudioHero>
        <PageSections page="investments" />
      </main>
      <Footer />
    </div>
  );
}

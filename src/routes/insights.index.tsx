import { canvasSsr } from "@/lib/studio-mode";
import { LetterReveal } from "@/components/LetterReveal";
import { pageSeo, seoHead } from "@/lib/seo";
import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { siteContentQuery, useSiteContent } from "@/lib/site-content";
import { useShow } from "@/lib/show-if";
import { Header, Footer } from "@/components/SiteChrome";
import { SmoothScroll } from "@/components/SmoothScroll";
import { PageSections, StudioHero, ensureSectionData } from "@/components/sections/PageSections";

export const Route = createFileRoute("/insights/")({
  ssr: canvasSsr,
  // SEO from the CMS (page settings), with automatic fallbacks: see lib/seo.ts.
  head: ({ loaderData }) =>
    loaderData
      ? seoHead(
          pageSeo(loaderData as unknown as Record<string, unknown>, "insights", {
            title: "Insights page",
            path: "/insights",
          }),
        )
      : {},
  loader: async ({ context }) => {
    await ensureSectionData(context.queryClient);
    return context.queryClient.ensureQueryData(siteContentQuery);
  },
  errorComponent: ArchiveError,
  notFoundComponent: () => <p className="site-archive-empty">No insights found.</p>,
  component: Insights,
});

function ArchiveError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <main className="site-archive-hero">
      <p className="site-archive-intro">
        Insights could not load. {error instanceof Error ? error.message : ""}
      </p>
      <button
        className="site-archive-link"
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Try again
      </button>
    </main>
  );
}

function Insights() {
  const page = useSiteContent().insights;
  const show = useShow();
  const { title, note } = page.intro;
  return (
    <main className="relative isolate">
      <SmoothScroll />
      <Header />
      <StudioHero page="insights">
        {show(title, note) && (
          <section className="site-archive-hero">
            {show(title) && (
              <h1 className="site-archive-title" data-cms="insights:intro.title">
                <LetterReveal text={title} />
              </h1>
            )}
            {show(note) && (
              <p
                className="site-archive-hero-note"
                data-cms="insights:intro.note"
                data-cms-multiline
              >
                {note}
              </p>
            )}
          </section>
        )}
      </StudioHero>
      <PageSections page="insights" />
      <Footer />
    </main>
  );
}

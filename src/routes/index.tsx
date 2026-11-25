import { canvasSsr } from "@/lib/studio-mode";
import { organisationLd, pageSeo, readSeoSettings, seoHead } from "@/lib/seo";
import { siteContentQuery } from "@/lib/site-content";
import { createFileRoute } from "@tanstack/react-router";
import { Header, Footer } from "@/components/SiteChrome";
import { Hero } from "@/components/home/Sections";
import { SmoothScroll } from "@/components/SmoothScroll";
import { useStudioMode } from "@/lib/studio-mode";
import { PageSections, StudioHero, ensureSectionData } from "@/components/sections/PageSections";

export const Route = createFileRoute("/")({
  ssr: canvasSsr,
  // SEO from the CMS (page settings), with automatic fallbacks: see lib/seo.ts.
  head: ({ loaderData }) =>
    loaderData
      ? seoHead(
          pageSeo(loaderData as unknown as Record<string, unknown>, "home", {
            title: "Homepage",
            path: "/",
          }),
          {
            jsonLd: organisationLd(
              readSeoSettings((loaderData as unknown as Record<string, unknown>)["settings"]),
            ),
          },
        )
      : {},
  loader: async ({ context }) => {
    await ensureSectionData(context.queryClient);
    return context.queryClient.ensureQueryData(siteContentQuery);
  },
  component: Index,
});

function Index() {
  const studio = useStudioMode();
  return (
    <main className="relative isolate">
      <SmoothScroll />
      <Header />
      <StudioHero page="home">
        <Hero />
      </StudioHero>
      <PageSections page="home" />
      {studio ? (
        <div data-cms-section="settings:footer">
          <Footer />
        </div>
      ) : (
        <Footer />
      )}
    </main>
  );
}

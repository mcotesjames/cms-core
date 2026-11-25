import { canvasSsr } from "@/lib/studio-mode";
import { LetterReveal } from "@/components/LetterReveal";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Header, Footer } from "@/components/SiteChrome";
import { PageSections, StudioHero, ensureSectionData } from "@/components/sections/PageSections";
import { siteContentQuery, useSiteContent } from "@/lib/site-content";
import { customPages, type CustomPage } from "@/lib/pages";
import { pageSeo, seoHead } from "@/lib/seo";
import { useShow } from "@/lib/show-if";
import { TEMPLATES, templateOf } from "@/lib/templates";

/**
 * Pages created in the Content Studio ("+ New page"), at /<web address>: a hero (title and
 * summary) followed by sections from the shared library. Only published pages are served; the
 * Studio canvas (?studio=1) also shows unpublished ones so they can be built before going live.
 */
export const Route = createFileRoute("/$slug")({
  ssr: canvasSsr,
  loader: async ({ context, params, location }) => {
    await ensureSectionData(context.queryClient);
    const site = (await context.queryClient.ensureQueryData(siteContentQuery)) as unknown as Record<
      string,
      unknown
    >;
    const page = customPages(site).find((p) => p.slug === params.slug);
    const studio = new URLSearchParams(location.searchStr).get("studio") === "1";
    if (!page || (!page.published && !studio)) throw notFound();
    return { site, page };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { site, page } = loaderData;
    const head = seoHead(pageSeo(site, page.key, { title: page.title, path: `/${page.slug}` }));
    // An unpublished page (only ever seen in the Studio) is never indexed.
    if (!page.published) head.meta.push({ name: "robots", content: "noindex" });
    return head;
  },
  notFoundComponent: NotFound,
  component: CustomPageView,
});

function NotFound() {
  return (
    <main className="relative isolate">
      <Header />
      <section className="site-archive-hero">
        <h1 className="site-archive-title">
          <LetterReveal text="Page not found" />
        </h1>
        <Link to="/" className="site-article-back">
          ← Home
        </Link>
      </section>
      <Footer />
    </main>
  );
}

function CustomPageView() {
  const { page } = Route.useLoaderData() as { page: CustomPage };
  const doc = (
    useSiteContent() as unknown as Record<
      string,
      Record<string, Record<string, string>> | undefined
    >
  )[page.key];
  const show = useShow();
  const title = doc?.["intro"]?.["title"] ?? "";
  const summary = doc?.["intro"]?.["summary"] ?? "";
  // Some templates (Interactive) have no hero: the page starts with its first section.
  const hero = TEMPLATES[templateOf(page.key, doc)].hero;
  return (
    <main className="relative isolate" data-hero={hero ? undefined : "none"}>
      <Header />
      {/* No hero: keep one page heading for screen readers and search engines. */}
      {!hero && <h1 className="sr-only">{title || page.title}</h1>}
      {hero && (
        <StudioHero page={page.key}>
          {show(title, summary) && (
            <section className="site-archive-hero">
              {show(title) && (
                <h1 className="site-archive-title" data-cms={`${page.key}:intro.title`}>
                  <LetterReveal text={title} />
                </h1>
              )}
              {show(summary) && (
                <p
                  className="site-archive-hero-note"
                  data-cms={`${page.key}:intro.summary`}
                  data-cms-multiline
                >
                  {summary}
                </p>
              )}
            </section>
          )}
        </StudioHero>
      )}
      <PageSections page={page.key} />
      <Footer />
    </main>
  );
}

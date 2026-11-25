import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { canvasSsr } from "@/lib/studio-mode";
import { Header, Footer } from "@/components/SiteChrome";
import { PageView } from "@/components/sections/PageSections";
import { siteContentQuery } from "@/lib/site-content";
import { customPages, type CustomPage } from "@/lib/pages";
import { pageSeo, seoHead } from "@/lib/seo";

/**
 * Pages created in the Content Studio ("+ New page"), at /<web address>: a hero (title and
 * intro) followed by sections from the section library. Only published pages are served; the
 * Studio canvas (?studio=1) also shows unpublished ones so they can be built before going live.
 */
export const Route = createFileRoute("/$slug")({
  ssr: canvasSsr,
  loader: async ({ context, params, location }) => {
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
    <>
      <Header />
      <main id="main" className="site-main">
        <section className="site-hero">
          <h1>Page not found</h1>
          <p className="site-hero-intro">
            <Link to="/">Back to the homepage</Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}

function CustomPageView() {
  const { page } = Route.useLoaderData() as { page: CustomPage };
  return <PageView page={page.key} fallbackTitle={page.title} />;
}

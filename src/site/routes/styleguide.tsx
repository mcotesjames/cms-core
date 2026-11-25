import { createFileRoute } from "@tanstack/react-router";
import { Footer, Header } from "@/components/SiteChrome";
import { siteContentQuery } from "@/lib/site-content";
import { pageSeo, seoHead } from "@/lib/seo";

/**
 * /styleguide: a bespoke route only this site has (spec section 12 → extension points), mounted
 * beside the platform's routes by vite.config.ts. Shows the theme's tokens and type so a site's
 * look can be checked in one place. Never indexed.
 */
export const Route = createFileRoute("/styleguide")({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteContentQuery),
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const head = seoHead(
      pageSeo(loaderData as unknown as Record<string, unknown>, "home", {
        title: "Styleguide",
        path: "/styleguide",
      }),
    );
    head.meta = head.meta.filter((m) => !("title" in m));
    head.meta.unshift({ title: "Styleguide" });
    head.meta.push({ name: "robots", content: "noindex" });
    return head;
  },
  component: Styleguide,
});

const COLOURS = ["background", "foreground", "primary", "muted", "muted-foreground", "border"];

function Styleguide() {
  return (
    <>
      <Header />
      <main id="main" className="site-main">
        <section className="site-hero">
          <h1>Styleguide</h1>
          <p className="site-hero-intro">
            This site's theme tokens and type, from src/site/theme.css and the platform defaults.
          </p>
        </section>
        <section className="site-section site-text">
          <h2>Colours</h2>
          <ul className="site-styleguide-swatches">
            {COLOURS.map((c) => (
              <li key={c} className="site-styleguide-swatch">
                <span style={{ background: `var(--${c})` }} />
                <code>--{c}</code>
              </li>
            ))}
          </ul>
        </section>
        <section className="site-section site-text">
          <h2>Type</h2>
          <p style={{ fontSize: "var(--type-h1)", lineHeight: 1.05, margin: 0 }}>Heading 1</p>
          <p style={{ fontSize: "var(--type-h2)", margin: "1rem 0" }}>Heading 2</p>
          <p style={{ fontSize: "var(--type-lead)" }}>Lead text for intros.</p>
          <div className="site-text-body">Body text. Satoshi at the site's text weight.</div>
        </section>
      </main>
      <Footer />
    </>
  );
}

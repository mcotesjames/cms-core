import { useEffect, useRef } from "react";
import { LetterReveal } from "@/components/LetterReveal";
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { postQuery, postsQuery } from "@/lib/content";
import { siteContentQuery } from "@/lib/site-content";
import { SITE_NAME, articleLd, insightSeo, readSeoSettings, seoHead } from "@/lib/seo";
import { Header, Footer } from "@/components/SiteChrome";
import { SmoothScroll } from "@/components/SmoothScroll";
import { enhanceVideos } from "@/lib/enhance-videos";
import { parseModules, usesLegacyBody } from "@/lib/modules";
import { ArticleView } from "@/components/insights/ArticleView";

export const Route = createFileRoute("/insights/$slug")({
  loader: async ({ context, params }) => {
    const [post, , site] = await Promise.all([
      context.queryClient.ensureQueryData(postQuery(params.slug)),
      context.queryClient.ensureQueryData(postsQuery),
      context.queryClient.ensureQueryData(siteContentQuery),
    ]);
    if (!post || !post.published) throw notFound();
    return { post, settings: (site as unknown as Record<string, unknown>)["settings"] };
  },
  // SEO from the insight (title, standfirst, cover) unless overridden in its settings: lib/seo.ts.
  head: ({ loaderData }) => {
    if (!loaderData)
      return {
        meta: [
          { title: `Insight unavailable — ${SITE_NAME}` },
          { name: "robots", content: "noindex" },
        ],
      };
    const { post, settings } = loaderData;
    const seo = insightSeo(post, settings);
    return seoHead(seo, { jsonLd: articleLd(seo, post, readSeoSettings(settings)) });
  },
  notFoundComponent: () => (
    <main className="relative isolate">
      <Header />
      <section className="site-archive-hero">
        <p className="site-archive-eyebrow">Insights</p>
        <h1 className="site-archive-title">
          <LetterReveal text="Insight not found" />
        </h1>
        <Link to="/insights" className="site-article-back">
          ← All insights
        </Link>
      </section>
    </main>
  ),
  errorComponent: ArticleError,
  component: PostPage,
});

function ArticleError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <main className="site-archive-hero">
      <p className="site-archive-intro">
        This insight could not load. {error instanceof Error ? error.message : ""}
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

function ReadingProgress({ target }: { target: React.RefObject<HTMLElement | null> }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = target.current;
      if (!el || !bar.current) return;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      bar.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [target]);
  return (
    <div className="site-article-progress" aria-hidden="true">
      <div ref={bar} />
    </div>
  );
}

function PostPage() {
  const { slug } = Route.useParams();
  const { data: p } = useSuspenseQuery(postQuery(slug));
  const { data: all } = useSuspenseQuery(postsQuery);
  const articleRef = useRef<HTMLElement>(null);
  // Upgrade any Vimeo embeds in the body with player.js so the controls use the theme orange.
  useEffect(() => {
    let cancelled = false;
    import("@vimeo/player").then(({ default: Player }) => {
      if (cancelled) return;
      document
        .querySelectorAll<HTMLIFrameElement>('.site-prose iframe[src*="player.vimeo.com"]')
        .forEach((el) => {
          new Player(el).setColor("f4731c").catch(() => {});
        });
    });
    return () => {
      cancelled = true;
    };
  }, [p?.body]);
  // Upgrade native <video> tags in the body to video.js players with themed controls.
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void enhanceVideos(document).then((d) => {
      if (cancelled) d();
      else dispose = d;
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [p?.body]);
  if (!p) return null;
  const modules = parseModules(p.modules);
  const index = all.findIndex((x) => x.slug === slug);
  const newer = index > 0 ? all[index - 1] : undefined;
  const older = index >= 0 ? all[index + 1] : undefined;
  return (
    <main className="relative isolate">
      <SmoothScroll />
      <Header />
      <ReadingProgress target={articleRef} />
      <ArticleView
        articleRef={articleRef}
        title={p.title}
        excerpt={p.excerpt}
        cover_url={p.cover_url}
        author={p.author}
        published_at={p.published_at}
        modules={modules}
        legacyBody={usesLegacyBody(modules) ? p.body : undefined}
        older={older}
        newer={newer}
      />
      <Footer />
    </main>
  );
}

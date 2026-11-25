import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header, Footer } from "@/components/SiteChrome";
import { ArticleView } from "@/components/insights/ArticleView";
import { postsQuery } from "@/lib/content";
import { isStudioFrame, type StudioMessage } from "@/lib/studio-mode";
import type { PostDoc } from "@/lib/article-doc";

/** Canvas page for the article editor: the live article layout, filled from the editor's draft. */
export const Route = createFileRoute("/studio/article")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Article canvas — Content Studio" },
      { name: "description", content: "Content Studio article canvas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudioArticle,
});

function StudioArticle() {
  const [doc, setDoc] = useState<PostDoc | null>(null);
  const { data: all = [] } = useQuery(postsQuery);
  useEffect(() => {
    if (!isStudioFrame()) return;
    const on = (e: MessageEvent<StudioMessage>) => {
      if (e.origin === window.location.origin && e.data?.type === "studio-article")
        setDoc(e.data.post as PostDoc);
    };
    window.addEventListener("message", on);
    // This page may mount after the bridge's first "ready", so ask for the draft again.
    window.parent.postMessage(
      { type: "studio-ready" } satisfies StudioMessage,
      window.location.origin,
    );
    return () => window.removeEventListener("message", on);
  }, []);
  if (!doc)
    return (
      <main className="site-archive-hero">
        <p className="site-archive-intro">Open this page from the Content Studio.</p>
      </main>
    );
  const i = all.findIndex((x) => x.slug === doc.slug);
  const list = i >= 0 ? all : [];
  return (
    <main className="relative isolate">
      <Header />
      <ArticleView
        studio
        {...doc}
        newer={i > 0 ? list[i - 1] : undefined}
        older={i >= 0 ? list[i + 1] : undefined}
      />
      <Footer />
    </main>
  );
}

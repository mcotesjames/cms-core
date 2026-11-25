import { Link } from "@tanstack/react-router";
import { LetterReveal } from "@/components/LetterReveal";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { type ArticleModule } from "@/lib/modules";
import { ArticleModules } from "@/components/insights/ArticleModules";
import { formatPostDate } from "@/lib/format";
import { isFilled } from "@/lib/show-if";

type Neighbour = { slug: string; title: string; cover_url: string | null } | undefined;
export type ArticleViewProps = {
  title: string;
  excerpt: string;
  cover_url: string | null;
  author: string | null;
  published_at: string | null;
  modules: ArticleModule[];
  legacyBody?: string | undefined;
  older?: Neighbour;
  newer?: Neighbour;
  /** Content Studio canvas: adds data-cms markers so the bridge can edit in place. */
  studio?: boolean;
};

const s = (on: boolean | undefined, attrs: Record<string, string | boolean>) => (on ? attrs : {});

/** One article layout shared by the live page and the Content Studio canvas. */
export function ArticleView(p: ArticleViewProps & { articleRef?: React.Ref<HTMLElement> }) {
  const st = p.studio;
  return (
    <article ref={p.articleRef}>
      <header className="site-article-hero" {...s(st, { "data-cms-section": "post:details" })}>
        {(p.published_at || isFilled(p.author) || st) && (
          <p className="site-archive-eyebrow">
            {p.published_at ? formatPostDate(p.published_at) : st ? "Not yet published" : ""}
            {isFilled(p.author) && `${p.published_at || st ? " · " : ""}${p.author}`}
          </p>
        )}
        <h1 className="site-article-title" {...s(st, { "data-cms": "post:title" })}>
          {st ? p.title : <LetterReveal text={p.title} />}
        </h1>
        {(isFilled(p.excerpt) || st) && (
          <p
            className="site-article-standfirst"
            {...s(st, { "data-cms": "post:excerpt", "data-cms-multiline": true })}
          >
            {p.excerpt}
          </p>
        )}
      </header>
      {(isFilled(p.cover_url) || st) && (
        <div
          className="site-article-cover"
          {...s(st, { "data-cms-section": "post:cover", "data-cms-image": "post:cover_url" })}
        >
          {p.cover_url ? (
            <img src={p.cover_url} alt="" />
          ) : (
            <div className="studio-placeholder">Required cover image — click to upload</div>
          )}
        </div>
      )}
      <div className="site-article-panel" data-has-cover={Boolean(p.cover_url)}>
        <div className="site-prose">
          {p.legacyBody != null ? (
            <Markdown rehypePlugins={[rehypeRaw]}>{p.legacyBody}</Markdown>
          ) : st ? (
            p.modules.map((m, i) => <StudioBlock key={m.id} m={m} pinned={i === 0} />)
          ) : (
            <ArticleModules modules={p.modules} />
          )}
        </div>
        {(p.newer || p.older) && (
          <nav className="site-article-pager" aria-label="More insights">
            {p.older ? (
              <Link to="/insights/$slug" params={{ slug: p.older.slug }}>
                {p.older.cover_url && <img src={p.older.cover_url} alt="" loading="lazy" />}
                <span>Previous insight</span>
                <strong>{p.older.title}</strong>
              </Link>
            ) : (
              <span />
            )}
            {p.newer ? (
              <Link
                to="/insights/$slug"
                params={{ slug: p.newer.slug }}
                className="site-article-pager-next"
              >
                {p.newer.cover_url && <img src={p.newer.cover_url} alt="" loading="lazy" />}
                <span>Next insight</span>
                <strong>{p.newer.title}</strong>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </article>
  );
}

/** A block on the canvas: hover/select outline, ↑/↓/+ bar, and in-place text where it maps to one field. */
function StudioBlock({ m, pinned }: { m: ArticleModule; pinned: boolean }) {
  const f = (prop: string) => `post:block.${m.id}.${prop}`;
  const wrap = {
    "data-cms-section": `post:${m.id}`,
    "data-cms-insert": "",
    ...(pinned ? {} : { "data-cms-reorder": "" }),
  };
  let inner: React.ReactNode;
  if (m.type === "rich_text")
    inner = m.body.trim() ? (
      <Markdown rehypePlugins={[rehypeRaw]}>{m.body}</Markdown>
    ) : (
      <p className="studio-empty">
        {pinned
          ? "First paragraph (required) — write it in the side panel"
          : "Empty text — write it in the side panel"}
      </p>
    );
  else if (m.type === "pull_quote")
    inner = (
      <blockquote data-width={m.width ?? "column"}>
        <p data-cms={f("quote")} data-cms-multiline="">
          {m.quote}
        </p>
        <cite data-cms={f("attribution")}>{m.attribution}</cite>
      </blockquote>
    );
  else if (m.type === "stat_callout")
    inner = (
      <aside className="site-block-stat" data-width={m.width ?? "column"}>
        <strong data-cms={f("value")}>{m.value}</strong>
        <span data-cms={f("label")}>{m.label}</span>
        <small data-cms={f("footnote")}>{m.footnote}</small>
      </aside>
    );
  else if (m.type === "media")
    inner = m.url ? (
      <div data-cms-image={f("url")}>
        <ArticleModules modules={[m]} />
      </div>
    ) : (
      <div className="studio-placeholder" data-cms-image={f("url")}>
        Image — click to upload
      </div>
    );
  else if (m.type === "video" && !m.url)
    inner = (
      <div className="studio-placeholder">Video — add a Vimeo link or upload in the side panel</div>
    );
  else
    inner = (
      <div className="studio-static">
        <ArticleModules modules={[m]} />
      </div>
    );
  return (
    <div className="studio-flow" {...wrap}>
      {inner}
    </div>
  );
}

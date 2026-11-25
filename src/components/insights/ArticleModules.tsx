import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { type ArticleModule, blockHasContent, vimeoEmbedUrl } from "@/lib/modules";
import { isFilled } from "@/lib/show-if";

function Block({ m }: { m: ArticleModule }) {
  switch (m.type) {
    case "rich_text":
      return <Markdown rehypePlugins={[rehypeRaw]}>{m.body}</Markdown>;
    case "pull_quote":
      return (
        <blockquote data-width={m.width ?? "column"}>
          <p>{m.quote}</p>
          {isFilled(m.attribution) && <cite>{m.attribution}</cite>}
        </blockquote>
      );
    case "media":
      return (
        <figure className="site-block-media" data-layout={m.layout}>
          <div>
            <img src={m.url} alt={m.alt ?? ""} loading="lazy" />
            {m.layout === "two_up" && isFilled(m.secondary_url) && (
              <img src={m.secondary_url} alt={m.secondary_alt ?? ""} loading="lazy" />
            )}
          </div>
          {isFilled(m.caption) && <figcaption>{m.caption}</figcaption>}
        </figure>
      );
    case "video": {
      const vimeo = m.provider === "vimeo" ? vimeoEmbedUrl(m.url) : undefined;
      return (
        <figure className="site-block-media" data-layout="full_width">
          {vimeo ? (
            <iframe
              src={vimeo}
              title={m.caption || "Video"}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video src={m.url} controls preload="metadata" />
          )}
          {isFilled(m.caption) && <figcaption>{m.caption}</figcaption>}
        </figure>
      );
    }
    case "stat_callout":
      return (
        <aside className="site-block-stat" data-width={m.width ?? "column"}>
          {isFilled(m.value) && <strong>{m.value}</strong>}
          {isFilled(m.label) && <span>{m.label}</span>}
          {isFilled(m.footnote) && <small>{m.footnote}</small>}
        </aside>
      );
    case "divider":
      return m.style === "line" ? <hr /> : <div className="site-block-space" aria-hidden="true" />;
  }
}

export function ArticleModules({ modules }: { modules: ArticleModule[] }) {
  return (
    <>
      {modules.filter(blockHasContent).map((m) => (
        <Block key={m.id} m={m} />
      ))}
    </>
  );
}

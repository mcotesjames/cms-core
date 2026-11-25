import { anyFilled, isFilled } from "./show-if";
export type ModuleType =
  "rich_text" | "pull_quote" | "media" | "video" | "stat_callout" | "divider";

interface Base {
  id: string;
  type: ModuleType;
}

export type ArticleModule =
  | (Base & { type: "rich_text"; body: string })
  | (Base & { type: "pull_quote"; quote: string; attribution?: string; width?: "column" | "wide" })
  | (Base & {
      type: "media";
      url: string;
      alt?: string;
      caption?: string;
      layout: "contained" | "full_width" | "two_up";
      secondary_url?: string;
      secondary_alt?: string;
    })
  | (Base & { type: "video"; url: string; caption?: string; provider: "vimeo" | "native" })
  | (Base & {
      type: "stat_callout";
      value: string;
      label: string;
      footnote?: string;
      width?: "column" | "wide";
    })
  | (Base & { type: "divider"; style: "line" | "space" });

const TYPES: ModuleType[] = [
  "rich_text",
  "pull_quote",
  "media",
  "video",
  "stat_callout",
  "divider",
];

/** Keeps only well-formed blocks so a bad row never breaks the article page. */
export function parseModules(value: unknown): ArticleModule[] {
  if (!Array.isArray(value)) return [];
  return value.filter((m): m is ArticleModule => {
    if (!m || typeof m !== "object") return false;
    const b = m as Record<string, unknown>;
    if (typeof b["id"] !== "string" || !TYPES.includes(b["type"] as ModuleType)) return false;
    switch (b["type"]) {
      case "rich_text":
        return typeof b["body"] === "string";
      case "pull_quote":
        return typeof b["quote"] === "string" && b["quote"].length > 0;
      case "media":
        return typeof b["url"] === "string" && b["url"].length > 0;
      case "video":
        return (
          typeof b["url"] === "string" && (b["provider"] === "vimeo" || b["provider"] === "native")
        );
      case "stat_callout":
        return typeof b["value"] === "string" && typeof b["label"] === "string";
      default:
        return true;
    }
  });
}

/** Articles with no blocks fall back to the legacy Markdown body. */
export function usesLegacyBody(modules: ArticleModule[]): boolean {
  return modules.length === 0;
}

export function vimeoEmbedUrl(url: string): string | undefined {
  const id = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
  return id ? `https://player.vimeo.com/video/${id}` : undefined;
}

/** A block with nothing in its main field (text, quote, image, video, figure) is left out of the article. */
export function blockHasContent(m: ArticleModule): boolean {
  switch (m.type) {
    case "rich_text":
      return isFilled(m.body);
    case "pull_quote":
      return isFilled(m.quote);
    case "media":
      return isFilled(m.url);
    case "video":
      return isFilled(m.url);
    case "stat_callout":
      return anyFilled(m.value, m.label);
    case "divider":
      return true;
  }
}

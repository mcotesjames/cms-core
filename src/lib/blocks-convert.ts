import type { ArticleModule, ModuleType } from "@/lib/modules";
import { vimeoEmbedUrl } from "@/lib/modules";

let counter = 0;
export function blockId() {
  counter += 1;
  return `b${Date.now().toString(36)}${counter}`;
}

export function newBlock(type: ModuleType): ArticleModule {
  const id = blockId();
  switch (type) {
    case "rich_text":
      return { id, type, body: "" };
    case "pull_quote":
      return { id, type, quote: "", attribution: "", width: "column" };
    case "media":
      return { id, type, url: "", alt: "", caption: "", layout: "contained" };
    case "video":
      return { id, type, url: "", caption: "", provider: "vimeo" };
    case "stat_callout":
      return { id, type, value: "", label: "", footnote: "", width: "column" };
    case "divider":
      return { id, type, style: "line" };
  }
}

/** Groups consecutive text into Text blocks and lifts standalone media lines into their own blocks. */
function pushText(out: ArticleModule[], buf: string[]) {
  const body = buf.join("\n").trim();
  buf.length = 0;
  if (body) out.push({ id: blockId(), type: "rich_text", body });
}

/**
 * Converts a legacy Markdown body to blocks. Text is kept verbatim; only
 * standalone images, Vimeo iframes and native videos become their own blocks.
 */
export function markdownToBlocks(md: string): ArticleModule[] {
  const out: ArticleModule[] = [];
  const buf: string[] = [];
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    const t = line.trim();
    const img = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    const iframe = t.match(/^<iframe[^>]*src="([^"]*vimeo[^"]*)"[^>]*>(?:<\/iframe>)?$/i);
    const video = t.match(/^<video[^>]*src="([^"]+)"[^>]*>(?:.*<\/video>)?$/i);
    if (img) {
      pushText(out, buf);
      out.push({
        id: blockId(),
        type: "media",
        url: img[2]!,
        alt: img[1] ?? "",
        caption: "",
        layout: "contained",
      });
    } else if (iframe && vimeoEmbedUrl(iframe[1]!)) {
      pushText(out, buf);
      out.push({ id: blockId(), type: "video", url: iframe[1]!, caption: "", provider: "vimeo" });
    } else if (video) {
      pushText(out, buf);
      out.push({ id: blockId(), type: "video", url: video[1]!, caption: "", provider: "native" });
    } else if (t === "---") {
      pushText(out, buf);
      out.push({ id: blockId(), type: "divider", style: "line" });
    } else buf.push(line);
  }
  pushText(out, buf);
  return out;
}

function inline(node: Node): string {
  if (node.nodeType === 3) return (node.textContent ?? "").replace(/\s+/g, " ");
  if (node.nodeType !== 1) return "";
  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(inline).join("");
  if (!inner.trim()) return inner;
  const tag = el.tagName.toLowerCase();
  const style = el.getAttribute("style") ?? "";
  const bold =
    tag === "strong" ||
    (tag === "b" && !/font-weight:\s*(normal|400)/.test(style)) ||
    /font-weight:\s*(600|700|bold)/.test(style);
  const italic = tag === "i" || tag === "em" || /font-style:\s*italic/.test(style);
  let s = inner;
  if (tag === "a" && el.getAttribute("href")) s = `[${s}](${el.getAttribute("href")})`;
  if (bold) s = `**${s.trim()}**`;
  if (italic) s = `*${s.trim()}*`;
  if (tag === "br") return "\n";
  return s;
}

/**
 * Converts pasted HTML (Google Docs, Word, web pages) into blocks:
 * headings, paragraphs, lists and links become Text; quotes become Quote;
 * images become Image; Vimeo links on their own line become Video.
 */
export function htmlToBlocks(html: string): ArticleModule[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: ArticleModule[] = [];
  const buf: string[] = [];
  const walk = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      const tag = child.tagName.toLowerCase();
      const text = () => Array.from(child.childNodes).map(inline).join("").trim();
      if (/^h[1-6]$/.test(tag)) {
        const t = text().replace(/^\*\*(.*)\*\*$/, "$1");
        if (t) buf.push(`${"#".repeat(Math.max(2, Number(tag[1])))} ${t}`, "");
      } else if (tag === "p") {
        const imgs = child.querySelectorAll("img");
        const t = text();
        if (vimeoEmbedUrl(t) && /^\S+$/.test(t)) {
          pushText(out, buf);
          out.push({ id: blockId(), type: "video", url: t, caption: "", provider: "vimeo" });
        } else if (t) buf.push(t, "");
        imgs.forEach((img) => {
          pushText(out, buf);
          out.push({
            id: blockId(),
            type: "media",
            url: img.getAttribute("src") ?? "",
            alt: img.getAttribute("alt") ?? "",
            caption: "",
            layout: "contained",
          });
        });
      } else if (tag === "ul" || tag === "ol") {
        Array.from(child.children).forEach((li, i) =>
          buf.push(
            `${tag === "ol" ? `${i + 1}.` : "-"} ${Array.from(li.childNodes).map(inline).join("").trim()}`,
          ),
        );
        buf.push("");
      } else if (tag === "blockquote") {
        pushText(out, buf);
        const q = text();
        if (q)
          out.push({
            id: blockId(),
            type: "pull_quote",
            quote: q,
            attribution: "",
            width: "column",
          });
      } else if (tag === "img") {
        pushText(out, buf);
        out.push({
          id: blockId(),
          type: "media",
          url: child.getAttribute("src") ?? "",
          alt: child.getAttribute("alt") ?? "",
          caption: "",
          layout: "contained",
        });
      } else if (tag === "iframe" && vimeoEmbedUrl(child.getAttribute("src") ?? "")) {
        pushText(out, buf);
        out.push({
          id: blockId(),
          type: "video",
          url: child.getAttribute("src")!,
          caption: "",
          provider: "vimeo",
        });
      } else if (tag === "hr") {
        pushText(out, buf);
        out.push({ id: blockId(), type: "divider", style: "line" });
      } else if (tag === "br") continue;
      else if (child.children.length) walk(child);
      else {
        const t = text();
        if (t) buf.push(t, "");
      }
    }
  };
  walk(doc.body);
  pushText(out, buf);
  return out.filter((b) => b.type !== "media" || b.url);
}

import { describe, expect, it } from "vitest";
import { htmlToBlocks, markdownToBlocks } from "@/lib/blocks-convert";
import { articleProblems } from "@/lib/article-doc";

describe("legacy Markdown conversion", () => {
  it("keeps text verbatim and lifts standalone images and Vimeo embeds into blocks", () => {
    const md =
      'Intro **bold** line.\n\n![Chart](https://x.test/a.png)\n\n<iframe src="https://player.vimeo.com/video/123"></iframe>\n\nAfter.';
    const b = markdownToBlocks(md);
    expect(b.map((x) => x.type)).toEqual(["rich_text", "media", "video", "rich_text"]);
    expect(b[0]).toMatchObject({ body: "Intro **bold** line." });
    expect(b[1]).toMatchObject({ url: "https://x.test/a.png", alt: "Chart" });
  });
});

describe("paste from Google Docs", () => {
  it("maps headings, bold, links, quotes and images", () => {
    const html = `<b style="font-weight:normal" id="docs-internal-guid-1"><h2>Heading</h2><p><span style="font-weight:700">Bold</span> and <a href="https://a.test">link</a></p><blockquote>Quoted</blockquote><p><img src="https://x.test/i.png" alt="Pic"></p></b>`;
    const b = htmlToBlocks(html);
    expect(b.map((x) => x.type)).toEqual(["rich_text", "pull_quote", "media"]);
    expect(b[0]).toMatchObject({ body: "## Heading\n\n**Bold** and [link](https://a.test)" });
  });
});

describe("publishing rules", () => {
  const base = {
    title: "T",
    slug: "t",
    excerpt: "",
    cover_url: "c",
    author: "",
    published_at: null,
    modules: [{ id: "1", type: "rich_text" as const, body: "Lead" }],
  };
  it("allows a complete article", () => expect(articleProblems(base)).toEqual([]));
  it("requires the cover image", () =>
    expect(articleProblems({ ...base, cover_url: "" })).toContain("Add a cover image."));
  it("requires the first paragraph", () =>
    expect(
      articleProblems({ ...base, modules: [{ id: "1", type: "rich_text", body: " " }] }),
    ).toContain("Write the first paragraph."));
});

import { moveSection } from "@/lib/studio-mode";
describe("section reordering", () => {
  const order = ["intro", "pillars", "what", "bio"];
  it("moves a section down", () =>
    expect(moveSection(order, "pillars", 1)).toEqual(["intro", "what", "pillars", "bio"]));
  it("first section can't move up", () => expect(moveSection(order, "intro", -1)).toBeNull());
  it("last section can't move down", () => expect(moveSection(order, "bio", 1)).toBeNull());
});

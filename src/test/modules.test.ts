import { describe, expect, it } from "vitest";
import { parseModules, usesLegacyBody, vimeoEmbedUrl } from "@/lib/modules";

describe("article modules", () => {
  it("drops malformed blocks and keeps valid ones", () => {
    const out = parseModules([
      { id: "a", type: "rich_text", body: "Hi" },
      { id: "b", type: "media", url: "" },
      { id: "c", type: "unknown" },
      { id: "d", type: "video", url: "https://vimeo.com/1", provider: "vimeo" },
    ]);
    expect(out.map((m) => m.id)).toEqual(["a", "d"]);
  });
  it("falls back to the Markdown body when there are no blocks", () => {
    expect(usesLegacyBody(parseModules(null))).toBe(true);
    expect(usesLegacyBody(parseModules([{ id: "a", type: "divider", style: "line" }]))).toBe(false);
  });
  it("builds Vimeo player URLs", () => {
    expect(vimeoEmbedUrl("https://vimeo.com/76979871")).toBe(
      "https://player.vimeo.com/video/76979871",
    );
    expect(vimeoEmbedUrl("https://example.com")).toBeUndefined();
  });
});

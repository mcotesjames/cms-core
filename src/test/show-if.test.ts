import { describe, expect, it } from "vitest";
import { anyFilled, isFilled } from "@/lib/show-if";
import { blockHasContent, type ArticleModule } from "@/lib/modules";

describe("show if filled", () => {
  it("treats blank text, empty lists and missing values as empty", () => {
    for (const v of ["", "   ", "\n", null, undefined, false, [], ["", " "]])
      expect(isFilled(v)).toBe(false);
    for (const v of ["a", " 0 ", 0, ["", "x"], [{ id: "1" }], {}]) expect(isFilled(v)).toBe(true);
  });

  it("a container shows when any of its fields has content", () => {
    expect(anyFilled("", null, " ")).toBe(false);
    expect(anyFilled("", "Eyebrow")).toBe(true);
  });

  it("leaves empty article blocks out", () => {
    const b = (m: Record<string, unknown>) => ({ id: "x", ...m }) as unknown as ArticleModule;
    expect(blockHasContent(b({ type: "rich_text", body: "  " }))).toBe(false);
    expect(blockHasContent(b({ type: "pull_quote", quote: "", attribution: "Sam" }))).toBe(false);
    expect(blockHasContent(b({ type: "media", url: "" }))).toBe(false);
    expect(blockHasContent(b({ type: "stat_callout", value: "", label: "" }))).toBe(false);
    expect(blockHasContent(b({ type: "stat_callout", value: "40%", label: "" }))).toBe(true);
    expect(blockHasContent(b({ type: "divider", style: "line" }))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { anyFilled, isFilled } from "@/lib/show-if";

describe("show if filled", () => {
  it("treats blank text, empty lists and missing values as empty", () => {
    for (const v of ["", "   ", "\n", null, undefined, false, [], ["", " "], [null, [" "]]])
      expect(isFilled(v)).toBe(false);
    for (const v of ["a", " 0 ", 0, true, ["", "x"], [{ id: "1" }], {}])
      expect(isFilled(v)).toBe(true);
  });

  it("a container shows when any of its fields has content", () => {
    expect(anyFilled()).toBe(false);
    expect(anyFilled("", null, " ")).toBe(false);
    expect(anyFilled("", "Heading")).toBe(true);
  });
});

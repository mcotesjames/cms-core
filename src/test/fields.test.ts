import { describe, expect, it } from "vitest";
import {
  checkFieldDefs,
  fieldDefault,
  isEmptyValue,
  newGroupItem,
  richTextFromPlain,
  richTextPlain,
  safeHref,
  validateValues,
  type FieldDef,
} from "@/lib/fields";
import { isFilled } from "@/lib/show-if";

const text: FieldDef = {
  name: "title",
  label: "Title",
  type: "text",
  required: true,
  maxLength: 10,
};
const choice: FieldDef = {
  name: "size",
  label: "Size",
  type: "choice",
  options: [
    { value: "s", label: "Small" },
    { value: "l", label: "Large" },
  ],
};
const group: FieldDef = {
  name: "cards",
  label: "Cards",
  type: "group",
  min: 1,
  max: 2,
  fields: [{ name: "title", label: "Title", type: "text" }],
};

describe("field types", () => {
  it("give each type a sensible starting value", () => {
    expect(fieldDefault(text)).toBe("");
    expect(fieldDefault({ ...choice, multiple: true } as FieldDef)).toEqual([]);
    expect(fieldDefault({ name: "n", label: "N", type: "number", default: 3 })).toBe(3);
    expect(fieldDefault({ name: "b", label: "B", type: "boolean" })).toBe(false);
    expect(fieldDefault(group)).toEqual([]);
    expect(newGroupItem(group as Extract<FieldDef, { type: "group" }>, "x")).toEqual({
      id: "x",
      title: "",
    });
  });

  it("know when a value is empty (hidden on the site)", () => {
    expect(isEmptyValue(text, "  ")).toBe(true);
    expect(isEmptyValue({ name: "r", label: "R", type: "richText" }, richTextFromPlain(""))).toBe(
      true,
    );
    expect(isEmptyValue({ name: "l", label: "L", type: "link" }, { kind: "url", url: "" })).toBe(
      true,
    );
    expect(
      isEmptyValue({ name: "l", label: "L", type: "link" }, { kind: "page", page: "home" }),
    ).toBe(false);
    expect(isFilled(richTextFromPlain("Hello"))).toBe(true);
    expect(isFilled({ type: "doc", content: [] })).toBe(false);
  });

  it("validate values from their declarations", () => {
    expect(validateValues([text], { title: "" })).toEqual({ title: "Title is required." });
    expect(validateValues([text], { title: "far too long a title" })["title"]).toMatch(
      /at most 10/,
    );
    expect(validateValues([choice], { size: "xl" })["size"]).toMatch(/pick one/);
    expect(validateValues([choice], { size: "s" })).toEqual({});
    expect(validateValues([group], { cards: [] })["cards"]).toMatch(/at least 1/);
    expect(
      validateValues([group], { cards: [{ id: "a" }, { id: "b" }, { id: "c" }] })["cards"],
    ).toMatch(/at most 2/);
  });

  it("require an image's description unless it's decorative", () => {
    const img: FieldDef = { name: "photo", label: "Photo", type: "image", alt: "photo_alt" };
    const alt: FieldDef = { name: "photo_alt", label: "Alt", type: "text" };
    expect(
      validateValues([img, alt], { photo: "/media/a.jpg", photo_alt: "" })["photo_alt"],
    ).toMatch(/Describe the image/);
    expect(
      validateValues([{ ...img, decorative: true } as FieldDef, alt], { photo: "/media/a.jpg" }),
    ).toEqual({});
  });

  it("keep only safe links and known nodes in rich text", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com");
    expect(safeHref("/about")).toBe("/about");
    expect(safeHref("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
    const bad = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:x" } }] },
          ],
        },
      ],
    };
    const r = { name: "r", label: "Body", type: "richText" } as FieldDef;
    expect(validateValues([r], { r: bad })["r"]).toBeTruthy();
    expect(
      validateValues([r], { r: { type: "doc", content: [{ type: "script" }] } })["r"],
    ).toBeTruthy();
    expect(richTextPlain(richTextFromPlain("One\n\nTwo"))).toBe("One\nTwo");
  });

  it("check declarations, so a bad site config fails its build", () => {
    expect(checkFieldDefs([text, choice, group], "test")).toEqual([]);
    expect(checkFieldDefs([{ ...text, name: "Title" }], "test")[0]).toMatch(/lowercase/);
    expect(checkFieldDefs([text, text], "test")[0]).toMatch(/twice/);
    expect(
      checkFieldDefs([{ name: "c", label: "C", type: "choice", options: [] }], "test")[0],
    ).toMatch(/options/);
    expect(
      checkFieldDefs([{ ...group, fields: [group] } as FieldDef], "test").some((m) =>
        /can't contain groups/.test(m),
      ),
    ).toBe(true);
    expect(
      checkFieldDefs([{ name: "p", label: "P", type: "image", alt: "missing" }], "test")[0],
    ).toMatch(/alt field/);
  });
});

import { describe, expect, it } from "vitest";
import { recordStatus, recordTitle, recordType, recordUsage, sortRecords } from "@/lib/records";
import { validateSite } from "@/lib/site-config";

const person = recordType("person")!;

describe("record types", () => {
  it("come from the site config, with a title field", () => {
    expect(person.plural).toBe("Team");
    expect(recordTitle(person, { name: " Alex " })).toBe("Alex");
    expect(recordTitle(person, { name: "" })).toBe("Untitled");
    expect(recordType("nope")).toBeNull();
  });

  it("are checked when the site loads", () => {
    const base = { name: "X", url: "https://x.com" };
    const t = {
      label: "Thing",
      plural: "Things",
      fields: [{ name: "title", label: "Title", type: "text" as const }],
      titleField: "title",
      ordering: "manual" as const,
    };
    expect(() => validateSite({ ...base, recordTypes: { thing: t } })).not.toThrow();
    expect(() =>
      validateSite({ ...base, recordTypes: { thing: { ...t, titleField: "nope" } } }),
    ).toThrow(/titleField/);
    expect(() =>
      validateSite({ ...base, recordTypes: { thing: { ...t, ordering: { field: "nope" } } } }),
    ).toThrow(/ordering field/);
    expect(() =>
      validateSite({
        ...base,
        sections: {
          list: {
            label: "List",
            repeatable: true,
            fields: [{ name: "pick", label: "Pick", type: "reference", to: "missing" }],
            defaults: {},
          },
        },
      }),
    ).toThrow(/unknown record type/);
  });
});

describe("records", () => {
  it("know whether they're live, changed or never published", () => {
    expect(recordStatus({ publishedAt: null, draft: { a: 1 } })).toBe("draft");
    expect(recordStatus({ publishedAt: "2026-01-01", draft: null })).toBe("live");
    expect(recordStatus({ publishedAt: "2026-01-01", draft: { a: 1 } })).toBe("changes");
  });

  it("sort by manual position or by a field", () => {
    const rows = [
      { position: 2, values: { name: "Bea", n: 1 } },
      { position: 0, values: { name: "Cal", n: 3 } },
      { position: 1, values: { name: "Abe", n: 2 } },
    ];
    expect(sortRecords(person, rows).map((r) => r.values.name)).toEqual(["Cal", "Abe", "Bea"]);
    const byName = { ...person, ordering: { field: "name" } };
    expect(sortRecords(byName, rows).map((r) => r.values.name)).toEqual(["Abe", "Bea", "Cal"]);
    const byN = { ...person, ordering: { field: "n", direction: "desc" as const } };
    expect(sortRecords(byN, rows).map((r) => r.values.name)).toEqual(["Cal", "Abe", "Bea"]);
  });

  it("find where a record is referenced, live or in a draft", () => {
    const rows = [
      {
        key: "home",
        content: { section_data: { s1: { type: "team", people: ["p1"] } } },
        draft: null,
      },
      {
        key: "page_x",
        content: {},
        draft: { section_data: { s2: { type: "team", people: ["p2", "p1"] } } },
      },
      {
        key: "page_y",
        content: { section_data: { s3: { type: "team", people: ["p2"] } } },
        draft: null,
      },
    ];
    const title = (k: string) => (k === "home" ? "Homepage" : "About");
    expect(recordUsage(rows, title, "person", "p1")).toEqual(["Homepage → Team", "About → Team"]);
    expect(recordUsage(rows, title, "person", "p9")).toEqual([]);
  });
});

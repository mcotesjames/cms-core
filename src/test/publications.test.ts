import { describe, expect, it } from "vitest";
import {
  filterPublications,
  PLURAL_LABELS,
  PUBLICATION_TYPES,
  publicationTypes,
  publicationYears,
} from "@/lib/publications";

const rows = [
  { title: "Cobalt shocks", kind: "Paper", year: "2024" },
  { title: "Chip tooling", kind: "Policy", year: "2025" },
  { title: "Refinery notes", kind: "Paper", year: "2025" },
  { title: "Port friction", kind: "Commentary", year: "2023" },
  { title: "In conversation", kind: "Interview", year: "2025" },
];

describe("Publication filter dropdowns", () => {
  it("shows everything when both dropdowns are on All", () => {
    expect(filterPublications(rows, "All", "All")).toHaveLength(5);
  });
  it("filters by type alone", () => {
    expect(filterPublications(rows, "Paper", "All").map((row) => row.title)).toEqual([
      "Cobalt shocks",
      "Refinery notes",
    ]);
  });
  it("filters by year alone", () => {
    expect(filterPublications(rows, "All", "2025").map((row) => row.title)).toEqual([
      "Chip tooling",
      "Refinery notes",
      "In conversation",
    ]);
  });
  it("combines both dropdowns", () => {
    expect(filterPublications(rows, "Paper", "2025").map((row) => row.title)).toEqual([
      "Refinery notes",
    ]);
    expect(filterPublications(rows, "Interview", "2023")).toEqual([]);
  });
  it("lists types once each and years newest first", () => {
    expect(publicationTypes(rows)).toEqual(["Paper", "Policy", "Commentary", "Interview"]);
    expect(publicationYears(rows)).toEqual(["2025", "2024", "2023"]);
  });
  it("uses the client's plural labels", () => {
    expect(PLURAL_LABELS).toMatchObject({
      Paper: "Papers",
      Policy: "Policy",
      Commentary: "Commentary",
      Interview: "Interviews",
    });
  });
});

describe("publication types", () => {
  it("keeps the original types and adds the new ones, each once", () => {
    for (const t of [
      "Paper",
      "Policy",
      "Commentary",
      "Interview",
      "Thinktank Note",
      "Podcast",
      "Essay",
      "Policy Paper",
      "Roundtable",
      "Journal",
      "Article",
      "Working Paper",
      "Newspaper",
    ]) {
      expect(PUBLICATION_TYPES).toContain(t);
    }
    expect(new Set(PUBLICATION_TYPES).size).toBe(PUBLICATION_TYPES.length);
  });
  it("gives every type a filter label", () => {
    for (const t of PUBLICATION_TYPES) expect(PLURAL_LABELS[t]).toBeTruthy();
    expect(PLURAL_LABELS["Working Paper"]).toBe("Working Papers");
  });
});

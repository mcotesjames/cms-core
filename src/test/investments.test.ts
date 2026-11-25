import { describe, expect, it } from "vitest";
import {
  filterInvestments,
  INVESTMENT_SECTORS,
  investmentTags,
  investmentWebsite,
  sectorLabel,
  stageLabel,
} from "@/lib/investments";
import { formatMulti, parseMulti } from "@/lib/multi-value";

const rows = [
  { name: "Zulu", sector: "Solar" },
  { name: "Alpha", sector: "Space" },
  { name: "Bravo", sector: "Materials" },
  { name: "Delta", sector: "Solar" },
  { name: "Echo", sector: "Semiconductors" },
];

describe("Investment filtering", () => {
  it("offers the eight sectors the client specified plus All", () => {
    expect(INVESTMENT_SECTORS).toEqual([
      "All",
      "Space",
      "Solar",
      "Energy",
      "Semiconductors",
      "Materials",
      "Biotech",
      "Quantum",
      "Defense",
    ]);
  });
  it("shows all companies alphabetically by default", () => {
    expect(filterInvestments(rows, "All").map((row) => row.name)).toEqual([
      "Alpha",
      "Bravo",
      "Delta",
      "Echo",
      "Zulu",
    ]);
  });
  it("shows only Materials investments", () => {
    expect(filterInvestments(rows, "Materials").map((row) => row.name)).toEqual(["Bravo"]);
  });
  it("shows only Solar investments alphabetically", () => {
    expect(filterInvestments(rows, "Solar").map((row) => row.name)).toEqual(["Delta", "Zulu"]);
  });
  it("shows only Space investments", () => {
    expect(filterInvestments(rows, "Space").map((row) => row.name)).toEqual(["Alpha"]);
  });
  it("shows only Semiconductors investments", () => {
    expect(filterInvestments(rows, "Semiconductors").map((row) => row.name)).toEqual(["Echo"]);
  });
  it("rejects executable company website URLs", () => {
    expect(investmentWebsite("javascript:alert(1)")).toBeUndefined();
    expect(investmentWebsite("https://example.com")).toBe("https://example.com/");
  });
});

describe("multiple sectors", () => {
  const multi = [
    { name: "Orbit", sector: "Energy / Space" },
    { name: "Wafer", sector: "Solar" },
  ];
  it("an investment appears under each of its sectors", () => {
    expect(filterInvestments(multi, "Space").map((r) => r.name)).toEqual(["Orbit"]);
    expect(filterInvestments(multi, "Energy").map((r) => r.name)).toEqual(["Orbit"]);
    expect(filterInvestments(multi, "Solar").map((r) => r.name)).toEqual(["Wafer"]);
  });
  it("shows sectors in list order", () => {
    expect(sectorLabel("Energy / Space")).toBe("Space / Energy");
  });
});

describe("investment stages", () => {
  it("shows several stages in funding order, whatever order they were ticked", () => {
    expect(stageLabel("Series A / Seed")).toBe("Seed / Series A");
    expect(stageLabel("Late stage / Series B / Seed")).toBe("Seed / Series B / Late stage");
  });
  it("still reads a single old stage", () => {
    expect(stageLabel("Venture")).toBe("Venture");
  });
  it("tick-box values round-trip without duplicates", () => {
    expect(parseMulti("Seed / Series A / Seed")).toEqual(["Seed", "Series A"]);
    expect(formatMulti(["Series B", "Seed", "Growth"], ["Seed", "Series A", "Series B"])).toBe(
      "Seed / Series B / Growth",
    );
  });
  it("card tag line drops the dot when no stage is set", () => {
    expect(investmentTags({ sector: "Solar", stage: "Seed / Series A" })).toBe(
      "Solar · Seed / Series A",
    );
    expect(investmentTags({ sector: "Energy / Solar", stage: "Seed" })).toBe(
      "Solar / Energy · Seed",
    );
    expect(investmentTags({ sector: "Solar", stage: "" })).toBe("Solar");
    expect(investmentTags({ sector: "", stage: "Seed" })).toBe("Seed");
  });
});

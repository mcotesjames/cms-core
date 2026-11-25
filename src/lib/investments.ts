import { formatMulti, parseMulti } from "./multi-value";

/**
 * Sectors offered in the CMS (Records → Investments) and as filter buttons on the investments grid.
 * An investment can have several; they're stored together in the sector field ("Solar / Energy"),
 * in this order, and it appears under each of its sectors' filters.
 */
export const SECTOR_OPTIONS = [
  "Space",
  "Solar",
  "Energy",
  "Semiconductors",
  "Materials",
  "Biotech",
  "Quantum",
  "Defense",
] as const;
export const INVESTMENT_SECTORS = ["All", ...SECTOR_OPTIONS] as const;
export type InvestmentSector = (typeof INVESTMENT_SECTORS)[number];

export function filterInvestments<T extends { name: string; sector: string }>(
  rows: T[],
  sector: InvestmentSector,
): T[] {
  return rows
    .filter((row) => sector === "All" || parseMulti(row.sector).includes(sector))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Investment stages, in funding order. An investment can have several; they're stored together
 * in the stage field as one value ("Seed / Series A"), always in this order.
 */
export const INVESTMENT_STAGES = ["Seed", "Series A", "Series B", "Late stage"] as const;

/** "Seed / Series A" — the stages in funding order, for display. */
export function stageLabel(stage: string | null | undefined): string {
  return formatMulti(parseMulti(stage), INVESTMENT_STAGES);
}

/** "Solar / Energy" — the sectors in list order, for display. */
export function sectorLabel(sector: string | null | undefined): string {
  return formatMulti(parseMulti(sector), SECTOR_OPTIONS);
}

/** The small tag line on an investment card: "Solar / Energy · Seed / Series A" (no dangling dot when a part is empty). */
export function investmentTags(company: { sector: string; stage: string }): string {
  return [sectorLabel(company.sector), stageLabel(company.stage)].filter(Boolean).join(" · ");
}

export function investmentWebsite(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

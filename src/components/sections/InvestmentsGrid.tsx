import { useEffect, useRef, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { InvestmentCard } from "@/components/InvestmentCard";
import { investmentsQuery } from "@/lib/content";
import { useShow } from "@/lib/show-if";
import { filterInvestments, INVESTMENT_SECTORS, type InvestmentSector } from "@/lib/investments";

/** Filterable grid of investments (from Records → Investments) with the site-wide disclaimer below it. */
export function InvestmentsGrid({
  disclaimer,
  cms,
}: {
  disclaimer: string;
  cms?: string | undefined;
}) {
  const { data } = useSuspenseQuery(investmentsQuery);
  const [sector, setSector] = useState<InvestmentSector>("All");
  const [active, setActive] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rows = filterInvestments(data, sector);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useShow();
  const selectSector = (next: InvestmentSector) => {
    clearTimeout(timer.current);
    setActive(null);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSector(next);
      setChanging(false);
      return;
    }
    setChanging(true);
    timer.current = setTimeout(() => {
      setSector(next);
      setChanging(false);
    }, 160);
  };
  // No investments at all: the grid (with its filters) is left out of the live page.
  if (!show(data)) return null;
  return (
    <section className="site-investments-body">
      <div
        className="site-investments-filters"
        role="group"
        aria-label="Filter investments by sector"
      >
        {INVESTMENT_SECTORS.map((option) => (
          <Button
            variant="ghost"
            key={option}
            className="site-investments-filter"
            aria-pressed={sector === option}
            onClick={() => selectSector(option)}
          >
            {option}
          </Button>
        ))}
      </div>
      <label className="site-investments-select" data-active={sector !== "All"}>
        <span className="site-investments-select-label">Sector</span>
        <span className="site-investments-select-field">
          <select
            value={sector}
            onChange={(event) => selectSector(event.target.value as InvestmentSector)}
          >
            {INVESTMENT_SECTORS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </span>
      </label>
      <p className="sr-only" role="status">
        {rows.length} investments shown{sector !== "All" ? ` in ${sector}` : ""}.
      </p>
      <ul className="site-investments-grid" data-changing={changing}>
        {rows.map((company) => (
          <InvestmentCard
            key={company.id}
            company={company}
            open={active === company.id}
            onOpen={setActive}
          />
        ))}
      </ul>
      {rows.length === 0 && (
        <p className="site-investments-empty">No investments in this sector yet.</p>
      )}
      {show(disclaimer) && (
        <aside className="site-investments-disclaimer" aria-label="Investment disclaimer">
          <p data-cms={cms} data-cms-multiline>
            {disclaimer}
          </p>
        </aside>
      )}
    </section>
  );
}

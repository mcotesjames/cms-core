import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalArrow } from "@/components/ExternalArrow";
import { publicationsQuery } from "@/lib/content";
import { useStudioMode } from "@/lib/studio-mode";
import { anyFilled, isFilled, useShow } from "@/lib/show-if";
import {
  PLURAL_LABELS,
  filterPublications,
  publicationTypes,
  publicationYears,
} from "@/lib/publications";

type Publication = {
  id: string;
  title: string;
  kind: string;
  outlet: string | null;
  year: string;
  month: string | null;
  coauthors: string | null;
  summary: string | null;
  url: string;
  featured: boolean;
};

const usePublications = () => useSuspenseQuery(publicationsQuery).data as Publication[];

/** Pieces pinned to "Selected work" in Records → Publications. Hidden on the live site when none are pinned. */
export function PublicationsSelected({ label, cms }: { label: string; cms?: string | undefined }) {
  const items = usePublications();
  const studio = useStudioMode();
  const featured = useMemo(() => items.filter((item) => item.featured), [items]);
  const show = useShow();
  if (featured.length === 0) {
    return studio ? (
      <section className="site-publications-featured">
        <p className="studio-placeholder">
          Selected publications — no pieces are pinned yet. Pin them in Records → Publications.
        </p>
      </section>
    ) : null;
  }
  return (
    <section
      className="site-publications-featured"
      {...(isFilled(label)
        ? { "aria-labelledby": "publications-featured-heading" }
        : { "aria-label": "Selected work" })}
    >
      {show(label) && (
        <h2
          id="publications-featured-heading"
          className="site-publications-section-label"
          data-cms={cms}
        >
          {label}
        </h2>
      )}
      <ul className="site-publications-featured-grid" data-lenis-prevent-horizontal>
        {featured.map((item) => (
          <li
            key={item.id}
            className="site-publications-feature"
            {...(studio ? { "data-cms-record": `record:publications:${item.id}` } : {})}
          >
            <a
              className="site-publications-feature-link"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="sr-only"> (opens in new tab)</span>
              {isFilled(item.kind) && <span className="site-publications-kind">{item.kind}</span>}
              <span className="site-publications-feature-title">{item.title}</span>
              {anyFilled(item.outlet, item.year) && (
                <span className="site-publications-outlet">
                  {item.outlet}
                  {isFilled(item.outlet) && isFilled(item.year) && " · "}
                  {isFilled(item.year) && (
                    <span className="site-publications-mono">{item.year}</span>
                  )}
                </span>
              )}
              {isFilled(item.summary) && (
                <span className="site-publications-feature-summary">{item.summary}</span>
              )}
              <span className="site-publications-read">
                Read <ExternalArrow />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Every publication, grouped by year, with Type and Year filters. */
export function PublicationsIndex() {
  const items = usePublications();
  const [type, setType] = useState("All");
  const [year, setYear] = useState("All");

  const types = useMemo(() => publicationTypes(items), [items]);
  const years = useMemo(() => publicationYears(items), [items]);
  const filtered = useMemo(() => filterPublications(items, type, year), [items, type, year]);
  const show = useShow();
  const studio = useStudioMode();

  const groups = useMemo(() => {
    const map = new Map<string, Publication[]>();
    for (const item of filtered) {
      const key = item.year || "Undated";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()];
  }, [filtered]);

  // No publications at all: the index (with its filters) is left out of the live page.
  if (!show(items)) return null;
  return (
    <section className="site-publications-index" aria-label="All publications">
      <div className="site-publications-filters" role="group" aria-label="Filter publications">
        <label className="site-publications-select" data-active={type !== "All"}>
          <span className="site-publications-select-label">Type</span>
          <span className="site-publications-select-field">
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="All">All types</option>
              {types.map((option) => (
                <option key={option} value={option}>
                  {PLURAL_LABELS[option] ?? option}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="site-publications-select" data-active={year !== "All"}>
          <span className="site-publications-select-label">Year</span>
          <span className="site-publications-select-field">
            <select value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="All">All years</option>
              {years.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>

      <p className="sr-only" role="status">
        {filtered.length} publication{filtered.length === 1 ? "" : "s"} shown
        {type !== "All" ? ` of type ${PLURAL_LABELS[type] ?? type}` : ""}
        {year !== "All" ? ` from ${year}` : ""}.
      </p>

      <div className="site-publications-groups" key={`${type}|${year}`}>
        {groups.length === 0 && (
          <p className="site-publications-empty">No publications match these filters yet.</p>
        )}
        {groups.map(([groupYear, entries]) => (
          <section key={groupYear} className="site-publications-year" aria-label={groupYear}>
            <h2 className="site-publications-year-label site-publications-mono">{groupYear}</h2>
            <ul className="site-publications-list">
              {entries.map((item) => (
                <li
                  key={item.id}
                  className="site-publications-entry"
                  {...(studio ? { "data-cms-record": `record:publications:${item.id}` } : {})}
                >
                  <a
                    className="site-publications-entry-link"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sr-only"> (opens in new tab)</span>
                    <span className="site-publications-month site-publications-mono">
                      {item.month ?? "—"}
                    </span>
                    <span className="site-publications-entry-main">
                      <span className="site-publications-entry-title">{item.title}</span>
                      {anyFilled(item.outlet, item.coauthors) && (
                        <span className="site-publications-outlet">
                          {item.outlet}
                          {isFilled(item.coauthors) &&
                            `${isFilled(item.outlet) ? " · " : ""}with ${item.coauthors}`}
                        </span>
                      )}
                    </span>
                    {isFilled(item.kind) && (
                      <span className="site-publications-kind">{item.kind}</span>
                    )}
                    <span className="site-publications-arrow">
                      <ExternalArrow />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

import type { SiteSectionProps } from "@/lib/site-config";
import { useShow } from "@/lib/show-if";
import { usePublishedRecords, useReferencedRecords } from "@/lib/records-live";

const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Team: people from the Team records. Hand-picked people (a reference field) in the order picked,
 * otherwise the team in its own order, optionally only featured people and up to a number.
 * Unpublished or deleted people simply don't appear.
 */
export function Team({ values: v, cms }: SiteSectionProps) {
  const show = useShow();
  const picked = useReferencedRecords("person", v["people"]);
  const listed = usePublishedRecords("person", {
    filter: v["featured_only"] === true ? { featured: true } : {},
    limit: typeof v["limit"] === "number" ? v["limit"] : null,
  });
  const people = Array.isArray(v["people"]) && v["people"].length ? picked : listed;
  const heading = str(v["heading"]);
  if (!show(heading, people)) return null;
  return (
    <section className="site-section site-team">
      {show(heading) && <h2 data-cms={cms["heading"]}>{heading}</h2>}
      {people.length > 0 ? (
        <ul className="site-team-grid">
          {people.map((p) => (
            <li key={p.id} className="site-team-person">
              {str(p["photo"]) && <img src={str(p["photo"])} alt={str(p["photo_alt"])} />}
              <h3>{str(p["name"])}</h3>
              {show(p["role"]) && <p className="site-team-role">{str(p["role"])}</p>}
              {show(p["bio"]) && <p>{str(p["bio"])}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="site-team-empty">No published team members yet.</p>
      )}
    </section>
  );
}

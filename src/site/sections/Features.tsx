import type { SiteSectionProps } from "@/lib/site-config";
import { useShow } from "@/lib/show-if";
import { RichText } from "@/components/fields/FieldRender";

type Item = { id: string; title?: unknown; text?: unknown; highlight?: unknown };
const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Features: a heading, a rich text intro and a grid of repeating items. The fixture site's proof
 * that rich text and groups work end to end.
 */
export function Features({ values: v, cms }: SiteSectionProps) {
  const show = useShow();
  const heading = str(v["heading"]);
  const items = (Array.isArray(v["items"]) ? (v["items"] as Item[]) : []).filter((it) =>
    show(it.title, it.text),
  );
  if (!show(heading, v["intro"], items)) return null;
  return (
    <section className="site-section site-features">
      {show(heading) && <h2 data-cms={cms["heading"]}>{heading}</h2>}
      {show(v["intro"]) && <RichText value={v["intro"]} className="site-features-intro" />}
      {items.length > 0 && (
        <ul className="site-features-grid">
          {items.map((it) => (
            <li key={it.id} className="site-features-item" data-highlight={it.highlight === true}>
              {show(it.title) && <h3>{str(it.title)}</h3>}
              {show(it.text) && <p>{str(it.text)}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

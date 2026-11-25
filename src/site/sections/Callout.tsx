import type { SiteSectionProps } from "@/lib/site-config";
import { useShow } from "@/lib/show-if";
import { FieldLink, RichText } from "@/components/fields/FieldRender";
import { asRichText } from "@/lib/fields";

const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Callout: a heading, a short rich text (edited in the side panel) and a button, on a tinted band. A site section: declared in
 * site.config.ts, rendered by the platform's page renderer, edited in the Studio like any other.
 * The button uses a link field, so it points at a page (or section, address, email), not a path.
 */
export function Callout({ values: v, cms }: SiteSectionProps) {
  const show = useShow();
  const heading = str(v["heading"]);
  // Rich text; callouts saved before it was rich text hold plain text, shown as paragraphs.
  const text = asRichText(v["text"]);
  const label = str(v["button_label"]);
  if (!show(heading, text, label)) return null;
  return (
    <section className="site-section site-callout">
      <div className="site-callout-inner">
        {show(heading) && <h2 data-cms={cms["heading"]}>{heading}</h2>}
        {show(text) && <RichText value={text} className="site-callout-text" />}
        {show(label) && (
          <FieldLink
            value={v["button_link"]}
            className="site-callout-button"
            keepText
            data-cms={cms["button_label"]}
          >
            {label}
          </FieldLink>
        )}
      </div>
    </section>
  );
}

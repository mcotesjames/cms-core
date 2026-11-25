import type { SiteSectionProps } from "@/lib/site-config";
import { useShow } from "@/lib/show-if";

/**
 * Callout: a heading, a short text and a button, on a tinted band. A site section: declared in
 * site.config.ts, rendered by the platform's page renderer, edited in the Studio like any other.
 */
export function Callout({ values: v, cms }: SiteSectionProps) {
  const show = useShow();
  if (!show(v["heading"], v["text"], v["button_label"])) return null;
  const href = v["button_url"]?.trim();
  return (
    <section className="site-section site-callout">
      <div className="site-callout-inner">
        {show(v["heading"]) && <h2 data-cms={cms["heading"]}>{v["heading"]}</h2>}
        {show(v["text"]) && (
          <p data-cms={cms["text"]} data-cms-multiline>
            {v["text"]}
          </p>
        )}
        {show(v["button_label"]) &&
          (href ? (
            <a className="site-callout-button" href={href} data-cms={cms["button_label"]}>
              {v["button_label"]}
            </a>
          ) : (
            <span className="site-callout-button" data-cms={cms["button_label"]}>
              {v["button_label"]}
            </span>
          ))}
      </div>
    </section>
  );
}

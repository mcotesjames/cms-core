import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { ExternalArrow } from "@/components/ExternalArrow";
import { isFilled, useShow } from "@/lib/show-if";

type Hotspot = {
  id: string;
  label: string;
  x: number;
  y: number;
  body: string;
  items: string[];
  link_url: string;
};

export type BioText = {
  name: string;
  description: string;
  portrait_url: string;
  portrait_alt: string;
};

/** `text` is the section's own name, description and portrait; `cms` holds their CMS field addresses. */
export function Bio({
  hotspots,
  text: bio,
  cms,
}: {
  hotspots: Hotspot[];
  text: BioText;
  cms: Partial<Record<keyof BioText, string>>;
}) {
  const [active, setActive] = useState<string | null>(null);
  const show = useShow();
  if (!show(bio.name, bio.description, bio.portrait_url, hotspots)) return null;
  return (
    <section id="founder" className="site-bio">
      <div className="site-bio-inner">
        {show(bio.name, bio.description) && (
          <div className="site-bio-static">
            {show(bio.name) && (
              <h2 className="site-bio-eyebrow" data-cms={cms.name}>
                {bio.name}
              </h2>
            )}
            {show(bio.description) && (
              <p className="site-bio-description" data-cms={cms.description} data-cms-multiline>
                {bio.description}
              </p>
            )}
          </div>
        )}
        {show(bio.portrait_url) && (
          <div className="site-bio-image-wrap" data-cms-image={cms.portrait_url}>
            {isFilled(bio.portrait_url) ? (
              <img src={bio.portrait_url} alt={bio.portrait_alt} className="site-bio-image" />
            ) : (
              <div className="studio-placeholder">Portrait — click to upload</div>
            )}
          </div>
        )}
        {hotspots.map((point) => {
          const open = active === point.id;
          return (
            <div
              key={point.id}
              className="site-bio-point"
              data-cms-item={`hotspots:${point.id}`}
              data-open={open}
              style={{ "--bio-x": `${point.x}%`, "--bio-y": `${point.y}%` } as CSSProperties}
              onMouseEnter={() => {
                if (window.matchMedia("(hover: hover) and (min-width: 992px)").matches)
                  setActive(point.id);
              }}
              onMouseLeave={() => {
                if (window.matchMedia("(hover: hover) and (min-width: 992px)").matches)
                  setActive(null);
              }}
            >
              {isFilled(point.link_url) ? (
                <a
                  className="site-bio-trigger"
                  href={point.link_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="site-bio-indicator" />
                  <span>{point.label}</span>
                  <ExternalArrow />
                </a>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    className="site-bio-trigger"
                    aria-expanded={open}
                    aria-controls={`bio-panel-${point.id}`}
                    onClick={() => setActive(open ? null : point.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setActive(null);
                    }}
                  >
                    <span className="site-bio-indicator" />
                    <span>{point.label}</span>
                    <span className="site-bio-chevron" aria-hidden="true" />
                  </Button>
                  <div
                    id={`bio-panel-${point.id}`}
                    className="site-bio-point-panel"
                    aria-hidden={!open}
                  >
                    <div className="site-bio-panel-inner">
                      {isFilled(point.body) && <p className="site-bio-point-text">{point.body}</p>}
                      {isFilled(point.items) && (
                        <ul className="site-bio-point-list">
                          {point.items.filter(isFilled).map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

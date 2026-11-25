import { Fragment } from "react";
import { useSiteContent } from "@/lib/site-content";
import { useStudioMode } from "@/lib/studio-mode";
import {
  readField,
  sectionDef,
  resolveSections,
  type Doc,
  type PageKey,
  type SectionInstance,
} from "@/lib/page-sections";
import { TEMPLATES, templateOf } from "@/lib/templates";
import { sectionAnchor } from "@/lib/menus";
import { useShow } from "@/lib/show-if";
import { Footer, Header } from "@/components/SiteChrome";
import { templateDef } from "@/lib/templates";

/** A section's field values (live, or the draft inside the Studio canvas). */
function useFieldValues(inst: SectionInstance): Record<string, string> {
  const site = useSiteContent() as unknown as Doc;
  return Object.fromEntries(
    Object.entries(inst.fields).map(([name, addr]) => [name, readField(site, addr)]),
  );
}

/** Text: an optional heading and paragraphs (blank lines separate them). */
function TextSection({ inst }: { inst: SectionInstance }) {
  const t = useFieldValues(inst);
  const show = useShow();
  if (!show(t["heading"], t["body"])) return null;
  return (
    <section className="site-section site-text">
      {show(t["heading"]) && <h2 data-cms={inst.fields["heading"]}>{t["heading"]}</h2>}
      {show(t["body"]) && (
        <div className="site-text-body" data-cms={inst.fields["body"]} data-cms-multiline>
          {t["body"]}
        </div>
      )}
    </section>
  );
}

/** Image: one image with alt text and an optional caption, contained or full width. */
function ImageSection({ inst }: { inst: SectionInstance }) {
  const t = useFieldValues(inst);
  const show = useShow();
  const studio = useStudioMode();
  if (!show(t["image_url"])) return null;
  return (
    <figure
      className="site-section site-image"
      data-width={t["width"] === "full" ? "full" : "contained"}
    >
      {t["image_url"] ? (
        <img
          src={t["image_url"]}
          alt={t["alt"] ?? ""}
          loading="lazy"
          data-cms-image={inst.fields["image_url"]}
        />
      ) : (
        studio && (
          <div className="studio-placeholder" data-cms-image={inst.fields["image_url"]}>
            Add an image — click to upload
          </div>
        )
      )}
      {show(t["caption"]) && (
        <figcaption data-cms={inst.fields["caption"]}>{t["caption"]}</figcaption>
      )}
    </figure>
  );
}

/** A site's own section (site.config.ts `sections`): its component gets values and CMS addresses. */
function SiteSection({ inst }: { inst: SectionInstance }) {
  const values = useFieldValues(inst);
  const Component = sectionDef(inst.type).component;
  return Component ? <Component values={values} cms={inst.fields} /> : null;
}

function Section({ inst }: { inst: SectionInstance }) {
  switch (inst.type) {
    case "text":
      return <TextSection inst={inst} />;
    case "image":
      return <ImageSection inst={inst} />;
    default:
      return <SiteSection inst={inst} />;
  }
}

/**
 * A page's flexible sections, in the order stored for that page. In the Studio canvas each
 * section is wrapped so it can be selected, moved, deleted and have sections added after it.
 */
export function PageSections({ page }: { page: PageKey }) {
  const doc = (useSiteContent() as unknown as Doc)[page];
  const studio = useStudioMode();
  const sections = resolveSections(page, doc);
  return (
    <>
      {sections.map((inst) =>
        studio ? (
          <div
            key={inst.id}
            id={sectionAnchor(inst.id)}
            data-cms-section={`${page}:${inst.id}`}
            data-cms-reorder
            data-cms-insert
          >
            <Section inst={inst} />
          </div>
        ) : (
          <Fragment key={inst.id}>
            {/* Stable anchor for menu links to this section ("/#section-<id>"). */}
            <div id={sectionAnchor(inst.id)} aria-hidden="true" />
            <Section inst={inst} />
          </Fragment>
        ),
      )}
      {studio && sections.length === 0 && (
        <p className="studio-placeholder studio-empty-page">
          No sections yet — hover the hero and press + to add one.
        </p>
      )}
    </>
  );
}

/**
 * The pinned hero every page starts with: its title (the page's one H1) and a short intro. In the
 * Studio canvas it can be selected and have sections added after it, but not moved or deleted.
 */
function Hero({ page }: { page: PageKey }) {
  const doc = (useSiteContent() as unknown as Doc)[page];
  const show = useShow();
  const studio = useStudioMode();
  const title = typeof doc?.["intro"]?.["title"] === "string" ? doc["intro"]["title"] : "";
  const summary = typeof doc?.["intro"]?.["summary"] === "string" ? doc["intro"]["summary"] : "";
  const hero = show(title, summary) && (
    <section className="site-hero">
      {show(title) && <h1 data-cms={`${page}:intro.title`}>{title}</h1>}
      {show(summary) && (
        <p className="site-hero-intro" data-cms={`${page}:intro.summary`} data-cms-multiline>
          {summary}
        </p>
      )}
    </section>
  );
  return studio ? (
    <div data-cms-section={`${page}:hero`} data-cms-insert>
      {hero}
    </div>
  ) : (
    hero || null
  );
}

/** A whole page: header, pinned hero (if its template has one), sections, footer. */
export function PageView({ page, fallbackTitle }: { page: PageKey; fallbackTitle: string }) {
  const doc = (useSiteContent() as unknown as Doc)[page];
  const studio = useStudioMode();
  const hasHero = templateDef(templateOf(page, doc)).hero;
  return (
    <>
      <Header />
      <main id="main" className="site-main">
        {/* Without a hero, keep one page heading for screen readers and search engines. */}
        {hasHero ? <Hero page={page} /> : <h1 className="sr-only">{fallbackTitle}</h1>}
        <PageSections page={page} />
      </main>
      {/* In the canvas the footer is selectable as a whole: its text is site-wide (Settings). */}
      {studio ? (
        <div data-cms-section="settings:footer">
          <Footer />
        </div>
      ) : (
        <Footer />
      )}
    </>
  );
}

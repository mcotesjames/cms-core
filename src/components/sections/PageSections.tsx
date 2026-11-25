import { Fragment } from "react";
import { useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { homeQuery, investmentsQuery, postsQuery, publicationsQuery } from "@/lib/content";
import { useSiteContent } from "@/lib/site-content";
import { useStudioMode } from "@/lib/studio-mode";
import {
  readField,
  resolveSections,
  type Doc,
  type PageKey,
  type SectionInstance,
} from "@/lib/page-sections";
import { sectionAnchor } from "@/lib/menus";
import { useShow } from "@/lib/show-if";
import { TextBlock, Pillars, StackCards, Bio } from "@/components/home/Sections";
import { InsightsFeed } from "./InsightsFeed";
import { InvestmentsGrid } from "./InvestmentsGrid";
import { PublicationsIndex, PublicationsSelected } from "./Publications";
import { Interactive } from "./Interactive";

/** Any section can sit on any page, so every page preloads the data its sections may need. */
export function ensureSectionData(qc: QueryClient) {
  return Promise.all(
    [homeQuery, postsQuery, investmentsQuery, publicationsQuery].map((q) =>
      qc.ensureQueryData(q as never),
    ),
  );
}

/** Reads a "key:path.to.field" CMS address from the site content (live, or the draft inside the Studio). */
function useFieldValues(inst: SectionInstance): Record<string, string> {
  const site = useSiteContent() as unknown as Doc;
  const values = Object.fromEntries(
    Object.entries(inst.fields).map(([name, addr]) => [name, readField(site, addr)]),
  );
  // An interactive's file name is managed by the panel's file control, not a field of its own.
  const html = inst.fields["html_url"];
  if (inst.type === "interactive" && html)
    values["file_name"] = readField(site, html.replace(/\.html_url$/, ".file_name"));
  return values;
}

function Section({ inst }: { inst: SectionInstance }) {
  const t = useFieldValues(inst);
  const cms = inst.fields;
  const show = useShow();
  switch (inst.type) {
    case "statement":
      return <TextBlock text={t["text"]!} cms={cms["text"]} />;
    case "pillars":
      return <PillarsSection />;
    case "cards":
      return <CardsSection text={{ eyebrow: t["eyebrow"]!, intro: t["intro"]! }} cms={cms} />;
    case "bio":
      return (
        <BioSection
          text={{
            name: t["name"]!,
            description: t["description"]!,
            portrait_url: t["portrait_url"]!,
            portrait_alt: t["portrait_alt"]!,
          }}
          cms={cms}
        />
      );
    case "insights_list":
      return <InsightsFeed label={t["label"]!} cms={cms["label"]} />;
    case "investments_grid":
      return <InvestmentsGrid disclaimer={t["disclaimer"]!} cms={cms["disclaimer"]} />;
    case "publications_selected":
      return <PublicationsSelected label={t["label"]!} cms={cms["label"]} />;
    case "publications_index":
      return <PublicationsIndex />;
    case "footnote":
      if (!show(t["text"])) return null;
      return (
        <section className="site-footnote-section">
          <p className="site-publications-footnote" data-cms={cms["text"]} data-cms-multiline>
            {t["text"]}
          </p>
        </section>
      );
    case "interactive":
      return (
        <Interactive
          url={t["html_url"]!}
          title={t["title"]!}
          height={t["height"]!}
          fileName={t["file_name"]!}
          cms={cms}
        />
      );
  }
}

function PillarsSection() {
  const { data } = useSuspenseQuery(homeQuery);
  return <Pillars pillars={data.pillars} />;
}
function CardsSection(p: Omit<React.ComponentProps<typeof StackCards>, "cards">) {
  const { data } = useSuspenseQuery(homeQuery);
  return <StackCards cards={data.cards} {...p} />;
}
function BioSection(p: Omit<React.ComponentProps<typeof Bio>, "hotspots">) {
  const { data } = useSuspenseQuery(homeQuery);
  return (
    <Bio hotspots={data.hotspots.map((h) => ({ ...h, x: Number(h.x), y: Number(h.y) }))} {...p} />
  );
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
      {/* The hero's "Discover" button scrolls here, whichever section comes first. */}
      <div id="page-sections" aria-hidden="true" />
      {sections.map((inst) =>
        studio ? (
          <div
            key={inst.id}
            id={sectionAnchor(inst.id)}
            data-cms-section={`${page}:${inst.id}`}
            data-cms-reorder
            data-cms-insert
          >
            {<Section inst={inst} />}
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

/** Wraps a page's pinned hero in the Studio canvas so it can be selected and have sections added after it. */
export function StudioHero({ page, children }: { page: PageKey; children: React.ReactNode }) {
  const studio = useStudioMode();
  return studio ? (
    <div data-cms-section={`${page}:hero`} data-cms-insert>
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}

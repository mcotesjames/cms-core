import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldsEditor } from "./fields/FieldInput";
import { useSiteContent } from "@/lib/site-content";
import { useReferenceOptions } from "./useRecords";
import type { FieldDef } from "@/lib/fields";
import { getPath, setPath, useSiteDraft } from "./useSiteDraft";
import type { Doc } from "@/lib/page-sections";

/** A field on a one-form screen: a field type declaration plus where it's stored in the row. */
export type DraftField = FieldDef & { path: string };
export type DraftSection = { key: string; title: string; fields: DraftField[]; note?: string };

export function PublishBar({
  hasDraft,
  save,
  onPublish,
  onDiscard,
}: {
  hasDraft: boolean;
  save: string;
  onPublish: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant={hasDraft ? "changes" : "live"}>
        {hasDraft ? "Unpublished changes" : "Live"}
      </Badge>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {save === "saving"
          ? "Saving draft…"
          : save === "saved"
            ? "Draft saved"
            : save === "error"
              ? "Draft not saved"
              : ""}
      </span>
      {hasDraft && (
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          Discard
        </Button>
      )}
      <Button size="sm" disabled={!hasDraft} onClick={onPublish}>
        {hasDraft ? "Publish" : "Published"}
      </Button>
    </div>
  );
}

/**
 * One-form editor for a page or settings row, with draft-and-live publishing. With `tabs`, each
 * section is a tab (the active one is kept in the address as `?tab=`); otherwise they stack.
 */
export function DraftForm({
  contentKey,
  title,
  summary,
  sections,
  extra,
  tabs = false,
}: {
  contentKey: string;
  title: string;
  summary?: string;
  sections: DraftSection[];
  extra?: ((doc: Doc, update: (d: Doc) => void) => React.ReactNode) | undefined;
  tabs?: boolean;
}) {
  const { doc, update, publish, discard, hasDraft, save } = useSiteDraft(contentKey);
  const liveSite = useSiteContent() as unknown as Record<string, unknown>;
  const referenceOptions = useReferenceOptions();
  const [tab, setTab] = useState(() => {
    const t =
      typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab");
    return sections.some((s) => s.key === t) ? t! : (sections[0]?.key ?? "");
  });
  const choose = (key: string) => {
    setTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(window.history.state, "", url);
  };
  if (!doc) return <p className="text-muted-foreground">Loading…</p>;
  const shown = tabs ? sections.filter((s) => s.key === tab) : sections;
  return (
    <div className="max-w-[720px]">
      <div className="sticky top-0 z-10 -mx-2 mb-4 flex flex-wrap items-center justify-between gap-4 bg-card px-2 py-3">
        <div>
          <h1>{title}</h1>
          {summary && <p className="studio-help mt-0.5">{summary}</p>}
        </div>
        <PublishBar hasDraft={hasDraft} save={save} onPublish={publish} onDiscard={discard} />
      </div>
      {tabs && (
        <div className="studio-tabs" role="tablist" aria-label={`${title} groups`}>
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              id={`tab-${s.key}`}
              aria-selected={s.key === tab}
              aria-controls={`panel-${s.key}`}
              onClick={() => choose(s.key)}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}
      {extra?.(doc, update)}
      {shown.map((s) => (
        <section
          key={s.key}
          {...(tabs
            ? { role: "tabpanel", id: `panel-${s.key}`, "aria-labelledby": `tab-${s.key}` }
            : {})}
          className={tabs ? "space-y-5 pt-6" : "mb-8 space-y-5 border-t border-border pt-6"}
        >
          {!tabs && <h2 className="studio-section-title">{s.title}</h2>}
          {s.note && <p className="studio-help">{s.note}</p>}
          <FieldsEditor
            defs={s.fields}
            values={Object.fromEntries(s.fields.map((f) => [f.name, getPath(doc, f.path)]))}
            onChange={(name, v) => {
              const f = s.fields.find((x) => x.name === name);
              if (f) update(setPath(doc, f.path, v));
            }}
            ctx={{ site: liveSite, referenceOptions }}
          />
        </section>
      ))}
    </div>
  );
}

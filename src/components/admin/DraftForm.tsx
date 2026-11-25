import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldsEditor } from "./fields/FieldInput";
import { useSiteContent } from "@/lib/site-content";
import type { FieldDef } from "@/lib/fields";
import { getPath, setPath, useSiteDraft } from "./useSiteDraft";
import type { Doc } from "@/lib/page-sections";

/** A field on a one-form screen: a field type declaration plus where it's stored in the row. */
export type DraftField = FieldDef & { path: string };
export type DraftSection = { title: string; fields: DraftField[]; note?: string };

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

/** One-form editor for a page or settings row, with draft-and-live publishing. */
export function DraftForm({
  contentKey,
  title,
  sections,
  extra,
}: {
  contentKey: string;
  title: string;
  sections: DraftSection[];
  extra?: ((doc: Doc, update: (d: Doc) => void) => React.ReactNode) | undefined;
}) {
  const { doc, update, publish, discard, hasDraft, save } = useSiteDraft(contentKey);
  const liveSite = useSiteContent() as unknown as Record<string, unknown>;
  if (!doc) return <p className="text-muted-foreground">Loading…</p>;
  return (
    <div className="max-w-3xl">
      <div className="sticky top-0 z-10 -mx-2 mb-8 flex flex-wrap items-center justify-between gap-4 bg-card px-2 py-3">
        <h1>{title}</h1>
        <PublishBar hasDraft={hasDraft} save={save} onPublish={publish} onDiscard={discard} />
      </div>
      {extra?.(doc, update)}
      {sections.map((s) => (
        <section key={s.title} className="mb-8 space-y-5 border-t border-border pt-6">
          <h2 className="studio-section-title">{s.title}</h2>
          {s.note && <p className="text-sm text-muted-foreground">{s.note}</p>}
          <FieldsEditor
            defs={s.fields}
            values={Object.fromEntries(s.fields.map((f) => [f.name, getPath(doc, f.path)]))}
            onChange={(name, v) => {
              const f = s.fields.find((x) => x.name === name);
              if (f) update(setPath(doc, f.path, v));
            }}
            ctx={{ site: liveSite }}
          />
        </section>
      ))}
    </div>
  );
}

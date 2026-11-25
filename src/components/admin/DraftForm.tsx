import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { uploadMedia } from "@/lib/media";
import { getPath, setPath, useSiteDraft } from "./useSiteDraft";
import type { Doc } from "@/lib/page-sections";

export type DraftField = { path: string; label: string; type?: "text" | "textarea" | "image" };
export type DraftSection = { title: string; fields: DraftField[]; note?: string };

function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      {value && <img src={value} alt="" className="h-28 w-auto rounded-md object-cover" />}
      <Input
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            onChange(await uploadMedia(f));
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

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
          {s.fields.map((f) => {
            const v = String(getPath(doc, f.path) ?? "");
            const set = (nv: string) => update(setPath(doc, f.path, nv));
            return (
              <label key={f.path} className="block space-y-2">
                <span className="studio-field-label">{f.label}</span>
                {f.type === "textarea" ? (
                  <Textarea rows={4} value={v} onChange={(e) => set(e.target.value)} />
                ) : f.type === "image" ? (
                  <ImageField value={v} onChange={set} />
                ) : (
                  <Input value={v} onChange={(e) => set(e.target.value)} />
                )}
              </label>
            );
          })}
        </section>
      ))}
    </div>
  );
}

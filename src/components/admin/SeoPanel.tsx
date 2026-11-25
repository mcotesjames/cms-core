import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { uploadMedia } from "@/lib/media";
import {
  DESCRIPTION_LIMIT,
  TITLE_LIMIT,
  tooLong,
  type ResolvedSeo,
  type SeoFields,
} from "@/lib/seo";

/** "Automatic" or "Custom · Reset" next to a field's label. */
function Origin({ custom, onReset }: { custom: boolean; onReset: () => void }) {
  return custom ? (
    <span className="text-[11px] normal-case tracking-normal text-muted-foreground">
      Custom ·{" "}
      <button
        type="button"
        className="underline underline-offset-2 hover:text-foreground"
        onClick={onReset}
      >
        Reset
      </button>
    </span>
  ) : (
    <span className="text-[11px] normal-case tracking-normal text-muted-foreground">Automatic</span>
  );
}

/**
 * A field's label row. The label points at its input by id, and the Automatic / Reset note sits
 * beside it rather than inside it: a button inside a <label> would take the label over (clicking
 * the label text would press Reset, and the input would lose its accessible name).
 */
function Label({
  text,
  htmlFor,
  children,
}: {
  text: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <span className="flex items-baseline justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
      {htmlFor ? <label htmlFor={htmlFor}>{text}</label> : <span>{text}</span>}
      {children}
    </span>
  );
}

function Counter({ n, limit }: { n: number; limit: number }) {
  return (
    <span
      className={`block text-right text-[11px] ${tooLong("x".repeat(n), limit) ? "text-amber-400" : "text-muted-foreground"}`}
    >
      {n} / {limit}
      {n > limit && " — may be cut off in search results"}
    </span>
  );
}

/**
 * Search & sharing settings for a page or insight: a Google-style preview, then search title,
 * description and share image — each automatic unless typed in — and, under More, hiding from
 * search engines plus anything page-specific (`more`). Changes save to the draft like any edit.
 */
export function SeoPanel({
  seo,
  fields,
  set,
  more,
  home,
}: {
  seo: ResolvedSeo;
  fields: SeoFields;
  set: (patch: Partial<SeoFields>) => void;
  more?: ReactNode;
  /** The homepage's search title is the whole title (no site ending added). */
  home?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const id = useId();
  const url = seo.url.replace(/^https:\/\//, "").replace(/\/$/, "");
  return (
    <section className="space-y-4" aria-label="Search and sharing">
      <h3 className="text-sm">Search &amp; sharing</h3>
      <div className="site-seo-preview" aria-label="Search result preview">
        <span className="site-seo-preview-url">{url.replace("/", " › ")}</span>
        <span className="site-seo-preview-title">
          {seo.title.length > TITLE_LIMIT ? `${seo.title.slice(0, TITLE_LIMIT - 1)}…` : seo.title}
        </span>
        <span className="site-seo-preview-desc">
          {seo.description
            ? seo.description.length > DESCRIPTION_LIMIT
              ? `${seo.description.slice(0, DESCRIPTION_LIMIT - 1)}…`
              : seo.description
            : "No description yet — add one below, or a summary to the page."}
        </span>
        {seo.noindex && <span className="site-seo-preview-hidden">Hidden from search engines</span>}
      </div>

      <div className="space-y-1.5">
        <Label text="Search title" htmlFor={`${id}-title`}>
          <Origin custom={seo.custom.title} onReset={() => set({ title: "" })} />
        </Label>
        <Input
          id={`${id}-title`}
          value={fields.title ?? ""}
          placeholder={seo.auto.title}
          onChange={(e) => set({ title: e.target.value })}
        />
        <Counter n={seo.title.length} limit={TITLE_LIMIT} />
        {!home && (
          <span className="block text-[11px] text-muted-foreground">
            The site name is added to the end automatically.
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <Label text="Description" htmlFor={`${id}-description`}>
          <Origin custom={seo.custom.description} onReset={() => set({ description: "" })} />
        </Label>
        <Textarea
          id={`${id}-description`}
          rows={4}
          value={fields.description ?? ""}
          placeholder={seo.auto.description}
          onChange={(e) => set({ description: e.target.value })}
        />
        <Counter n={seo.description.length} limit={DESCRIPTION_LIMIT} />
      </div>

      <div className="space-y-1.5">
        <Label text="Share image">
          <Origin custom={seo.custom.image} onReset={() => set({ image: "" })} />
        </Label>
        {seo.image ? (
          <img src={seo.image} alt="" className="aspect-[1.91/1] w-full rounded-sm object-cover" />
        ) : (
          <p className="rounded-sm border border-dashed border-border p-3 text-xs text-muted-foreground">
            No share image. Add one here, or a default for every page in Settings → SEO.
          </p>
        )}
        <label className="inline-flex">
          <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input px-3 text-xs hover:bg-accent">
            {busy ? "Uploading…" : seo.custom.image ? "Replace" : "Upload a custom image"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setBusy(true);
              try {
                set({ image: await uploadMedia(f) });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Upload failed");
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        <span className="block text-[11px] text-muted-foreground">
          Shown when the page is shared, e.g. on LinkedIn. Best at 1200 × 630.
        </span>
      </div>

      <details className="site-seo-more space-y-3">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          More
        </summary>
        <div className="space-y-4 pt-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Hide from search engines
              <span className="block text-[11px] text-muted-foreground">
                The page still works, but Google won't list it.
              </span>
            </span>
            <Switch checked={!!fields.noindex} onCheckedChange={(on) => set({ noindex: on })} />
          </label>
          {more}
        </div>
      </details>
    </section>
  );
}

/** A small "Save" row for settings that apply straight away (web address, page name). */
export function ApplyField({
  label,
  value,
  prefix,
  help,
  problem,
  onApply,
}: {
  label: string;
  value: string;
  prefix?: string | undefined;
  help?: string | undefined;
  problem?: ((v: string) => string | null) | undefined;
  onApply: (v: string) => Promise<unknown>;
}) {
  const [v, setV] = useState(value);
  const err = v !== value && problem ? problem(v) : null;
  return (
    <div className="space-y-1.5">
      <span className="block text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
        <Input value={v} aria-label={label} onChange={(e) => setV(e.target.value)} />
        {v !== value && (
          <Button size="sm" disabled={!!err || !v.trim()} onClick={() => onApply(v.trim())}>
            Save
          </Button>
        )}
      </div>
      {err ? (
        <span className="block text-[11px] text-destructive">{err}</span>
      ) : (
        help && <span className="block text-[11px] text-muted-foreground">{help}</span>
      )}
    </div>
  );
}

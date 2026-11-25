import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PanelField } from "@/components/admin/StudioShell";
import { LinkTargetEditor, SELECT } from "./LinkTargetEditor";
import { RichTextEditor } from "./RichTextEditor";
import {
  attachedFields,
  newGroupItem,
  type ChoiceOption,
  type FieldDef,
  type GroupItem,
  type RichDoc,
} from "@/lib/fields";
import { blankTarget, type LinkTarget } from "@/lib/menus";
import { uploadMedia } from "@/lib/media";

/** What field editors need from where they're used. */
export type FieldCtx = {
  /** Site content (live merged with drafts), for link pickers. */
  site: Record<string, unknown>;
  /** Things a reference field can pick (records or entries of a type); none until they exist. */
  referenceOptions?: (to: string) => ChoiceOption[];
};

const uid = () => crypto.randomUUID().slice(0, 8);

/**
 * Edits a set of fields (a section's, a settings group's, a group item's): one control per field
 * type, labels above, help and errors below. An image's alt text is edited under the image
 * rather than as its own field.
 */
export function FieldsEditor({
  defs,
  values,
  onChange,
  ctx,
  errors = {},
}: {
  defs: FieldDef[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  ctx: FieldCtx;
  errors?: Record<string, string>;
}) {
  const attached = attachedFields(defs);
  return (
    <div className="space-y-6">
      {defs
        .filter((d) => !attached.has(d.name))
        .map((d) => (
          <FieldInput
            key={d.name}
            def={d}
            value={values[d.name]}
            onChange={(v) => onChange(d.name, v)}
            ctx={ctx}
            error={errors[d.name]}
            alt={
              d.type === "image" && d.alt
                ? {
                    value: String(values[d.alt] ?? ""),
                    onChange: (v) => onChange(d.alt!, v),
                    error: errors[d.alt],
                  }
                : undefined
            }
          />
        ))}
    </div>
  );
}

export function FieldInput({
  def,
  value,
  onChange,
  ctx,
  error,
  alt,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  ctx: FieldCtx;
  error?: string | undefined;
  /** An image's description, edited under the image. */
  alt?: { value: string; onChange: (v: string) => void; error?: string | undefined } | undefined;
}) {
  const label = def.required ? def.label : `${def.label}`;
  const str = typeof value === "string" ? value : "";
  // Links and groups lay out their own labelled parts.
  if (def.type === "link")
    return (
      <div className="space-y-3">
        <LinkTargetEditor
          label={def.label}
          site={ctx.site}
          value={(value as LinkTarget | null) ?? blankTarget("page")}
          onChange={onChange}
        />
        <Help def={def} error={error} />
      </div>
    );
  if (def.type === "group")
    return <GroupInput def={def} value={value} onChange={onChange} ctx={ctx} error={error} />;

  let control: React.ReactNode;
  switch (def.type) {
    case "text":
      control = (
        <Input value={str} maxLength={def.maxLength} onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case "longText":
      control = <Textarea rows={4} value={str} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "richText":
      control = (
        <RichTextEditor
          label={def.label}
          value={value as RichDoc | null}
          onChange={(d) => onChange(d)}
        />
      );
      break;
    case "image":
      control = <UploadInput kind="image" value={str} onChange={onChange} />;
      break;
    case "file":
      control = <UploadInput kind="file" accept={def.accept} value={str} onChange={onChange} />;
      break;
    case "date":
      control = (
        <Input
          type={def.time ? "datetime-local" : "date"}
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "number":
      control = (
        <Input
          type="number"
          min={def.min}
          max={def.max}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
      break;
    case "boolean":
      control = (
        <Switch
          checked={value === true}
          onCheckedChange={(on) => onChange(on)}
          aria-label={label}
        />
      );
      break;
    case "choice": {
      const options = def.options;
      if (def.multiple) {
        const picked = Array.isArray(value) ? (value as string[]) : [];
        control = options.length ? (
          <div className="space-y-2">
            {options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={picked.includes(o.value)}
                  onCheckedChange={(on) =>
                    onChange(
                      on === true ? [...picked, o.value] : picked.filter((v) => v !== o.value),
                    )
                  }
                />
                {o.label}
              </label>
            ))}
          </div>
        ) : (
          <p className="studio-help">No options.</p>
        );
      } else {
        control = options.length ? (
          <select className={SELECT} value={str} onChange={(e) => onChange(e.target.value)}>
            {!def.required && <option value="">—</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="studio-help">No options.</p>
        );
      }
      break;
    }
    case "reference": {
      const options = ctx.referenceOptions?.(def.to) ?? [];
      const picked = Array.isArray(value) ? (value as string[]) : [];
      control = options.length ? (
        def.multiple ? (
          <div className="space-y-2">
            {options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={picked.includes(o.value)}
                  onCheckedChange={(on) =>
                    onChange(
                      on === true ? [...picked, o.value] : picked.filter((v) => v !== o.value),
                    )
                  }
                />
                {o.label}
              </label>
            ))}
          </div>
        ) : (
          <select
            className={SELECT}
            value={picked[0] ?? ""}
            onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
          >
            <option value="">—</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )
      ) : (
        <p className="studio-help">Nothing to pick yet.</p>
      );
      break;
    }
  }

  return (
    <div className="space-y-1.5">
      {def.type === "boolean" ? (
        <label className="flex items-center justify-between gap-3">
          <span className="studio-field-label">{label}</span>
          {control}
        </label>
      ) : (
        <PanelField label={label}>{control}</PanelField>
      )}
      <Help def={def} error={error} />
      {alt && (
        <div className="space-y-1.5 pt-2">
          <PanelField label="Image description (alt text)">
            <Input value={alt.value} onChange={(e) => alt.onChange(e.target.value)} />
          </PanelField>
          {alt.error ? (
            <p className="studio-help text-[var(--st-danger)]">{alt.error}</p>
          ) : (
            <p className="studio-help">
              {def.type === "image" && def.decorative
                ? "Optional: this image is decorative."
                : "Describe the image for people who can't see it."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Help({ def, error }: { def: FieldDef; error?: string | undefined }) {
  if (error) return <p className="studio-help text-[var(--st-danger)]">{error}</p>;
  return def.help ? <p className="studio-help">{def.help}</p> : null;
}

/** Uploads an image or file to the media library and stores its stable address. */
function UploadInput({
  kind,
  value,
  onChange,
  accept,
}: {
  kind: "image" | "file";
  value: string;
  onChange: (v: string) => void;
  accept?: string | undefined;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const name = value ? decodeURIComponent(value.split("/").pop() ?? "").replace(/^\d+-/, "") : "";
  return (
    <div className="space-y-2">
      {value &&
        (kind === "image" ? (
          <img
            src={value}
            alt=""
            className="max-h-40 rounded-lg border border-border object-cover"
          />
        ) : (
          <a href={value} target="_blank" rel="noreferrer" className="studio-help underline">
            {name}
          </a>
        ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? "Uploading…" : value ? `Replace ${kind}` : `Add ${kind}`}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            Remove
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept={kind === "image" ? "image/*" : accept}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
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

/** A repeating group: a list of small forms, added, reordered and removed, within min / max. */
function GroupInput({
  def,
  value,
  onChange,
  ctx,
  error,
}: {
  def: Extract<FieldDef, { type: "group" }>;
  value: unknown;
  onChange: (v: unknown) => void;
  ctx: FieldCtx;
  error?: string | undefined;
}) {
  const items = Array.isArray(value) ? (value as GroupItem[]) : [];
  const [open, setOpen] = useState<string | null>(null);
  const set = (next: GroupItem[]) => onChange(next);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    set(next);
  };
  const canAdd = def.max === undefined || items.length < def.max;
  const canRemove = def.min === undefined || items.length > def.min;
  const titleOf = (it: GroupItem, i: number) => {
    const v = def.itemLabel ? it[def.itemLabel] : undefined;
    return typeof v === "string" && v.trim() ? v : `Item ${i + 1}`;
  };
  return (
    <div className="space-y-2">
      <span className="studio-field-label">{def.label}</span>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((it, i) => (
          <li key={it.id}>
            <div className="flex items-center gap-1 px-2 py-1">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-sm"
                aria-expanded={open === it.id}
                onClick={() => setOpen(open === it.id ? null : it.id)}
              >
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${open === it.id ? "" : "-rotate-90"}`}
                />
                <span className="truncate">{titleOf(it, i)}</span>
              </button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Move down"
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remove"
                disabled={!canRemove}
                onClick={() => set(items.filter((x) => x.id !== it.id))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            {open === it.id && (
              <div className="border-t border-border p-3">
                <FieldsEditor
                  defs={def.fields}
                  values={it}
                  ctx={ctx}
                  onChange={(name, v) =>
                    set(items.map((x) => (x.id === it.id ? { ...x, [name]: v } : x)))
                  }
                />
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="studio-help px-3 py-3">No items yet.</li>}
      </ul>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!canAdd}
        onClick={() => {
          const item = newGroupItem(def, uid());
          set([...items, item]);
          setOpen(item.id);
        }}
      >
        <Plus aria-hidden="true" />
        Add item
      </Button>
      {(def.min !== undefined || def.max !== undefined) && (
        <p className="studio-help">
          {def.min !== undefined && def.max !== undefined
            ? `${def.min}–${def.max} items.`
            : def.min !== undefined
              ? `At least ${def.min}.`
              : `Up to ${def.max}.`}
        </p>
      )}
      {error && <p className="studio-help text-[var(--st-danger)]">{error}</p>}
    </div>
  );
}

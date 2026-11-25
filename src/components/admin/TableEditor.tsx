import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { formatMulti, parseMulti } from "@/lib/multi-value";
import { uploadMedia } from "@/lib/media";
import { recordAnchor, type RecordTable } from "@/lib/comments";
import { RecordComments } from "./CommentThreads";
import { useComments } from "./useComments";

export type Field = {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "markdown"
    | "number"
    | "image"
    | "accordions"
    | "list"
    | "bool"
    | "select"
    | "checkboxes";
  options?: string[];
};

type Table =
  "pillars" | "stack_cards" | "hotspots" | "partners" | "posts" | "investments" | "publications";
type Row = Record<string, any> & { id?: string };

/** One field editor (text, image upload, bullet list, accordions…); also used for list items in the page editor. */
export function FieldInput({
  f,
  value,
  onChange,
}: {
  f: Field;
  value: any;
  onChange: (v: any) => void;
}) {
  const [busy, setBusy] = useState(false);
  switch (f.type) {
    case "textarea":
    case "markdown":
      return (
        <Textarea
          rows={f.type === "markdown" ? 14 : 4}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={f.type === "markdown" ? "font-mono text-xs" : ""}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          value={value ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
    case "select":
      return (
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {value && !f.options?.includes(value) && (
            <option value={value}>{value} (not in list)</option>
          )}
          {f.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "checkboxes": {
      // Several choices saved as one text value ("Seed / Series A"), in the options' order.
      const options = f.options ?? [];
      const chosen = parseMulti(value);
      const unlisted = chosen.filter((c) => !options.includes(c));
      const toggle = (o: string, on: boolean) =>
        onChange(formatMulti(on ? [...chosen, o] : chosen.filter((c) => c !== o), options));
      return (
        <div className="space-y-2">
          {[...options, ...unlisted].map((o) => (
            <label
              key={o}
              className="flex items-center gap-2 text-sm normal-case tracking-normal text-foreground"
            >
              <Checkbox
                checked={chosen.includes(o)}
                onCheckedChange={(on) => toggle(o, on === true)}
              />
              <span>
                {o}
                {!options.includes(o) && (
                  <span className="text-muted-foreground"> (not in list)</span>
                )}
              </span>
            </label>
          ))}
        </div>
      );
    }
    case "bool":
      return <Switch checked={!!value} onCheckedChange={onChange} />;
    case "image":
      return (
        <div className="space-y-2">
          {value && <img src={value} alt="" className="h-24 w-auto rounded-sm object-cover" />}
          <Input
            value={value ?? ""}
            placeholder="https://…"
            onChange={(e) => onChange(e.target.value)}
          />
          <Input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              try {
                onChange(await uploadMedia(file));
                toast.success("Image uploaded");
              } catch (err: any) {
                toast.error(err.message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
      );
    case "list": {
      const list: string[] = value ?? [];
      return (
        <div className="space-y-2">
          {list.map((it, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={it}
                onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button variant="ghost" onClick={() => onChange(list.filter((_, j) => j !== i))}>
                ×
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => onChange([...list, ""])}>
            + Add item
          </Button>
        </div>
      );
    }
    case "accordions": {
      const list: { title: string; body: string }[] = value ?? [];
      const set = (i: number, k: "title" | "body", v: string) =>
        onChange(list.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
      return (
        <div className="space-y-3">
          {list.map((it, i) => (
            <div key={i} className="space-y-2 rounded-sm border border-border p-3">
              <div className="flex gap-2">
                <Input
                  value={it.title}
                  placeholder="Title"
                  onChange={(e) => set(i, "title", e.target.value)}
                />
                <Button variant="ghost" onClick={() => onChange(list.filter((_, j) => j !== i))}>
                  ×
                </Button>
              </div>
              <Textarea
                rows={3}
                value={it.body}
                placeholder="Body"
                onChange={(e) => set(i, "body", e.target.value)}
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange([...list, { title: "", body: "" }])}
          >
            + Add accordion
          </Button>
        </div>
      );
    }
    default:
      return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

/**
 * List + form for a table. With `comments`, each saved record has a Comments area and the list
 * shows how many open comments each record has; `focus` opens a record (and one of its threads).
 */
export function TableEditor({
  table,
  fields,
  titleKey,
  order = "sort",
  defaults,
  comments,
  focus,
}: {
  table: Table;
  fields: Field[];
  titleKey: string;
  order?: string;
  defaults: Row;
  comments?: RecordTable | undefined;
  focus?: { record?: string | undefined; comment?: string | undefined } | undefined;
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Row | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(order, { ascending: order === "sort" });
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows(data as Row[]);
    if (focus?.record && !sel) setSel((data as Row[]).find((r) => r.id === focus.record) ?? null);
  };
  const threads = useComments().threads;
  const openCount = (id?: string) =>
    comments && id
      ? threads.filter((t) => !t.resolved_at && t.anchor === recordAnchor(comments, id)).length
      : 0;
  useEffect(() => {
    load();
    setSel(null);
  }, [table]);

  const save = async () => {
    if (!sel) return;
    const { id, ...rest } = sel;
    const res = id
      ? await supabase
          .from(table)
          .update(rest as never)
          .eq("id", id)
          .select()
          .single()
      : await supabase
          .from(table)
          .insert(rest as never)
          .select()
          .single();
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Saved");
    setSel(res.data as Row);
    qc.invalidateQueries();
    load();
  };
  const remove = async () => {
    if (!sel?.id || !confirm("Delete this item?")) return;
    const { error } = await supabase.from(table).delete().eq("id", sel.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSel(null);
    qc.invalidateQueries();
    load();
  };

  const move = async (i: number, dir: -1 | 1) => {
    const a = rows[i],
      b = rows[i + dir];
    if (!a?.id || !b?.id) return;
    const next = rows.map((r, j) => ({ ...r, sort: j + 1 }));
    [next[i], next[i + dir]] = [next[i + dir]!, next[i]!];
    const ordered = next.map((r, j) => ({ ...r, sort: j + 1 }));
    setRows(ordered);
    const results = await Promise.all(
      ordered.map((r) =>
        supabase
          .from(table)
          .update({ sort: r.sort } as never)
          .eq("id", r.id!),
      ),
    );
    const err = results.find((r) => r.error)?.error;
    if (err) toast.error(err.message);
    qc.invalidateQueries();
  };

  return (
    <div className="grid gap-8 md:grid-cols-[280px_1fr]">
      <div className="space-y-1">
        <Button
          className="mb-3 w-full"
          onClick={() =>
            setSel(order === "sort" ? { ...defaults, sort: rows.length + 1 } : { ...defaults })
          }
        >
          + New
        </Button>
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-1">
            <button
              onClick={() => setSel(r)}
              className={`block min-w-0 flex-1 truncate rounded-sm px-3 py-2 text-left text-sm transition-colors ${sel?.id === r.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {r[titleKey] || "Untitled"}
              {openCount(r.id) > 0 && (
                <span className="studio-count ml-2" aria-label={`${openCount(r.id)} open comments`}>
                  {openCount(r.id)}
                </span>
              )}
            </button>
            {order === "sort" && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={`Move ${r[titleKey] || "item"} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={`Move ${r[titleKey] || "item"} down`}
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
      {sel ? (
        <div className="space-y-5 rounded-sm border border-border bg-card p-6">
          {fields.map((f) => (
            <label key={f.key} className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {f.label}
              </span>
              <FieldInput
                f={f}
                value={sel[f.key]}
                onChange={(v) => setSel({ ...sel, [f.key]: v })}
              />
            </label>
          ))}
          <div className="flex gap-3 pt-2">
            <Button onClick={save}>Save</Button>
            {sel.id && (
              <Button variant="destructive" onClick={remove}>
                Delete
              </Button>
            )}
          </div>
          {comments && sel.id && (
            <RecordComments
              key={sel.id}
              table={comments}
              id={sel.id}
              focus={sel.id === focus?.record ? focus?.comment : undefined}
            />
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">Select an item or create a new one.</p>
      )}
    </div>
  );
}

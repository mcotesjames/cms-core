import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldsEditor } from "@/components/admin/fields/FieldInput";
import { adminHead } from "@/components/admin/adminUser";
import { currentValues, useRecords, useReferenceOptions } from "@/components/admin/useRecords";
import { useSiteContent } from "@/lib/site-content";
import { fieldDefault } from "@/lib/fields";
import { recordStatus, recordTitle, recordType, type RecordTypeDef } from "@/lib/records";
import type { RecordRow } from "@/data/records";

export const Route = createFileRoute("/admin/records/$type")({
  head: ({ params }) => adminHead(recordType(params.type)?.plural ?? "Records"),
  loader: ({ params }) => {
    if (!recordType(params.type)) throw notFound();
  },
  component: RecordsScreen,
});

const STATUS = {
  live: { label: "Live", variant: "live" },
  changes: { label: "Unpublished changes", variant: "changes" },
  draft: { label: "Draft", variant: "draft" },
} as const;

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

/**
 * A record type's list (spec: Core scope → Records): search, the type's order (↑ / ↓ when it's
 * manual), and a form drawer to edit one record with drafts and Publish.
 */
function RecordsScreen() {
  const { type: key } = Route.useParams();
  const type = recordType(key)!;
  return <RecordsList key={key} type={type} />;
}

function RecordsList({ type }: { type: RecordTypeDef }) {
  const r = useRecords(type);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<{ id: string; isNew: boolean } | null>(null);
  const manual = type.ordering === "manual";
  const shown = r.list.filter((row) =>
    recordTitle(type, currentValues(row)).toLowerCase().includes(q.trim().toLowerCase()),
  );
  const unpublished = r.list.filter((row) => recordStatus(row) !== "live").length;
  const count = `${r.list.length} ${r.list.length === 1 ? "record" : "records"}`;
  // Found again on every render, so the drawer follows the record once it's saved or published.
  const openRow = open ? r.list.find((x) => x.id === open.id) : undefined;
  return (
    <div className="max-w-[1080px]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1>{type.plural}</h1>
          <p className="studio-help mt-0.5">
            {count}
            {unpublished ? ` · ${unpublished} with unpublished changes` : ""}
          </p>
        </div>
        <Button onClick={() => setOpen({ id: uid(), isNew: true })}>
          <Plus aria-hidden="true" />
          New {type.label.toLowerCase()}
        </Button>
      </div>
      {r.list.length > 6 && (
        <div className="relative mb-4 max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="pl-9"
            placeholder={`Search ${type.plural.toLowerCase()}`}
            aria-label={`Search ${type.plural.toLowerCase()}`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}
      {r.loading ? (
        <p className="studio-help">Loading…</p>
      ) : r.list.length === 0 ? (
        <div className="py-12 text-center">
          <p className="studio-section-title">No {type.plural.toLowerCase()} yet</p>
          <p className="studio-help mt-1">
            Add the first one; it stays a draft until you publish it.
          </p>
        </div>
      ) : (
        <ul className="studio-rows">
          {shown.map((row, i) => {
            const st = STATUS[recordStatus(row)];
            return (
              <li key={row.id} className="studio-row relative">
                <button
                  type="button"
                  className="studio-row-title min-w-[8rem] flex-1 truncate text-left after:absolute after:inset-0"
                  onClick={() => setOpen({ id: row.id, isNew: false })}
                >
                  {recordTitle(type, currentValues(row))}
                </button>
                <Badge variant={st.variant}>{st.label}</Badge>
                {manual && !q && (
                  <span className="studio-row-actions relative z-10 flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => r.move(row.id, -1)}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Move down"
                      disabled={i === shown.length - 1}
                      onClick={() => r.move(row.id, 1)}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {manual && r.list.length > 1 && (
        <p className="studio-help mt-3">The order here is the order on the site.</p>
      )}
      {open && (
        <RecordDrawer
          key={open.id}
          type={type}
          id={open.id}
          row={openRow}
          isNew={open.isNew && !openRow}
          actions={r}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/**
 * One record in a drawer from the right: its fields (auto-saved as a draft), Publish, Discard and
 * Delete. Publishing checks the fields on the server and shows any problems next to them.
 */
function RecordDrawer({
  type,
  id,
  row,
  isNew,
  actions,
  onClose,
}: {
  type: RecordTypeDef;
  id: string;
  row: RecordRow | undefined;
  isNew: boolean;
  actions: ReturnType<typeof useRecords>;
  onClose: () => void;
}) {
  const site = useSiteContent() as unknown as Record<string, unknown>;
  const referenceOptions = useReferenceOptions();
  const start = useMemo(
    () =>
      row
        ? currentValues(row)
        : Object.fromEntries(type.fields.map((f) => [f.name, fieldDefault(f)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [values, setValues] = useState<Record<string, unknown>>(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [save, setSave] = useState<"idle" | "saving" | "saved">("idle");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(!isNew);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const persist = async (v: Record<string, unknown>) => {
    await actions.saveDraft(id, v);
    setSaved(true);
    setSave("saved");
    await actions.refresh();
  };
  const change = (name: string, v: unknown) => {
    const next = { ...values, [name]: v };
    setValues(next);
    setErrors((e) => {
      const { [name]: _, ...rest } = e;
      return rest;
    });
    setSave("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      persist(next).catch((err: Error) => toast.error(err.message));
    }, 700);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const flush = async () => {
    if (save === "saving") {
      clearTimeout(timer.current);
      await persist(values);
    }
  };
  const publish = async () => {
    setBusy(true);
    try {
      await flush();
      if (!saved) await persist(values);
      const r = await actions.publish(id);
      if (r.ok) {
        toast.success(`${recordTitle(type, values)} published`);
        setErrors({});
        setSave("idle");
      } else {
        setErrors(r.errors);
        toast.error("Some fields need attention.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const discard = async () => {
    if (
      !confirm(
        row?.publishedAt
          ? "Discard unpublished changes?"
          : `Discard this ${type.label.toLowerCase()}?`,
      )
    )
      return;
    clearTimeout(timer.current);
    await actions.discard(id);
    if (!row?.publishedAt) onClose();
    else setValues(row.data as Record<string, unknown>);
  };
  const remove = async () => {
    const used = await actions.usages(id);
    const where = used.length
      ? `\n\nIt's used in:\n• ${used.join("\n• ")}\n\nIt will disappear from those places.`
      : "";
    if (!confirm(`Delete “${recordTitle(type, values)}”? It comes off the site.${where}`)) return;
    clearTimeout(timer.current);
    await actions.remove(id);
    toast.success("Deleted");
    onClose();
  };

  const status = row ? recordStatus(row) : "draft";
  const st = STATUS[status === "live" && save !== "idle" ? "changes" : status];
  const hasDraft = !!row?.draft || save !== "idle";
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && flush().finally(onClose)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="studio-drawer-scrim" />
        <DialogPrimitive.Content className="studio-drawer" aria-describedby={undefined}>
          <header className="studio-drawer-head">
            <div className="min-w-0">
              <p className="studio-caption">{type.label}</p>
              <DialogPrimitive.Title className="studio-section-title truncate">
                {recordTitle(type, values)}
              </DialogPrimitive.Title>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={st.variant}>{st.label}</Badge>
              <DialogPrimitive.Close asChild>
                <Button size="icon" variant="ghost" aria-label="Close">
                  <X aria-hidden="true" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </header>
          <div className="studio-drawer-body">
            <FieldsEditor
              defs={type.fields}
              values={values}
              onChange={change}
              errors={errors}
              ctx={{ site, referenceOptions }}
            />
          </div>
          <footer className="studio-drawer-foot">
            <span className="studio-help mr-auto" aria-live="polite">
              {save === "saving" ? "Saving draft…" : save === "saved" ? "Draft saved" : ""}
            </span>
            {saved && row?.publishedAt && (
              <Button variant="ghost" className="text-[var(--st-danger)]" onClick={remove}>
                Delete
              </Button>
            )}
            {(hasDraft || !row?.publishedAt) && saved && (
              <Button variant="secondary" onClick={discard}>
                Discard
              </Button>
            )}
            <Button disabled={busy || (status === "live" && save === "idle")} onClick={publish}>
              {busy
                ? "Publishing…"
                : status === "live" && save === "idle"
                  ? "Published"
                  : "Publish"}
            </Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

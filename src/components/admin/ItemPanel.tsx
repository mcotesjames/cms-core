import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldsEditor, type FieldCtx } from "@/components/admin/fields/FieldInput";
import { newGroupItem, type FieldDef } from "@/lib/fields";
import {
  groupItems,
  insertItem,
  itemAddress,
  itemFieldAddress,
  moveItem,
  parseItemAddress,
  removeItem,
} from "@/lib/group-items";
import { resolveSection, sectionDef, type Doc } from "@/lib/page-sections";

const uid = () => crypto.randomUUID().slice(0, 8);

/**
 * One repeating item of a section, opened from the canvas or the section's panel (spec: Core
 * scope → Repeating items): its fields, and moving, adding and deleting items within the
 * section's min / max. Edits go to the page's draft like every other section edit.
 */
export function ItemPanel({
  sectionLabel,
  address,
  doc,
  ctx,
  update,
  setField,
  onOpen,
  onBack,
}: {
  sectionLabel: string;
  address: string;
  doc: Doc | null;
  ctx: FieldCtx;
  update: (doc: Doc) => void;
  setField: (field: string, value: unknown) => void;
  onOpen: (address: string) => void;
  onBack: () => void;
}) {
  const a = parseItemAddress(address);
  const inst = a && doc ? resolveSection(a.page as "home", doc, a.section!) : null;
  const def = inst
    ? (sectionDef(inst.type).fields.find((f) => f.name === a!.field) as
        Extract<FieldDef, { type: "group" }> | undefined)
    : undefined;
  const items = a ? groupItems(doc, a.group) : [];
  const index = items.findIndex((x) => x.id === a?.id);
  const it = items[index];
  if (!a || !doc || !def || def.type !== "group" || !it)
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {sectionLabel}
        </Button>
        <p className="studio-help">That item is no longer on the page.</p>
      </div>
    );

  const label =
    def.itemLabel && typeof it[def.itemLabel] === "string" ? String(it[def.itemLabel]) : "";
  const singular = def.label.replace(/s$/, "") || "Item";
  const apply = (next: Doc | null) => next && update(next);
  const atMin = def.min !== undefined && items.length <= def.min;
  const atMax = def.max !== undefined && items.length >= def.max;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {sectionLabel}
        </Button>
        <p className="studio-caption">
          {singular} {index + 1} of {items.length}
        </p>
        <h2 className="studio-section-title truncate">{label || `${singular} ${index + 1}`}</h2>
      </div>
      <FieldsEditor
        defs={def.fields}
        values={it}
        ctx={ctx}
        onChange={(name, v) => setField(itemFieldAddress(a.group, it.id, name), v)}
      />
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button
          variant="secondary"
          size="sm"
          disabled={index === 0}
          onClick={() => apply(moveItem(doc, a.group, it.id, -1))}
        >
          <ArrowUp aria-hidden="true" />
          Move up
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={index === items.length - 1}
          onClick={() => apply(moveItem(doc, a.group, it.id, 1))}
        >
          <ArrowDown aria-hidden="true" />
          Move down
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={atMax}
          title={atMax ? `Up to ${def.max}.` : undefined}
          onClick={() => {
            const fresh = newGroupItem(def, uid());
            const next = insertItem(doc, a.group, fresh, it.id, def.max);
            if (!next) return;
            update(next);
            onOpen(itemAddress(a.group, fresh.id));
          }}
        >
          <Plus aria-hidden="true" />
          Add after
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--st-danger)]"
          disabled={atMin}
          title={atMin ? `At least ${def.min}.` : undefined}
          onClick={() => {
            const next = removeItem(doc, a.group, it.id, def.min);
            if (!next) return;
            update(next);
            const neighbour = items[index + 1] ?? items[index - 1];
            if (neighbour) onOpen(itemAddress(a.group, neighbour.id));
            else onBack();
          }}
        >
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      </div>
      {(def.min !== undefined || def.max !== undefined) && (
        <p className="studio-help">
          {def.min !== undefined && def.max !== undefined
            ? `This section takes ${def.min}–${def.max} ${def.label.toLowerCase()}.`
            : def.min !== undefined
              ? `At least ${def.min}.`
              : `Up to ${def.max}.`}
        </p>
      )}
    </div>
  );
}

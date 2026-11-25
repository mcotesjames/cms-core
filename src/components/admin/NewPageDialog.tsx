import { SITE_HOST } from "@/lib/seo";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePages } from "./usePages";
import { slugProblem, slugify } from "@/lib/pages";
import { TEMPLATES, TEMPLATE_ORDER, type TemplateKey } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * "+ New page": a template, a name and a web address (suggested from the name). Creates an
 * unpublished page with the template's starting sections (and a hero, if the template has one),
 * and opens it in the editor.
 */
export function NewPageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const pages = usePages();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState<TemplateKey>("standard");
  const address = slugEdited ? slug : slugify(name);
  const problem = name.trim() ? slugProblem(address, pages.list) : null;
  const reset = () => {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setTemplate("standard");
  };
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || problem) return;
    setBusy(true);
    const key = await pages.create(name.trim(), address, template);
    setBusy(false);
    if (!key) return;
    onOpenChange(false);
    reset();
    void navigate({ to: "/admin/pages/$key", params: { key } });
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={create} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New page</DialogTitle>
            <DialogDescription>
              Pick a template, then build the page in the editor. It isn't on the site until you
              publish it.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Template
            </legend>
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {TEMPLATE_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={template === t}
                  onClick={() => setTemplate(t)}
                  className={cn(
                    "rounded-sm border p-3 text-left transition-colors",
                    template === t
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <span className="block text-sm">{TEMPLATES[t].label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {TEMPLATES[t].description}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Page name
            </span>
            <Input
              autoFocus
              required
              value={name}
              placeholder="e.g. About"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Web address
            </span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              {SITE_HOST}/
              <Input
                value={address}
                aria-label="Web address"
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                }}
              />
            </span>
            {problem && <span className="block text-xs text-destructive">{problem}</span>}
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim() || !!problem}>
              {busy ? "Creating…" : "Create page"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadMedia } from "@/lib/media";
import { listMedia } from "@/data/media";

export const Route = createFileRoute("/admin/media")({ component: MediaLibrary });

type Item = { path: string; url: string };

/** Files that aren't images or videos (shown as a file tile). */
const isDocument = (path: string) => /\.(html?|pdf|txt|csv|json|zip)$/i.test(path);

function MediaLibrary() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      setItems((await listMedia()).map((m) => ({ path: m.key, url: m.url })));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl">Media</h1>
        <Input
          type="file"
          accept="image/*,video/*"
          multiple
          disabled={busy}
          className="max-w-xs"
          aria-label="Upload files"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            if (!files.length) return;
            setBusy(true);
            try {
              for (const f of files) await uploadMedia(f);
              toast.success("Uploaded");
              load();
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((it) => (
          <li key={it.path} className="space-y-2">
            <div className="aspect-square overflow-hidden rounded-sm bg-muted">
              {/\.(mp4|webm|mov)$/i.test(it.path) ? (
                <video src={it.url} className="h-full w-full object-cover" muted />
              ) : isDocument(it.path) ? (
                // Not an image (e.g. an interactive's HTML file): a file tile, not a broken <img>.
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center">
                  <span className="text-sm font-medium uppercase tracking-[0.16em]">
                    {/\.html?$/i.test(it.path) ? "HTML" : it.path.split(".").pop()}
                  </span>
                  <span className="line-clamp-2 break-all text-xs text-muted-foreground">
                    {it.path.replace(/^library\/\d+-/, "")}
                  </span>
                </div>
              ) : (
                <img src={it.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground" title={it.path}>
              {it.path.replace(/^library\//, "")}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(it.url);
                toast.success("Link copied");
              }}
            >
              Copy link
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

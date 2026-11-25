import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSwitcher } from "./PageSwitcher";
import type { SwitcherTarget } from "@/lib/page-switcher";

const DEVICES = { desktop: "100%", tablet: "768px", mobile: "360px" } as const;

/**
 * The one Content Studio editor layout: top bar (back, title, status, save state,
 * device sizes, hide panel, discard, publish), the real page in an iframe canvas,
 * and a side panel for the selected block's fields.
 */
export function StudioShell(p: {
  back: { to: "/admin" | "/admin/settings"; label: string };
  title: string;
  status: string;
  live: boolean;
  saving: boolean;
  dirty: boolean;
  canDiscard: boolean;
  onDiscard: () => void;
  publishLabel: string;
  publishDisabled: boolean;
  onPublish: () => void;
  extra?: React.ReactNode;
  notice?: React.ReactNode;
  frameRef: React.Ref<HTMLIFrameElement>;
  src: string;
  panel: boolean;
  setPanel: (v: boolean) => void;
  onEscape: () => void;
  children: React.ReactNode;
  /** Rendered even when the panel is hidden (e.g. file inputs). */
  outside?: React.ReactNode;
  /** Device size, when the editor needs to know it (comments record it). */
  device?: keyof typeof DEVICES;
  setDevice?: (d: keyof typeof DEVICES) => void;
  /** Comment mode toggle; `forMe` = open comments for the signed-in user. */
  comments?: { on: boolean; toggle: () => void; forMe: number };
  /** The page or insight being edited: the title becomes the page switcher. */
  switcher?: SwitcherTarget;
}) {
  const [ownDevice, setOwnDevice] = useState<keyof typeof DEVICES>("desktop");
  const device = p.device ?? ownDevice;
  const setDevice = p.setDevice ?? setOwnDevice;
  return (
    <div className="site-studio" data-panel={p.panel}>
      <header className="studio-bar">
        <Link to={p.back.to} className="text-sm hover:text-primary">
          ← {p.back.label}
        </Link>
        <div className="flex min-w-0 flex-1">
          {p.switcher ? (
            <PageSwitcher
              current={p.switcher}
              label={p.title}
              saving={p.saving}
              view={{ device, commenting: !!p.comments?.on }}
            />
          ) : (
            <span className="truncate text-sm">{p.title}</span>
          )}
        </div>
        <Badge variant={p.live ? "default" : "secondary"}>{p.status}</Badge>
        <span className="hidden text-xs text-muted-foreground sm:inline" aria-live="polite">
          {p.saving ? "Saving…" : p.dirty ? "Draft saved" : ""}
        </span>
        {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => (
          <Button
            key={d}
            size="sm"
            variant={device === d ? "default" : "ghost"}
            aria-pressed={device === d}
            onClick={() => setDevice(d)}
          >
            {d[0]!.toUpperCase() + d.slice(1)}
          </Button>
        ))}
        {p.comments && (
          <Button
            size="sm"
            variant={p.comments.on ? "default" : "ghost"}
            aria-pressed={p.comments.on}
            onClick={p.comments.toggle}
            className={p.comments.on ? "site-comment-mode-on" : undefined}
          >
            Comment
            {p.comments.forMe > 0 && (
              <span className="studio-count" aria-label={`${p.comments.forMe} for you`}>
                {p.comments.forMe}
              </span>
            )}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={!p.panel}
          onClick={() => p.setPanel(!p.panel)}
        >
          {p.panel ? "Hide panel" : "Show panel"}
        </Button>
        {p.extra}
        {p.canDiscard && (
          <Button size="sm" variant="ghost" onClick={p.onDiscard}>
            Discard
          </Button>
        )}
        <Button size="sm" disabled={p.publishDisabled} onClick={p.onPublish}>
          {p.publishLabel}
        </Button>
      </header>
      {p.notice}
      <div className="studio-body-wrap">
        <div className="studio-canvas">
          <div
            className="studio-frame h-full"
            style={{ maxWidth: DEVICES[device], height: "calc(100vh - 57px)" }}
          >
            <iframe
              ref={p.frameRef}
              title={`${p.title} canvas`}
              src={p.src}
              className="studio-iframe"
            />
          </div>
        </div>
        {p.panel && (
          <aside
            className="studio-panel space-y-5"
            aria-label="Block settings"
            onKeyDown={(e) => {
              if (e.key === "Escape") p.onEscape();
            }}
          >
            {p.children}
          </aside>
        )}
      </div>
      {p.outside}
    </div>
  );
}

export function PanelHeading({ title, onDone }: { title: string; onDone: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base">{title}</h2>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

export function PanelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

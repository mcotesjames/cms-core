import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSiteContent } from "@/lib/site-content";
import { isFilled, useShow } from "@/lib/show-if";
import { useStudioMode } from "@/lib/studio-mode";
import { SITE_NAME } from "@/lib/seo";
import { columnAddress, linkAddress, resolveLink, resolveMenus, type MenuLink } from "@/lib/menus";

/** The site name as a text wordmark (until a site's own logo comes from its configuration). */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-2xl font-semibold tracking-tight ${className}`}>
      {SITE_NAME}
      <span className="text-primary">.</span>
    </span>
  );
}

type MenuCtx = { site: Record<string, unknown> };

/** Whether a menu link appears on the live site (target still exists, label filled). */
const showsLive = (link: MenuLink, ctx: MenuCtx) =>
  isFilled(link.label) && !resolveLink(link.target, ctx).broken;

/** The site menus (stored in the CMS, or the defaults) plus what's needed to resolve their links. */
function useMenus() {
  const site = useSiteContent() as unknown as Record<string, unknown> & {
    settings: { contact_email: string };
    menus?: unknown;
  };
  return { menus: resolveMenus(site.menus, site.settings), ctx: { site } };
}

/**
 * One menu link. Links whose target has gone are hidden on the live site and shown faded in the
 * Studio canvas; an external link with no address yet shows as "coming soon" (not clickable).
 */
function MenuItem({
  link,
  className,
  ctx,
  onClick,
}: {
  link: MenuLink;
  className: string;
  ctx: MenuCtx;
  onClick?: () => void;
}) {
  const studio = useStudioMode();
  const r = resolveLink(link.target, ctx);
  if (!studio && !showsLive(link, ctx)) return null;
  const attrs = studio
    ? { "data-cms-item": linkAddress(link.id), ...(r.broken ? { "data-cms-broken": "" } : {}) }
    : {};
  if (r.pending || r.broken)
    return (
      <a role="link" aria-disabled="true" className={`${className} site-link-pending`} {...attrs}>
        {link.label}
      </a>
    );
  if (r.internal)
    return (
      <Link to={r.href as "/"} className={className} onClick={onClick} {...attrs}>
        {link.label}
      </Link>
    );
  return (
    <a
      href={r.href}
      className={className}
      onClick={onClick}
      {...(r.external ? { target: "_blank", rel: "noreferrer" } : {})}
      {...attrs}
    >
      {link.label}
      {r.external && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
}

/** Site name on the left, the main menu on the right; a toggle opens the menu on small screens. */
export function Header() {
  const { menus, ctx } = useMenus();
  const studio = useStudioMode();
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <header ref={ref} className="site-header" data-open={open}>
      <a href="#main" className="site-skip">
        Skip to content
      </a>
      <Link to="/" className="site-brand" onClick={close}>
        <Logo />
      </Link>
      <button
        type="button"
        className="site-nav-toggle"
        aria-expanded={open}
        aria-controls="site-main-nav"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Close" : "Menu"}
      </button>
      <nav
        id="site-main-nav"
        aria-label="Main"
        className="site-nav"
        {...(studio ? { "data-cms-section": "menus:main" } : {})}
      >
        {menus.main.map((l) => (
          <MenuItem
            key={l.id}
            link={l}
            ctx={ctx}
            onClick={close}
            className={l.button ? "site-nav-link site-nav-button" : "site-nav-link"}
          />
        ))}
      </nav>
    </header>
  );
}

/** Footer heading and text (site-wide), the footer menu's columns, and the copyright line. */
export function Footer() {
  const settings = useSiteContent().settings;
  const { menus, ctx } = useMenus();
  const studio = useStudioMode();
  const show = useShow();
  const visibleLinks = (links: MenuLink[]) => links.filter((l) => showsLive(l, ctx));
  return (
    <footer className="site-footer">
      <div className="site-footer-top">
        {show(settings.footer_heading, settings.footer_tagline) && (
          <div className="site-footer-intro">
            {show(settings.footer_heading) && (
              <h2 data-cms="settings:footer_heading">{settings.footer_heading}</h2>
            )}
            {show(settings.footer_tagline) && (
              <p data-cms="settings:footer_tagline" data-cms-multiline>
                {settings.footer_tagline}
              </p>
            )}
          </div>
        )}
        <nav
          className="site-footer-nav"
          aria-label="Footer"
          {...(studio ? { "data-cms-section": "menus:footer" } : {})}
        >
          {menus.footer
            .filter((c) => show(c.heading, visibleLinks(c.links)))
            .map((c) => (
              <div
                key={c.id}
                className="site-footer-col"
                {...(studio ? { "data-cms-item": columnAddress(c.id) } : {})}
              >
                {show(c.heading) && <h3>{c.heading}</h3>}
                {c.links.map((l) => (
                  <MenuItem key={l.id} link={l} ctx={ctx} className="site-footer-link" />
                ))}
              </div>
            ))}
        </nav>
      </div>
      <p className="site-footer-legal">
        © {new Date().getFullYear()} {SITE_NAME}
      </p>
    </footer>
  );
}

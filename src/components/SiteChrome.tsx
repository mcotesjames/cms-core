import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandSymbol } from "@/components/BrandSymbol";
import footerLogo from "@/assets/brand/wordmark-dark.svg";
import { FooterEnquiry } from "@/components/FooterEnquiry";
import { ExternalArrow } from "@/components/ExternalArrow";
import { useQuery } from "@tanstack/react-query";
import { useSiteContent } from "@/lib/site-content";
import { postsQuery } from "@/lib/content";
import { isFilled, useShow } from "@/lib/show-if";
import { useStudioMode } from "@/lib/studio-mode";
import { SITE_NAME } from "@/lib/seo";
import { columnAddress, linkAddress, resolveLink, resolveMenus, type MenuLink } from "@/lib/menus";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-2xl font-semibold tracking-tight ${className}`}>
      {SITE_NAME}
      <span className="text-primary">.</span>
    </span>
  );
}

/** The main menu's original page links; the editable menus' defaults start from these (see lib/menus.ts). */
export const NAV_LINKS = [
  { label: "Investments", to: "/investments" },
  { label: "Publications", to: "/publications" },
  { label: "Insights", to: "/insights" },
] as const;

/** The site menus (stored in the CMS, or the defaults) plus what's needed to resolve their links. */
/** Whether a menu link appears on the live site (target still exists, label filled). */
const showsLive = (link: MenuLink, ctx: ReturnType<typeof useMenus>["ctx"]) =>
  isFilled(link.label) && !resolveLink(link.target, ctx).broken;

function useMenus() {
  const site = useSiteContent() as unknown as Record<string, unknown> & {
    settings: { substack_url: string; contact_email: string };
    menus?: unknown;
  };
  const posts = useQuery(postsQuery).data ?? [];
  return { menus: resolveMenus(site.menus, site.settings), ctx: { posts, site } };
}

/**
 * One menu link. Links whose target has gone are hidden on the live site and shown faded in the
 * Studio canvas; an external link with no address yet shows as "coming soon" (not clickable).
 */
function MenuItem({
  link,
  variant,
  ctx,
  onClick,
}: {
  link: MenuLink;
  variant: "nav" | "cta" | "footer";
  ctx: ReturnType<typeof useMenus>["ctx"];
  onClick?: () => void;
}) {
  const studio = useStudioMode();
  const r = resolveLink(link.target, ctx);
  // Live site: a link whose target has gone, or with no label, is left out.
  if (!studio && !showsLive(link, ctx)) return null;
  const cls =
    variant === "cta"
      ? "site-nav-cta hover-flip"
      : variant === "nav"
        ? "site-nav-link hover-flip"
        : "hover-flip";
  const attrs = studio
    ? { "data-cms-item": linkAddress(link.id), ...(r.broken ? { "data-cms-broken": "" } : {}) }
    : {};
  const content = (
    <Flip>
      {link.label}
      {r.external && (
        <>
          {" "}
          <ExternalArrow {...(variant === "cta" ? { className: "site-nav-arrow" } : {})} />
        </>
      )}
    </Flip>
  );
  if (r.pending || r.broken)
    return (
      <a
        role="link"
        aria-disabled="true"
        aria-label={link.label}
        className={`site-footer-link-pending ${cls}`}
        {...attrs}
      >
        {content}
      </a>
    );
  if (r.internal)
    return (
      <Link to={r.href as "/"} aria-label={link.label} className={cls} onClick={onClick} {...attrs}>
        {content}
      </Link>
    );
  if (r.external)
    return (
      <a
        href={r.href}
        target="_blank"
        rel="noreferrer"
        aria-label={link.label}
        className={cls}
        onClick={onClick}
        {...attrs}
      >
        {content}
      </a>
    );
  return (
    <a href={r.href} aria-label={link.label} className={cls} onClick={onClick} {...attrs}>
      {content}
    </a>
  );
}

function Flip({ children }: { children: ReactNode }) {
  return (
    <span className="hover-flip__track" aria-hidden="true">
      <span className="hover-flip__line">{children}</span>
      <span className="hover-flip__line">{children}</span>
    </span>
  );
}

export function Header() {
  const { menus, ctx } = useMenus();
  const studio = useStudioMode();
  const headerRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(false);
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
    <header ref={headerRef} data-open={open} className="site-header">
      <Link to="/" aria-label={`${SITE_NAME} home`} className="site-nav-brand" onClick={close}>
        <BrandSymbol className="site-nav-symbol" />
      </Link>
      <div className="site-nav-bar">
        <nav
          aria-label="Main"
          id="site-main-nav"
          className="site-nav-pill"
          {...(studio ? { "data-cms-section": "menus:main" } : {})}
        >
          {menus.main.map((l) => (
            <MenuItem
              key={l.id}
              link={l}
              variant={l.button ? "cta" : "nav"}
              ctx={ctx}
              onClick={close}
            />
          ))}
        </nav>
        <button
          type="button"
          className="site-nav-toggle"
          aria-expanded={open}
          aria-controls="site-main-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}

export function Footer() {
  const settings = useSiteContent().settings;
  const { menus, ctx } = useMenus();
  const studio = useStudioMode();
  const show = useShow();
  const visibleLinks = (links: MenuLink[]) => links.filter((l) => showsLive(l, ctx));
  const footerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        const footer = footerRef.current;
        const symbol = footer?.querySelector(".site-footer-symbol");
        if (disposed || !footer || !symbol) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        media.add("(prefers-reduced-motion: no-preference)", () => {
          gsap.to(symbol, {
            rotation: 135,
            ease: "none",
            scrollTrigger: { trigger: footer, start: "top bottom", end: "bottom top", scrub: 1 },
          });
        });
        cleanup = () => media.revert();
      },
    );
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  return (
    <footer ref={footerRef} className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-top">
          <div className="site-footer-brand">
            <BrandSymbol className="site-footer-symbol" />
            {show(settings.footer_heading) && (
              <h2 className="site-footer-heading" data-cms="settings:footer_heading">
                {settings.footer_heading}
              </h2>
            )}
            {show(settings.footer_tagline) && (
              <p
                className="site-footer-tagline"
                data-cms="settings:footer_tagline"
                data-cms-multiline
              >
                {settings.footer_tagline}
              </p>
            )}
            <FooterEnquiry recipient={settings.enquiry_recipient} />
          </div>
          <nav
            className="site-footer-nav"
            aria-label="Footer navigation"
            {...(studio ? { "data-cms-section": "menus:footer" } : {})}
          >
            {menus.footer
              .filter((c) => show(c.heading, visibleLinks(c.links)))
              .map((c) => (
                <div
                  key={c.id}
                  className="site-footer-nav-col"
                  {...(studio ? { "data-cms-item": columnAddress(c.id) } : {})}
                >
                  {show(c.heading) && <h3 className="site-footer-nav-title">{c.heading}</h3>}
                  {c.links.map((l) => (
                    <MenuItem key={l.id} link={l} variant="footer" ctx={ctx} />
                  ))}
                </div>
              ))}
          </nav>
        </div>
      </div>
      <div className="site-footer-wordmark">
        <img src={footerLogo} alt={SITE_NAME} />
      </div>
    </footer>
  );
}

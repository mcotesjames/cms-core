import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useSiteContent } from "@/lib/site-content";
import { useStudioMode } from "@/lib/studio-mode";
import { resolveLink, type LinkTarget } from "@/lib/menus";
import { safeHref, type RichDoc, type RichMark, type RichNode } from "@/lib/fields";

/**
 * Public renderers for field values (spec: Core scope → Field types), used by section components:
 * <RichText> for rich text and <FieldLink> for link fields. Both render nothing harmful: rich text
 * is built from its known nodes only (never HTML), and links resolve their target the same way
 * menus do, so a link to a page that's gone is hidden on the site and flagged in the Studio.
 */

/** Renders a rich text value inside `.site-rich` (styled by the site theme). */
export function RichText({ value, className = "" }: { value: unknown; className?: string }) {
  const doc = value as RichDoc | null | undefined;
  if (!doc || doc.type !== "doc" || !doc.content?.length) return null;
  return <div className={`site-rich ${className}`.trim()}>{doc.content.map(node)}</div>;
}

function children(n: { content?: RichNode[] }): ReactNode {
  return n.content?.map(node) ?? null;
}

function node(n: RichNode, i: number): ReactNode {
  switch (n.type) {
    case "paragraph":
      // Empty paragraphs (stray Return presses) would only add gaps on the site.
      return n.content?.length ? <p key={i}>{children(n)}</p> : null;
    case "heading":
      return n.attrs.level === 3 ? <h3 key={i}>{children(n)}</h3> : <h2 key={i}>{children(n)}</h2>;
    case "bulletList":
      return <ul key={i}>{children(n)}</ul>;
    case "orderedList":
      return <ol key={i}>{children(n)}</ol>;
    case "listItem":
      return <li key={i}>{children(n)}</li>;
    case "hardBreak":
      return <br key={i} />;
    case "text":
      return <Fragment key={i}>{marked(n.text, n.marks ?? [])}</Fragment>;
    default:
      return null;
  }
}

function marked(text: string, marks: RichMark[]): ReactNode {
  return marks.reduce<ReactNode>((inner, m) => {
    if (m.type !== "link") return m.type === "bold" ? <strong>{inner}</strong> : <em>{inner}</em>;
    const href = safeHref(m.attrs.href);
    if (!href) return inner;
    const external = /^https?:/i.test(href);
    return (
      <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
        {inner}
      </a>
    );
  }, text);
}

/**
 * A link field's anchor. Internal pages use the router; a link whose target has gone is not
 * rendered on the site (its children are, unlinked, when `keepText`), and shown faded in the Studio.
 */
export function FieldLink({
  value,
  className,
  children: content,
  keepText = false,
  ...rest
}: {
  value: unknown;
  className?: string;
  children: ReactNode;
  keepText?: boolean;
} & Record<`data-${string}`, string | undefined>) {
  const site = useSiteContent() as unknown as Record<string, unknown>;
  const studio = useStudioMode();
  const t = value as LinkTarget | null | undefined;
  const r = t && typeof t === "object" && "kind" in t ? resolveLink(t, { site }) : null;
  if (!r || r.pending || r.broken) {
    if (studio || keepText)
      return (
        <span className={className} {...rest} {...(r?.broken ? { "data-cms-broken": "" } : {})}>
          {content}
        </span>
      );
    return null;
  }
  if (r.internal)
    return (
      <Link to={r.href as "/"} className={className} {...rest}>
        {content}
      </Link>
    );
  return (
    <a
      href={r.href}
      className={className}
      {...(r.external ? { target: "_blank", rel: "noreferrer" } : {})}
      {...rest}
    >
      {content}
    </a>
  );
}

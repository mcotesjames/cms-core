/**
 * The site's brand symbol (nav, footer, page transition, pillar mask, record-card fallback).
 * A neutral placeholder until the site's own mark comes from its site configuration (spec section 9).
 */
export function BrandSymbol({ className = "" }: { className?: string }) {
  return (
    <svg
      width="41"
      height="41"
      viewBox="0 0 41 41"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.5 0a20.5 20.5 0 1 1 0 41a20.5 20.5 0 0 1 0-41Zm0 6a14.5 14.5 0 1 0 0 29a14.5 14.5 0 0 0 0-29Z"
        fill="currentColor"
      />
      <circle cx="20.5" cy="20.5" r="6" fill="currentColor" />
    </svg>
  );
}

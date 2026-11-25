export function ExternalArrow({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`site-external-arrow ${className}`}
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0.969231 9L0 8.03077L6.64615 1.38462H0.692308V0H9V8.30769H7.61539V2.35385L0.969231 9Z"
        fill="currentColor"
      />
    </svg>
  );
}

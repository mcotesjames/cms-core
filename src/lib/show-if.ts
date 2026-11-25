/**
 * Show-if-filled: on the live site, an element whose CMS content is empty is not rendered at
 * all — and neither is its outermost container (a wrapper, a whole section) once everything
 * inside it is empty. Like a PHP `if ($field)` around the markup.
 *
 * In the Content Studio canvas everything renders, so empty fields can still be clicked and
 * filled; empty text shows a faint "Empty — hidden on the site" placeholder (styles.css).
 */
import { useStudioMode } from "./studio-mode";

/** True when a value has content: non-blank text, a non-empty list, or any other non-null value. */
export function isFilled(value: unknown): boolean {
  if (value == null || value === false) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.some(isFilled);
  return true;
}

/** True when at least one of the values has content (for a container holding several fields). */
export const anyFilled = (...values: unknown[]) => values.some(isFilled);

/**
 * `const show = useShow()` then `{show(a, b) && <div>…</div>}`: renders on the live site only when
 * a or b has content; always renders in the Studio canvas.
 */
export function useShow(): (...values: unknown[]) => boolean {
  const studio = useStudioMode();
  return (...values) => studio || anyFilled(...values);
}

import { useStudioMode } from "@/lib/studio-mode";

/**
 * Letter-by-letter reveal for H1 titles (same animation as the homepage hero).
 * Each word is a mask (`.site-reveal-word`) and each letter slides up with a
 * staggered delay. `start` offsets the stagger when a title is split across
 * several elements. In the Studio canvas the plain text is rendered so it can
 * be edited in place.
 */
export function LetterReveal({ text, start = 0 }: { text: string; start?: number }) {
  const studio = useStudioMode();
  if (studio) return <>{text}</>;
  let i = start;
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, w) => (
          <span key={w} className="site-reveal-word">
            {Array.from(word).map((ch, c) => {
              const d = i++ * 0.02;
              return (
                <span
                  key={c}
                  className="inline-block animate-letter"
                  style={{ animationDelay: `${d}s` }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        ))}
      </span>
    </>
  );
}

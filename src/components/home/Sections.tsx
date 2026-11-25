import { useStudioMode } from "@/lib/studio-mode";
import { Button } from "@/components/ui/button";
import { useSiteContent } from "@/lib/site-content";
import { useShow } from "@/lib/show-if";
import { SITE_NAME } from "@/lib/seo";
import heroWordmark from "@/assets/brand/wordmark-light.svg";
export { Pillars } from "./HorizontalPillars";

export function Hero() {
  const { headline: HEADLINE, cta_label } = useSiteContent().home.hero;
  const studio = useStudioMode();
  const show = useShow();
  let i = 0;
  return (
    <section className="site-hero relative overflow-hidden">
      <div className="site-hero-content absolute z-10">
        {!studio && !HEADLINE.trim() ? null : studio ? (
          <p className="site-hero-description" data-cms="home:hero.headline" data-cms-multiline>
            {HEADLINE}
          </p>
        ) : (
          <p className="site-hero-description">
            {HEADLINE.split(" ").map((word, w) => (
              <span key={w} className="site-hero-word">
                {word.split("").map((ch) => {
                  const d = i++ * 0.02;
                  return (
                    <span
                      key={i}
                      className="inline-block animate-letter"
                      style={{ animationDelay: `${d}s` }}
                    >
                      {ch}
                    </span>
                  );
                })}
              </span>
            ))}
          </p>
        )}
        {show(cta_label) && (
          <Button asChild variant="ghost" className="site-discover">
            <a href="#page-sections">
              <span data-cms="home:hero.cta_label">{cta_label}</span>
            </a>
          </Button>
        )}
      </div>
      <h1 className="site-hero-brand absolute z-10">
        <img src={heroWordmark} alt={SITE_NAME} width={1412} height={716} />
      </h1>
    </section>
  );
}

/** A large statement. Repeatable: `text` is the section's own copy, `cms` its CMS field address. */
export function TextBlock({ text, cms }: { text: string; cms?: string | undefined }) {
  const show = useShow();
  if (!show(text)) return null;
  return (
    <section className="site-text-block">
      <div className="w-full">
        <p className="site-text-block-copy" data-cms={cms} data-cms-multiline>
          {text}
        </p>
      </div>
    </section>
  );
}

export { StackCards } from "./StackingCards";
export { Bio } from "./Biography";

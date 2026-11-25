import { Button } from "@/components/ui/button";
import { ExternalArrow } from "@/components/ExternalArrow";
import { BrandSymbol } from "@/components/BrandSymbol";
import { investmentTags, investmentWebsite } from "@/lib/investments";
import { isFilled } from "@/lib/show-if";
import { useStudioMode } from "@/lib/studio-mode";
import type { Tables } from "@/integrations/supabase/types";

export function InvestmentCard({
  company,
  open,
  onOpen,
}: {
  company: Tables<"investments">;
  open: boolean;
  onOpen: (id: string | null) => void;
}) {
  const website = investmentWebsite(company.website_url);
  const detailsId = `investment-${company.id}`;
  const toggle = () => onOpen(open ? null : company.id);
  const tags = investmentTags(company);
  // In the Studio canvas the card can take feedback comments (pinned to the record).
  const studio = useStudioMode();
  return (
    <li
      className="site-investment-card"
      data-open={open}
      {...(studio ? { "data-cms-record": `record:investments:${company.id}` } : {})}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onOpen(company.id);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse" && !event.currentTarget.contains(document.activeElement))
          onOpen(null);
      }}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) onOpen(company.id);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onOpen(null);
      }}
    >
      <div className="site-investment-turn">
        <Button
          variant="ghost"
          className="site-investment-front"
          aria-label={`${company.name}${company.is_placeholder ? " · Placeholder" : ""} — toggle details`}
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={toggle}
        >
          {isFilled(company.logo_url) ? (
            <img src={company.logo_url} alt={company.name} loading="lazy" />
          ) : (
            <span role="img" aria-label={`${company.name} logo`}>
              <BrandSymbol />
            </span>
          )}
          {isFilled(tags) && <span className="site-investment-front-tags">{tags}</span>}
        </Button>
        <div
          id={detailsId}
          className="site-investment-back"
          aria-hidden={!open}
          onClick={(event) => {
            if (!(event.target instanceof Element) || !event.target.closest("a")) toggle();
          }}
        >
          <div className="site-investment-accent" aria-hidden="true" />
          <h2>{company.name}</h2>
          {isFilled(tags) && <p className="site-investment-tags">{tags}</p>}
          {isFilled(company.description) && (
            <p className="site-investment-description">{company.description}</p>
          )}
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={open ? 0 : -1}
              aria-label={`${company.is_placeholder ? "Example site" : "Visit site"} for ${company.name} (opens in a new tab)`}
            >
              {company.is_placeholder ? "Example site" : "Visit site"}
              <ExternalArrow />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enquiryMailto, enquirySchema } from "@/lib/enquiry";

export function FooterEnquiry({ recipient }: { recipient: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = enquirySchema.safeParse({ email });
        if (!parsed.success) {
          setStatus("Enter a valid email address.");
          return;
        }
        window.location.href = enquiryMailto(parsed.data.email, recipient);
        setStatus("Complete your enquiry in your email app. It has not been sent yet.");
      }}
    >
      <div className="site-footer-form-wrap">
        <input
          aria-label="Email address"
          type="email"
          required
          maxLength={255}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Your email address"
          autoComplete="email"
        />
        <Button
          variant="ghost"
          type="submit"
          className="site-footer-form-btn"
          aria-label="Enquire by email"
          title="Enquire by email"
        >
          <ArrowRight size={14} />
        </Button>
      </div>
      <p className="site-footer-form-status" role="status">
        {status}
      </p>
    </form>
  );
}

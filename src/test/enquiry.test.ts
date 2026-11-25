import { describe, expect, it } from "vitest";
import { enquiryMailto } from "@/lib/enquiry";

describe("enquiry destination", () => {
  it("addresses enquiries to the recipient set in Settings", () => {
    expect(enquiryMailto("reader@example.com", "editor@example.com").split("?")[0]).toBe(
      "mailto:editor@example.com",
    );
  });
  it("rejects malformed addresses", () => {
    expect(() => enquiryMailto("not-an-email", "a@b.co")).toThrow();
  });
});

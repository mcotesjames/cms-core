import { z } from "zod";

export const enquirySchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255),
});
export function enquiryMailto(email: string, recipient: string) {
  const data = enquirySchema.parse({ email });
  return `mailto:${recipient}?subject=${encodeURIComponent("Resources enquiry")}&body=${encodeURIComponent(`I would like to enquire about your resources.\n\nMy email: ${data.email}`)}`;
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-4 focus:outline-none focus:ring-2 focus:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-[var(--st-draft-soft)] text-muted-foreground",
        secondary: "bg-[var(--st-draft-soft)] text-muted-foreground",
        destructive: "bg-[var(--st-danger-soft)] text-[var(--st-danger)]",
        outline: "border border-border text-muted-foreground",
        /* Status (design.md → Status): soft fill, status text, a dot; draft is a hollow ring. */
        live: "bg-[var(--st-live-soft)] text-[var(--st-live)] before:size-[7px] before:rounded-full before:bg-current",
        changes:
          "bg-[var(--st-edited-soft)] text-[var(--st-edited-text)] before:size-[7px] before:rounded-full before:bg-[var(--st-edited)]",
        draft:
          "bg-[var(--st-draft-soft)] text-muted-foreground before:size-[7px] before:rounded-full before:border-[1.5px] before:border-[var(--st-draft)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

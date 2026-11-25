import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full py-2 leading-[1.45] disabled:cursor-not-allowed disabled:opacity-50 rounded-lg border border-input bg-[var(--st-card-inset)] px-3 text-sm transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--st-text-3)] focus-visible:outline-none focus-visible:border-[var(--st-accent)] focus-visible:shadow-[0_0_0_3px_var(--st-accent-soft)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };

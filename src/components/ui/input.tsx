import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full py-1 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:cursor-not-allowed disabled:opacity-50 rounded-lg border border-input bg-[var(--st-card-inset)] px-3 text-sm transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--st-text-3)] focus-visible:outline-none focus-visible:border-[var(--st-accent)] focus-visible:shadow-[0_0_0_3px_var(--st-accent-soft)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

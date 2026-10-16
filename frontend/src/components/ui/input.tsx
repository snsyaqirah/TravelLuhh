import * as React from "react";

import { cn } from "@/lib/utils";

// A ledger field: sunken fill, 1.5px bottom rule in --field, square sides, 2px top corners (§5.2).
// Text is 16px at every size so iOS never zooms on focus.
export const fieldClasses =
  "w-full rounded-none rounded-t-sm border-0 border-b-[1.5px] border-field bg-sunken px-3 text-base text-ink transition-colors duration-micro ease-out placeholder:text-ink-2 hover:border-ink focus-visible:border-fund disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-stamp";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          fieldClasses,
          "flex h-11 py-2 file:mr-3 file:border-0 file:bg-transparent file:font-sans file:text-sm file:font-medium file:text-ink",
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

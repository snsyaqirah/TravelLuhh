import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";

import { cn } from "@/lib/utils";

const InputOTP = React.forwardRef<React.ElementRef<typeof OTPInput>, React.ComponentPropsWithoutRef<typeof OTPInput>>(
  ({ className, containerClassName, ...props }, ref) => (
    <OTPInput
      ref={ref}
      containerClassName={cn("flex items-center gap-3 has-[:disabled]:opacity-50", containerClassName)}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  ),
);
InputOTP.displayName = "InputOTP";

// Cells sit 2px apart like a departures board.
const InputOTPGroup = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex items-center gap-0.5", className)} {...props} />,
);
InputOTPGroup.displayName = "InputOTPGroup";

// A SplitFlap cell (§5.4): ink card (near-black in dark), leaf Plex Mono 600 digit, a hairline across the
// middle where the flap splits, 2px radius. The active cell gets the fund focus ring.
const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-14 w-11 items-center justify-center rounded-sm bg-ink font-mono text-[28px] font-semibold leading-none text-leaf dark:bg-shade dark:text-ink",
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-paper/40 dark:after:bg-ink/20",
        isActive && "z-10 outline outline-2 outline-offset-2 outline-ring",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-7 w-0.5 animate-caret-blink bg-leaf dark:bg-ink" />
        </div>
      )}
    </div>
  );
});
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="separator" className={cn("flex items-center", className)} {...props}>
      <span className="h-0.5 w-3 bg-rule-strong" />
    </div>
  ),
);
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };

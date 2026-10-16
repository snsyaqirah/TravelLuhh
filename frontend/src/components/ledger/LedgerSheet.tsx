// One sheet, two shapes (§9.6): a vaul bottom sheet on phones, a 420px right drawer from tablets up. Paper
// background so the ReceiptSlip inside reads as a slip; the body scrolls and the footer (primary action)
// stays put. Titles and descriptions are real Radix titles for screen readers.
import type { ReactNode, RefObject } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/components/shell/useMediaQuery';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

export const WIDE_SHEET_QUERY = '(min-width: 768px)';

export interface LedgerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Mono overline above the title (also the accessible description). */
  overline?: ReactNode;
  children: ReactNode;
  /** Sticky footer under the scrolling body. */
  footer?: ReactNode;
  /** Element to focus when the sheet opens (the amount field). Defaults to Radix behaviour. */
  initialFocus?: RefObject<HTMLElement>;
  /** Phones: take the full height (a form that grows) instead of fitting the content. */
  fill?: boolean;
  className?: string;
  /** Test hook / styling hook. */
  'data-sheet'?: string;
}

export function LedgerSheet({ open, onOpenChange, title, overline, children, footer, initialFocus, fill = false, className, ...rest }: LedgerSheetProps) {
  const wide = useMediaQuery(WIDE_SHEET_QUERY);
  const onOpenAutoFocus = (e: Event) => {
    if (!initialFocus) return;
    e.preventDefault();
    // Let the sheet finish mounting before focusing, so the mobile keyboard opens on the right field.
    window.requestAnimationFrame(() => initialFocus.current?.focus({ preventScroll: true }));
  };

  const header = (Title: typeof SheetTitle | typeof DrawerTitle, Description: typeof SheetDescription | typeof DrawerDescription) => (
    <div className="flex shrink-0 items-start gap-3 border-b border-rule px-4 pb-3 pt-3 md:px-5 md:pt-5">
      <div className="min-w-0 flex-1 pr-10 md:pr-8">
        {overline ? (
          <Description className="type-overline truncate text-ink-2">{overline}</Description>
        ) : (
          <Description className="sr-only">{typeof title === 'string' ? title : 'Details'}</Description>
        )}
        <Title className="type-display-3 mt-1 text-ink">{title}</Title>
      </div>
    </div>
  );

  const body = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 md:px-5">
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-rule bg-paper px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 md:px-5 md:pb-5">
          {footer}
        </div>
      ) : null}
    </>
  );

  if (wide) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          onOpenAutoFocus={onOpenAutoFocus}
          className={cn('flex w-full flex-col gap-0 overflow-hidden bg-paper p-0 sm:max-w-[420px]', className)}
          {...rest}
        >
          {header(SheetTitle, SheetDescription)}
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn('bg-paper', fill && 'h-[calc(100dvh-2.5rem)] max-h-[calc(100dvh-2.5rem)]', className)}
        {...rest}
      >
        {header(DrawerTitle, DrawerDescription)}
        <DrawerClose
          className="absolute right-2 top-5 inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-accent hover:text-ink"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </DrawerClose>
        {body}
      </DrawerContent>
    </Drawer>
  );
}

// Small shared pieces for the trip forms (Create flow and Edit sheet): labels, inline errors, helper lines.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Inline validation message. Plain English, ink text with a stamp rule and ▲ so colour is never the only cue. */
export function FieldError({ id, children, className }: { id?: string; children?: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className={cn('type-body-s mt-2 flex items-start gap-2 border-l-[3px] border-stamp pl-2 text-ink', className)}>
      <span aria-hidden="true" className="font-mono text-[11px] leading-5 text-stamp">
        ▲
      </span>
      <span>{children}</span>
    </p>
  );
}

/** Mono overline label above a field or group. */
export function FieldLabel({ htmlFor, id, children, className }: { htmlFor?: string; id?: string; children: ReactNode; className?: string }) {
  const Tag = htmlFor ? 'label' : 'p';
  return (
    <Tag id={id} htmlFor={htmlFor} className={cn('type-overline block text-ink-2', className)}>
      {children}
    </Tag>
  );
}

/** One live helper line in mono (e.g. '≈ ¥ 98,200 at today's rate'). */
export function HelperLine({ children, className, id }: { children?: ReactNode; className?: string; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} className={cn('type-ledger text-[13px] leading-5 text-ink-2', className)}>
      {children}
    </p>
  );
}

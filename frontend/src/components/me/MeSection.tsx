// A ruled section of the Me page (§9.8): no card, just a rule above, a title and the content. Plus the inline
// notes every form here uses: errors in stamp (role="alert"), confirmations in fund (role="status"), so
// feedback sits next to the thing it's about instead of in a toast.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MeSectionProps {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function MeSection({ id, title, description, children, className }: MeSectionProps) {
  return (
    <section aria-labelledby={id} className={cn('border-t border-rule pt-5 lg:pt-6', className)}>
      <h2 id={id} className="type-title text-ink">
        {title}
      </h2>
      {description ? <p className="type-body-s mt-1 text-ink-2">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function FormNote({ tone, id, children, className }: { tone: 'error' | 'ok'; id?: string; children: ReactNode; className?: string }) {
  return (
    <p
      id={id}
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('type-body-s', tone === 'error' ? 'text-stamp' : 'text-fund', className)}
    >
      {children}
    </p>
  );
}

/** Field-level error under an input (linked with aria-describedby). */
export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="type-body-s mt-1.5 text-stamp">
      {children}
    </p>
  );
}

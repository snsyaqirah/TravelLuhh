import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

function initial(user: Pick<User, 'name' | 'email'> | null | undefined): string {
  const source = user?.name?.trim() || user?.email?.trim() || '';
  return source ? source.charAt(0).toUpperCase() : '';
}

export interface UserSquareProps {
  user: Pick<User, 'name' | 'email' | 'avatar'> | null | undefined;
  /** px; the AppBar uses 32. */
  size?: number;
  tone?: 'paper' | 'sidebar';
  className?: string;
}

/** Square photo box (2px radius, ink rule): the Google photo when there is one, else the initial. Decorative. */
export function UserSquare({ user, size = 32, tone = 'paper', className }: UserSquareProps) {
  const [broken, setBroken] = useState<string | null>(null);
  const src = user?.avatar && user.avatar !== broken ? user.avatar : null;

  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-sm border font-display font-medium leading-none',
        tone === 'sidebar'
          ? 'border-sidebar-foreground/70 bg-sidebar-accent text-sidebar-foreground'
          : 'border-ink bg-leaf text-ink',
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setBroken(src)}
        />
      ) : (
        initial(user)
      )}
    </span>
  );
}

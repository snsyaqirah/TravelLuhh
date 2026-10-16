// The ContextFab's two-item dial (Drop in · Log spend) before an upcoming trip. Its own lazy chunk: the Radix
// menu and floating-ui would otherwise sit in the entry chunk for a control only upcoming trips show.
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FAB_FACE, FAB_ROOT } from '@/components/trip/fabStyle';

export interface FabDialProps {
  onPick: (sheet: 'drop-in' | 'log-spend') => void;
  className?: string;
}

export default function FabDial({ onPick, className }: FabDialProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(FAB_ROOT, className)} aria-label="Add to this trip: drop in or log a spend">
        <span aria-hidden className={FAB_FACE}>
          <Plus className="h-6 w-6" strokeWidth={2} />
        </span>
        <span aria-hidden className="mt-0.5 text-[11px] font-medium leading-[14px] text-ink">
          Add
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" sideOffset={8} className="w-48">
        <DropdownMenuItem className="min-h-11" onSelect={() => onPick('drop-in')}>
          Drop in
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => onPick('log-spend')}>
          Log spend
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

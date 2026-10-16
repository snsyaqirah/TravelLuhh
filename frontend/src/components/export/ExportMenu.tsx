import { Download } from 'lucide-react';
import { toast } from 'sonner';
import type { Expense, Trip } from '@/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportExpensesToCSV, exportTripToCSV, printTripReport } from '@/lib/export';
import { cn } from '@/lib/utils';

interface ExportMenuProps {
  trip: Trip;
  expenses: Expense[];
  /** Icon-only trigger (phones). The accessible name stays "Export". */
  compact?: boolean;
  className?: string;
}

/** CSV and print exports of a trip (lib/export escapes everything people typed). */
export function ExportMenu({ trip, expenses, compact, className }: ExportMenuProps) {
  const count = expenses.length;
  const entries = `${count} ${count === 1 ? 'entry' : 'entries'}`;

  const ledgerCsv = () => {
    exportExpensesToCSV(expenses, trip.name);
    toast.success('Ledger saved as CSV', { description: `${entries} from ${trip.name}.` });
  };

  const reportCsv = () => {
    exportTripToCSV(trip, expenses);
    toast.success('Trip report saved as CSV', { description: `Budget, totals and ${entries}.` });
  };

  const print = () => {
    if (!printTripReport(trip, expenses)) {
      toast('Your browser blocked the print window', {
        description: 'The report was downloaded as an HTML file instead. Open it and print from there.',
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={compact ? 'ghost' : 'secondary'}
          size={compact ? 'icon' : 'sm'}
          aria-label={compact ? 'Export' : undefined}
          className={cn(!compact && 'h-11 md:h-9', className)}
        >
          <Download aria-hidden="true" />
          {compact ? null : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="type-overline text-ink-3">Export {trip.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={ledgerCsv} disabled={count === 0}>
          Ledger (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={reportCsv}>Trip report (CSV)</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={print}>Print or save as PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

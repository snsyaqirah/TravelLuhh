// The visible sentence under every scene (§7.8): the same text the stage uses as its aria-label, plus the
// "1 coin = RM 20" unit chip when the scene quantises money.
import type { SceneSpecBase } from '@/iso/specs';
import { cn } from '@/lib/utils';

export interface SceneSummaryProps {
  spec: Pick<SceneSpecBase, 'summary' | 'unitChip'>;
  className?: string;
  id?: string;
}

export function SceneSummary({ spec, className, id }: SceneSummaryProps) {
  return (
    <p id={id} className={cn('type-body-s text-ink-2', className)}>
      {spec.summary}
      {spec.unitChip ? (
        <span className="type-ledger ml-2 inline-block whitespace-nowrap rounded-sm border border-brass-ink px-1.5 align-[1px] text-[12px] leading-4 text-ink-2">
          {spec.unitChip}
        </span>
      ) : null}
    </p>
  );
}

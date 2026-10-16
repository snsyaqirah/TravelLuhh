// Places DOM content at a projected stage point inside IsoStage's `overlay` layer, e.g. the BALIK or SIAP
// PassportStamp at spec.stamp.at:
//
//   <IsoStage spec={spec} overlay={(project) =>
//     spec.stamp ? <StageAnchor point={project(spec.stamp.at)}><PassportStamp … /></StageAnchor> : null} />
//
// Whole-pixel positions (crisp text); the layer is pointer-events: none, so the scene's targets stay usable.
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StageAnchorSide = 'center' | 'above' | 'below' | 'left' | 'right';

const TRANSLATE: Record<StageAnchorSide, string> = {
  center: 'translate(-50%, -50%)',
  above: 'translate(-50%, calc(-100% - 6px))',
  below: 'translate(-50%, 6px)',
  left: 'translate(calc(-100% - 6px), -50%)',
  right: 'translate(6px, -50%)',
};

export interface StageAnchorProps {
  /** Slot pixels from IsoStage's `project`. */
  point: readonly [number, number];
  /** Which side of the point the content sits on. Default 'center'. */
  side?: StageAnchorSide;
  className?: string;
  children: ReactNode;
}

export function StageAnchor({ point, side = 'center', className, children }: StageAnchorProps) {
  const style: CSSProperties = {
    transform: `translate(${Math.round(point[0])}px, ${Math.round(point[1])}px) ${TRANSLATE[side]}`,
  };
  return (
    <div className={cn('absolute left-0 top-0', className)} style={style}>
      {children}
    </div>
  );
}

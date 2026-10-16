// Scene registry: the module IsoStage imports lazily (import('@/iso/scenes/registry')) once the gate passes
// and the slot is near the viewport. Importing it pulls three, r3f and the canvas; each scene is its own
// chunk on top of that (React.lazy below).
//
// Contract for scene files (E7/E8): src/iso/scenes/<Name>.tsx must `export default` a component taking
// IsoSceneProps<YourSpec>. SVG twins in src/iso/svg/<Name>Svg.tsx export a named `<Name>Svg` component
// taking IsoSvgTwinProps<YourSpec> and returning SVG content (see svg/IsoSvg.tsx).
import { lazy, type LazyExoticComponent } from 'react';
import type { SceneKind } from '@/iso/specs';
import type { IsoSceneComponent, IsoSvgTwinComponent } from '@/iso/types';
import { svgTwins } from '@/iso/svg/registry';

export interface SceneEntry {
  Scene: LazyExoticComponent<IsoSceneComponent>;
  Svg: IsoSvgTwinComponent;
}

const scene = (load: () => Promise<{ default: unknown }>) =>
  lazy(load as () => Promise<{ default: IsoSceneComponent }>);

export const sceneRegistry: Record<SceneKind, SceneEntry> = {
  shelf: { Scene: scene(() => import('@/iso/scenes/Shelf')), Svg: svgTwins.shelf },
  tripPlot: { Scene: scene(() => import('@/iso/scenes/TripPlot')), Svg: svgTwins.tripPlot },
  counter: { Scene: scene(() => import('@/iso/scenes/Counter')), Svg: svgTwins.counter },
  suitcase: { Scene: scene(() => import('@/iso/scenes/Suitcase')), Svg: svgTwins.suitcase },
  kampung: { Scene: scene(() => import('@/iso/scenes/Kampung')), Svg: svgTwins.kampung },
};

export { IsoCanvas } from '@/iso/canvas/IsoCanvas';
export { SceneSwitch } from '@/iso/scenes/SceneSwitch';

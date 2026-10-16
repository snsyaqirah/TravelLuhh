// What every primitive needs from the canvas it lives in. Provided by IsoCanvas.
import { createContext, useContext } from 'react';
import type { ThemeName } from '@/design/tokens';
import { palette3d, type Palette3D } from '@/iso/palette3d';
import { createTweenStore, type TweenStore } from '@/iso/tween';
import type { IsoTier } from '@/iso/types';

export interface IsoContextValue {
  theme: ThemeName;
  tier: IsoTier;
  palette: Palette3D;
  tweens: TweenStore;
  reducedMotion: boolean;
}

const fallbackTweens = createTweenStore();

export const IsoContext = createContext<IsoContextValue>({
  theme: 'light',
  tier: 'high',
  palette: palette3d('light'),
  tweens: fallbackTweens,
  reducedMotion: false,
});

export const useIso = () => useContext(IsoContext);

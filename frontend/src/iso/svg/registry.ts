// kind → SVG twin. Synchronous: IsoStage paints the twin first, before any 3D code loads.
import type { SvgTwinRegistry } from '@/iso/types';
import { CounterSvg } from '@/iso/svg/CounterSvg';
import { KampungSvg } from '@/iso/svg/KampungSvg';
import { ShelfSvg } from '@/iso/svg/ShelfSvg';
import { SuitcaseSvg } from '@/iso/svg/SuitcaseSvg';
import { TripPlotSvg } from '@/iso/svg/TripPlotSvg';

export const svgTwins: SvgTwinRegistry = {
  shelf: ShelfSvg as SvgTwinRegistry['shelf'],
  tripPlot: TripPlotSvg as SvgTwinRegistry['tripPlot'],
  counter: CounterSvg as SvgTwinRegistry['counter'],
  suitcase: SuitcaseSvg as SvgTwinRegistry['suitcase'],
  kampung: KampungSvg as SvgTwinRegistry['kampung'],
};

// Tabung motif components (DESIGN-SPEC §5.4). At most two motifs per view; stamps are earned.
export { MoneyFigure, type MoneyFigureProps, type MoneyTone } from './MoneyFigure';
export { CoinRail, type CoinRailProps } from './CoinRail';
export { PhaseTag, type PhaseTagProps } from './PhaseTag';
export { TripTicket, type TripTicketProps, type TripTicketMiniProps, type TicketTrip } from './TripTicket';
export { TicketField, TicketFieldGrid, type TicketFieldProps } from './TicketField';
export { Passbook, type PassbookProps } from './Passbook';
export { PassbookDayHeader, type PassbookDayHeaderProps } from './PassbookDayHeader';
export {
  computePassbook,
  groupPassbookDays,
  tripDayOf,
  type PassbookRow,
  type PassbookSubRow,
  type PassbookLine,
  type PassbookDay,
} from './passbookMath';
export { PassportStamp, type PassportStampProps } from './PassportStamp';
export { ReceiptSlip, ReceiptRule, ReceiptLine, type ReceiptSlipProps, type ReceiptLineProps } from './ReceiptSlip';
export { SplitFlap, type SplitFlapProps } from './SplitFlap';
export { NoticeSlip, type NoticeSlipProps, type NoticeSlipLevel } from './NoticeSlip';
export { useSessionDismissed } from './useSessionDismissed';
export { LedgerTabs, type LedgerTab, type LedgerTabsProps } from './LedgerTabs';
export { ledgerTabId, ledgerPanelId } from './ledgerTabsIds';
export { DeparturesBoard, Sparkline, type DeparturesBoardProps, type DeparturesRow } from './DeparturesBoard';
export { DivergingBar, type DivergingBarProps, type DivergingRow } from './DivergingBar';
export { GhostOutline, type GhostOutlineProps, type GhostKind } from './GhostOutline';
export { AirmailStripe } from './AirmailStripe';
export { SceneSummary, type SceneSummaryProps } from './SceneSummary';
export { regionOf, stampShapeFor, REGION_BY_CODE, REGION_SHAPE, type StampShape, type Region } from './regions';
export { stampRotation, STAMP_ROTATION_MIN, STAMP_ROTATION_MAX } from './stampMath';
export {
  phaseTagText,
  phaseTagPropsFor,
  routeLabel,
  ticketFieldRow,
  partyLabel,
  isGroupTrip,
  type PhaseTagInput,
} from './tripMeta';
export { MiniBalangSvg, type MiniBalangSvgProps } from '@/iso/svg/MiniBalangSvg';

// The trip as a boarding pass (§5.4). A stub with the trip's jar and destination code, a perforation with
// notches, then the main part: phase tag, name, mono field row, CoinRail, one practical line.
//   list    Trips page and Passport timeline
//   hero    Home status ticket (countdown on upcoming, daily allowance on the road, baki at home)
//   review  Create, step 5: everything you're about to open, no menu
//   mini    itinerary items: no stub, side notches
// The ⋯ menu is always visible (44px), never hover-only. Home trips get a BALIK stamp over the top-right corner.
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Trip } from '@/types';
import { computeFund, type FundState } from '@/hooks/useFund';
import { useToday } from '@/hooks/useToday';
import { formatMoney, roundMoney } from '@/lib/money';
import { formatDayMonth } from '@/lib/dates';
import { durationLabel } from '@/lib/phase';
import { paceSentence, practicalLine, sentenceMoney } from '@/lib/fundCopy';
import { MiniBalangSvg } from '@/iso/svg/MiniBalangSvg';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AirmailStripe } from '@/components/motifs/AirmailStripe';
import { CoinRail } from '@/components/motifs/CoinRail';
import { MoneyFigure } from '@/components/motifs/MoneyFigure';
import { PassportStamp } from '@/components/motifs/PassportStamp';
import { PhaseTag } from '@/components/motifs/PhaseTag';
import { SplitFlap } from '@/components/motifs/SplitFlap';
import { TicketField, TicketFieldGrid } from '@/components/motifs/TicketField';
import { regionOf } from '@/components/motifs/regions';
import { countries } from '@/data/countries';
import { isGroupTrip, partyLabel, phaseTagPropsFor, routeLabel, ticketFieldRow } from '@/components/motifs/tripMeta';
import { CountryChip } from '@/components/glyphs/CountryChip';

/** The trip fields a ticket reads. A draft (Create step 5) has no id yet. */
export type TicketTrip = Pick<Trip, 'name' | 'destinationCountry' | 'startDate' | 'endDate' | 'budget' | 'currency' | 'budgetType'> &
  Partial<Pick<Trip, 'id' | 'memberCount' | 'members' | 'totalExpenses' | 'spentAmount' | 'savedAmount'>>;

interface TicketActions {
  /** Edit and Delete live in the ⋯ menu; the menu only renders when at least one is given. */
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export interface TripTicketProps extends TicketActions {
  variant?: 'list' | 'hero' | 'review';
  trip: TicketTrip;
  /** From useFund(trip). Computed from the trip when omitted. */
  fund?: FundState;
  /** The traveller's home country, for 'MY → JP'. */
  homeCountry?: string | null;
  /** Makes the whole ticket a link (react-router). */
  to?: string;
  /** Freeze "today" (demos, tests). */
  today?: Date;
  /** Replaces the practical line under the rail. */
  caption?: ReactNode;
  /** Picked-up look: the 2px hard shadow. */
  selected?: boolean;
  /** Play the BALIK stamp-in (first view of a completed trip). */
  stampAnimate?: boolean;
  /** Heading level of the trip name (default 3). */
  headingLevel?: 2 | 3 | 4;
}

export interface TripTicketMiniProps extends TicketActions {
  variant: 'mini';
  title: string;
  /** Opens in maps. */
  location?: string | null;
  glyph?: ReactNode;
  /** Extra line under the title (time, notes). */
  meta?: ReactNode;
  headingLevel?: 3 | 4;
}

// Two half-height mask layers, one notch each, so the perforation gets a bite top and bottom without
// mask-composite. --stub is the stub width.
const STUB_NOTCHES: CSSProperties = {
  WebkitMask:
    'radial-gradient(circle 8px at var(--stub) 0, transparent 7.5px, black 8px) top / 100% 51% no-repeat, radial-gradient(circle 8px at var(--stub) 100%, transparent 7.5px, black 8px) bottom / 100% 51% no-repeat',
  mask: 'radial-gradient(circle 8px at var(--stub) 0, transparent 7.5px, black 8px) top / 100% 51% no-repeat, radial-gradient(circle 8px at var(--stub) 100%, transparent 7.5px, black 8px) bottom / 100% 51% no-repeat',
};

const SIDE_NOTCHES: CSSProperties = {
  WebkitMask:
    'radial-gradient(circle 6px at 0 50%, transparent 5.5px, black 6px) left / 51% 100% no-repeat, radial-gradient(circle 6px at 100% 50%, transparent 5.5px, black 6px) right / 51% 100% no-repeat',
  mask: 'radial-gradient(circle 6px at 0 50%, transparent 5.5px, black 6px) left / 51% 100% no-repeat, radial-gradient(circle 6px at 100% 50%, transparent 5.5px, black 6px) right / 51% 100% no-repeat',
};

const PERFORATION: CSSProperties = {
  backgroundImage: 'linear-gradient(to bottom, hsl(var(--rule-strong)) 50%, transparent 50%)',
  backgroundSize: '1.5px 8px',
};

// The mask clips box-shadow, so "picked up" is a 0-blur drop-shadow on a wrapper and follows the notches.
const LIFTED = '[filter:drop-shadow(2px_2px_0_hsl(var(--shade)/0.18))] dark:[filter:drop-shadow(2px_2px_0_hsl(var(--shade)))]';

function TicketMenu({ name, onEdit, onDelete, className }: { name: string; onEdit?: () => void; onDelete?: () => void; className?: string }) {
  if (!onEdit && !onDelete) return null;
  return (
    <div className={cn('absolute right-0 top-0 z-10', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`More for ${name}`}
          className="pressable flex h-11 w-11 items-center justify-center rounded-lg text-ink-2 hover:bg-accent hover:text-ink data-[state=open]:bg-accent data-[state=open]:text-ink"
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[10rem]">
          {onEdit ? <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem> : null}
          {onDelete ? (
            <DropdownMenuItem onSelect={onDelete} className="text-stamp focus:bg-stamp-tint focus:text-stamp">
              Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TripName({ name, to, level = 3, className }: { name: string; to?: string; level?: 2 | 3 | 4; className?: string }) {
  const H = `h${level}` as 'h2' | 'h3' | 'h4';
  return (
    <H className={cn('min-w-0 font-display font-medium text-ink', className)}>
      {to ? (
        <Link
          to={to}
          // stretched over the paper (ring drawn inside: the notch mask clips anything outside); the ⋯ menu sits above it
          className="outline-none after:absolute after:inset-0 after:z-[1] after:rounded-lg after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring"
        >
          {name}
        </Link>
      ) : (
        name
      )}
    </H>
  );
}

export function TripTicket(props: TripTicketProps | TripTicketMiniProps) {
  if (props.variant === 'mini') return <MiniTicket {...props} />;
  return <FullTicket {...props} />;
}

function FullTicket({
  variant = 'list',
  trip,
  fund: fundProp,
  homeCountry,
  to,
  today: todayProp,
  caption,
  selected,
  stampAnimate,
  headingLevel = 3,
  onEdit,
  onDelete,
  className,
}: TripTicketProps) {
  // Rolls over at local midnight even when the page doesn't pass `today`.
  const today = useToday(todayProp);
  const fund = fundProp ?? computeFund(trip, today);
  const tag = phaseTagPropsFor(trip, today, { saving: fund.mode === 'saving' });
  const group = isGroupTrip(trip);
  const home = fund.phase === 'home';
  const over = fund.over > 0;
  const menu = variant !== 'review';
  const seed = trip.id ?? trip.name;
  const line = caption ?? practicalLine(fund);
  const isHero = variant === 'hero';

  const fields = (
    <TicketFieldGrid className={isHero ? 'mt-4' : 'mt-3'}>
      <TicketField label="From/To" value={routeLabel(trip.destinationCountry, homeCountry)} />
      <TicketField label="Depart" value={formatDayMonth(trip.startDate)} />
      <TicketField label="Days" value={durationLabel(fund.daysTotal)} />
      <TicketField label="Fund" value={fund.hasBudget ? formatMoney(fund.target, fund.currency, { decimals: 'auto' }) : 'Not set'} />
    </TicketFieldGrid>
  );

  return (
    <article className={cn('relative [--stub:64px] md:[--stub:88px]', className)} data-variant={variant} data-phase={fund.phase}>
      <div className={cn(selected && LIFTED)}>
        <div className="relative flex min-h-[152px] overflow-hidden rounded-lg border border-rule bg-card" style={STUB_NOTCHES}>
          {group ? <AirmailStripe className="absolute inset-x-0 top-0" /> : null}

          {/* stub */}
          <div className="flex w-[var(--stub)] shrink-0 flex-col items-center justify-center gap-2 py-4">
            <MiniBalangSvg
              fill={fund.fill}
              phase={fund.phase}
              over={over}
              slots={trip.budgetType === 'shared' ? 3 : 1}
              width={56}
              height={72}
              className="h-14 w-11 md:h-[72px] md:w-14"
            />
            <CountryChip code={trip.destinationCountry} />
          </div>
          <span aria-hidden="true" className="absolute bottom-3 top-3 left-[var(--stub)] w-[1.5px]" style={PERFORATION} />

          {/* main */}
          <div className={cn('flex min-w-0 flex-1 flex-col py-3 pl-4 md:pl-5', menu ? 'pr-3' : 'pr-4', group && 'pt-4')}>
            <div className={cn('flex min-h-6 items-center', menu && 'pr-9')}>
              <PhaseTag {...tag} />
            </div>
            <TripName name={trip.name} to={to} level={headingLevel} className="mt-2 line-clamp-2 text-[22px] leading-7" />
            <p className="type-overline mt-1 truncate text-ink-2">
              {ticketFieldRow(trip, homeCountry, today)}
              {variant !== 'list' ? ` · ${partyLabel(trip)}` : null}
            </p>

            {isHero ? <HeroBody fund={fund} trip={trip} daysToGo={tag.daysToGo} /> : null}
            {isHero && fund.phase === 'upcoming' ? fields : null}
            {variant === 'review' ? fields : null}

            {!(isHero && fund.phase === 'upcoming') ? (
              <CoinRail
                className="mt-3"
                target={fund.target}
                spent={fund.spent}
                currency={fund.currency}
                inJar={fund.mode === 'saving' ? fund.inJar : undefined}
              />
            ) : null}
            {variant !== 'hero' && line ? <p className="type-body-s mt-2 text-ink-2">{line}</p> : null}
          </div>
        </div>
      </div>

      {home ? (
        <div className={cn('pointer-events-none absolute -top-3.5 z-[2]', menu ? 'right-10' : '-right-2')}>
          <PassportStamp
            text="BALIK"
            code={trip.destinationCountry}
            date={trip.endDate}
            region={regionOf(trip.destinationCountry)}
            seed={seed}
            size={64}
            animate={stampAnimate}
          />
        </div>
      ) : null}
      {menu ? <TicketMenu name={trip.name} onEdit={onEdit} onDelete={onDelete} /> : null}
    </article>
  );
}

/** "28 days to Tokyo": the capital when the catalogue has one, else the country name. */
function placeName(code: string): string {
  const c = countries.find((x) => x.code === code.toUpperCase());
  return c?.capital ?? c?.name ?? code.toUpperCase();
}

/** The hero's middle: countdown before, daily allowance on the road, baki (or over) at home. */
function HeroBody({ fund, trip, daysToGo }: { fund: FundState; trip: TicketTrip; daysToGo?: number }) {
  const c = fund.currency;
  if (fund.phase === 'upcoming') {
    const n = Math.max(0, daysToGo ?? 0);
    return (
      <div className="mt-3 flex items-end gap-3">
        <SplitFlap value={String(n)} label={n === 1 ? 'DAY' : 'DAYS'} size={36} />
        <p className="type-body-s pb-0.5 text-ink-2">to {placeName(trip.destinationCountry)}.</p>
      </div>
    );
  }
  if (fund.phase === 'onTheRoad') {
    const pace = paceSentence(fund);
    if (!fund.hasBudget && fund.saved <= 0) return <p className="type-body-s mt-3 text-ink-2">{practicalLine(fund)}</p>;
    if (fund.over > 0) {
      return (
        <div className="mt-3">
          <MoneyFigure size="hero" amount={-fund.over} currency={c} tone="stamp" />
          <p className="type-body-s mt-1 text-ink-2">Over budget with {fund.daysLeft} {fund.daysLeft === 1 ? 'day' : 'days'} to go.</p>
        </div>
      );
    }
    return (
      <div className="mt-3">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <MoneyFigure size="hero" amount={fund.dailyAllowance ?? 0} currency={c} tone="fund" decimals="none" />
          <span className="type-body-s text-ink-2">
            a day for the next {fund.daysLeft} {fund.daysLeft === 1 ? 'day' : 'days'}
          </span>
        </p>
        {pace ? <p className="type-body-s mt-1 text-ink">{pace}</p> : null}
      </div>
    );
  }
  // home
  if (fund.over > 0) {
    return (
      <div className="mt-3">
        <MoneyFigure size="hero" amount={-fund.over} currency={c} tone="stamp" />
        <p className="type-body-s mt-1 text-ink-2">Over by {sentenceMoney(fund.over, c)}. Happens.</p>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <p className="type-overline text-ink-3">Back with</p>
      <p className="flex items-baseline gap-2">
        {/* 'RM 312 baki': a whole baki drops its .00 even under 1,000 */}
        <MoneyFigure size="hero" amount={fund.inJar} currency={c} tone="fund" decimals={Number.isInteger(roundMoney(fund.inJar, c)) ? 'none' : undefined} />
        <span className="type-body-s text-ink-2">baki</span>
      </p>
    </div>
  );
}

function MiniTicket({ title, location, glyph, meta, headingLevel = 4, onEdit, onDelete, className }: TripTicketMiniProps) {
  const H = `h${headingLevel}` as 'h3' | 'h4';
  const menu = Boolean(onEdit || onDelete);
  return (
    <article className={cn('relative', className)}>
      <div className={cn('flex min-h-14 items-start gap-3 rounded-lg border border-rule bg-card py-2.5 pl-4', menu ? 'pr-12' : 'pr-4')} style={SIDE_NOTCHES}>
        {glyph ? (
          <span aria-hidden="true" className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center text-ink-2">
            {glyph}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <H className="font-sans text-[15px] font-medium leading-5 text-ink">{title}</H>
          {location ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="type-body-s mt-0.5 inline-block max-w-full truncate text-ink-2 underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
            >
              {location}
              <span className="sr-only"> (opens in maps)</span>
            </a>
          ) : null}
          {meta ? <div className="type-body-s mt-0.5 text-ink-3">{meta}</div> : null}
        </div>
      </div>
      <TicketMenu name={title} onEdit={onEdit} onDelete={onDelete} className="top-1.5" />
    </article>
  );
}

// "Built for the trips you actually take" (§9.1): a ruled three-row list, not cards. Each row has a 72px iso
// drawing in the shared projection: one jar, one jar with three slots, a jar each.
import { MiniBalangSvg } from '@/iso/svg/MiniBalangSvg';

const INVITE = 'Invite your geng by email once the tabung is open.';

function SoloJar() {
  return (
    <div className="flex h-[72px] w-[72px] items-end justify-center">
      <MiniBalangSvg fill={0.62} phase="onTheRoad" width={54} height={70} />
    </div>
  );
}

function OnePot() {
  return (
    <div className="flex h-[72px] w-[72px] items-end justify-center">
      <MiniBalangSvg fill={0.82} phase="upcoming" slots={3} width={58} height={72} />
    </div>
  );
}

function OwnJars() {
  return (
    <div className="relative h-[72px] w-[72px]">
      <MiniBalangSvg fill={0.9} phase="upcoming" width={28} height={36} className="absolute bottom-[18px] left-[4px]" />
      <MiniBalangSvg fill={0.55} phase="upcoming" width={28} height={36} className="absolute bottom-[9px] left-[22px]" />
      <MiniBalangSvg fill={0.25} phase="upcoming" width={28} height={36} className="absolute bottom-0 left-[40px]" />
    </div>
  );
}

const KINDS = [
  {
    id: 'solo',
    title: 'Solo',
    sub: 'one jar',
    line: "One target, one jar. Spend through it day by day and see what's left in ringgit, whatever you paid in.",
    art: <SoloJar />,
    invite: false,
  },
  {
    id: 'shared',
    title: 'Geng, one pot',
    sub: 'one big jar, everyone drops in',
    line: 'One jar for the whole group. Log who paid for what, and Kongsi works out who owes whom at the end.',
    art: <OnePot />,
    invite: true,
  },
  {
    id: 'separated',
    title: 'Geng, own money',
    sub: 'a jar each',
    line: 'Same trip, separate jars. Everyone sees their own baki and nobody fronts for anybody.',
    art: <OwnJars />,
    invite: true,
  },
] as const;

export function TripKinds() {
  return (
    <ol className="border-t border-rule-strong">
      {KINDS.map((k, i) => (
        <li
          key={k.id}
          className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-x-4 gap-y-1 border-b border-rule py-5 lg:grid-cols-[32px_72px_minmax(0,1fr)_minmax(0,1.25fr)] lg:items-center lg:gap-x-6 lg:py-6"
        >
          <span aria-hidden="true" className="hidden font-mono text-[12px] font-medium tracking-[0.08em] text-ink-3 lg:block">
            0{i + 1}
          </span>
          <div aria-hidden="true" className="row-span-2 lg:row-span-1">
            {k.art}
          </div>
          <h3 className="type-title text-ink">
            {k.title}
            <span className="sr-only">, </span>
            <span className="mt-0.5 block font-mono text-[13px] font-normal leading-5 text-ink-2">{k.sub}</span>
          </h3>
          <div className="type-body-s text-ink-2 lg:type-body">
            <p>{k.line}</p>
            {k.invite ? <p className="mt-1 text-ink-3">{INVITE}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

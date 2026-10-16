// Appearance (§9.8): the theme (Light · Dark · Auto, shared with the rail) and whether scenes are drawn in
// 3D (Auto · Off, travelluhh_pref_3d). Off applies at once to every mounted stage.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ThemeToggle } from '@/components/theme/ThemeProvider';
import { get3DPreference, set3DPreference, subscribe3DPreference, type Pref3D } from '@/iso/gate';
import { use3DGate } from '@/iso/hooks';
import { cn } from '@/lib/utils';
import { MeSection } from '@/components/me/MeSection';

const CHOICES: { value: Pref3D; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'off', label: 'Off' },
];

function ScenesToggle({ labelledBy, describedBy }: { labelledBy: string; describedBy: string }) {
  const [pref, setPref] = useState<Pref3D>(get3DPreference);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => subscribe3DPreference(setPref), []);

  const choose = (p: Pref3D) => {
    setPref(p);
    set3DPreference(p);
  };

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + CHOICES.length) % CHOICES.length;
    choose(CHOICES[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="inline-grid grid-cols-2 rounded-md border border-rule-strong bg-leaf p-0.5"
    >
      {CHOICES.map((c, i) => {
        const active = c.value === pref;
        return (
          <button
            key={c.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => choose(c.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'type-label h-10 min-w-[4.25rem] rounded-sm px-3 transition-colors duration-micro ease-out',
              active ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-accent hover:text-ink',
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function scenesNote(gate: ReturnType<typeof use3DGate>): string {
  const reason = 'reason' in gate ? gate.reason : null;
  if (!reason) return 'Scenes are drawn in 3D on this device.';
  switch (reason) {
    case 'pref-off':
      return 'Scenes are drawn flat. Same numbers, less battery.';
    case 'save-data':
      return 'Data Saver is on, so scenes are drawn flat.';
    case 'no-webgl':
      return "This browser can't draw 3D, so scenes are drawn flat.";
    case 'context-lost':
    case 'render-error':
      return 'The 3D view stopped working, so scenes are drawn flat until you reload.';
    default:
      return 'Scenes are drawn flat on this build.';
  }
}

export function AppearanceSection() {
  const ids = useId();
  const gate = use3DGate();
  return (
    <MeSection id={`${ids}-title`} title="Appearance">
      <div className="flex flex-col gap-6">
        <div>
          <p id={`${ids}-theme`} className="type-label text-ink-2">
            Theme
          </p>
          <ThemeToggle className="mt-2" />
        </div>
        <div>
          <p id={`${ids}-scenes`} className="type-label text-ink-2">
            3D scenes
          </p>
          <div className="mt-2">
            <ScenesToggle labelledBy={`${ids}-scenes`} describedBy={`${ids}-scenes-note`} />
          </div>
          <p id={`${ids}-scenes-note`} aria-live="polite" className="type-body-s mt-2 text-ink-2">
            {scenesNote(gate)}
          </p>
        </div>
      </div>
    </MeSection>
  );
}

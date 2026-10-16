/* eslint-disable react-refresh/only-export-components -- entry file for a dev-only page */
// Dev-only harness for E5: every iso glyph at 20 / 24 / 48 px (plus the sketch state) in both themes, side by
// side, then the glyphs in context (ledger rows, filter chips, packing headers, country chips).
// Open http://localhost:<port>/dev/e5.html   ?view=grid|context|big   ?only=light|dark
import { createRoot } from 'react-dom/client';

import '@/index.css';
import type { ThemeName } from '@/design/tokens';
import { AppThemeProvider } from '@/components/theme/ThemeProvider';
import { CategoryGlyph, CountryChip, GLYPH_GROUPS, IsoGlyph, type GlyphName } from '@/components/glyphs';
import { CATEGORIES } from '@/data/categories';
import { PACKING_CATEGORIES, PACKING_PRESETS } from '@/data/packing';
import { NOTE_CATEGORIES } from '@/data/notes';
import { POPULAR_FROM_MY, countries } from '@/data/countries';
import { SEASON_META } from '@/data/seasons';

const params = new URLSearchParams(window.location.search);
const view = params.get('view') ?? 'grid';
const only = params.get('only') as ThemeName | null;
// Dark-outline comparisons: ?dark=full|thin (the default is the component's soft outline).
const darkMode = params.get('dark');
const darkProps = darkMode === 'thin' ? { strokeWidth: 1.25 } : darkMode === 'full' ? { outlineOpacity: 1 } : {};

function Cell({ name, theme }: { name: GlyphName; theme: ThemeName }) {
  const x = theme === 'dark' ? darkProps : {};
  return (
    <div className="flex flex-col gap-1 border-b border-r border-rule p-2">
      <div className="flex items-end gap-2 text-ink">
        <IsoGlyph name={name} size={20} theme={theme} {...x} />
        <IsoGlyph name={name} size={24} theme={theme} {...x} />
        <IsoGlyph name={name} size={48} theme={theme} {...x} />
        <IsoGlyph name={name} size={24} theme={theme} sketch className="text-ink-3" {...x} />
      </div>
      <span className="font-mono text-[11px] text-ink-2">{name}</span>
    </div>
  );
}

function Grid({ theme }: { theme: ThemeName }) {
  return (
    <div className="space-y-4">
      {GLYPH_GROUPS.map((g) => (
        <section key={g.group}>
          <h2 className="type-overline mb-1 text-ink-3">{g.group}</h2>
          <div className="grid grid-cols-2 border-l border-t border-rule sm:grid-cols-3">
            {g.names.map((n) => (
              <Cell key={n} name={n} theme={theme} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Big({ theme }: { theme: ThemeName }) {
  return (
    <div className="flex flex-wrap gap-3">
      {GLYPH_GROUPS.flatMap((g) => g.names).map((n) => (
        <div key={n} className="flex flex-col items-center text-ink">
          <IsoGlyph name={n} size={96} theme={theme} />
          <span className="font-mono text-[10px] text-ink-3">{n}</span>
        </div>
      ))}
    </div>
  );
}

/** Every glyph at 20 and 24 in two tight rows, for pixel-level checks (zoom the screenshot). */
function Strip({ theme }: { theme: ThemeName }) {
  const x = theme === 'dark' ? darkProps : {};
  const names = GLYPH_GROUPS.flatMap((g) => g.names);
  return (
    <div className="space-y-2 text-ink">
      {[20, 24].map((size) => (
        <div key={size} className="flex flex-wrap gap-x-2 gap-y-2">
          {names.map((n) => (
            <IsoGlyph key={n} name={n} size={size} theme={theme} {...x} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Context({ theme }: { theme: ThemeName }) {
  const rows: Array<{ cat: (typeof CATEGORIES)[number]['key']; text: string; amt: string }> = [
    { cat: 'accommodation', text: 'Hotel night, Shinjuku', amt: '−¥ 14,200' },
    { cat: 'transportation', text: 'Narita Express', amt: '−¥ 3,070' },
    { cat: 'food', text: 'Ichiran Shinjuku', amt: '−¥ 1,180' },
    { cat: 'activities', text: 'teamLab Planets', amt: '−¥ 3,800' },
    { cat: 'bundle', text: 'Hakone day pass', amt: '−¥ 6,100' },
    { cat: 'shopping', text: 'Uniqlo Ginza', amt: '−¥ 4,990' },
    { cat: 'other', text: 'Coin lockers', amt: '−¥ 700' },
  ];
  return (
    <div className="space-y-5">
      <section>
        <h2 className="type-overline mb-1 text-ink-3">Ledger · 20px</h2>
        <div className="rounded-lg border border-rule bg-card">
          {rows.map((r, i) => (
            <div key={r.text} className={`flex h-12 items-center gap-3 px-3 ${i % 2 ? 'bg-stripe' : ''} border-b border-rule last:border-0`}>
              <CategoryGlyph category={r.cat} size={20} theme={theme} />
              <span className="flex-1 truncate text-[15px] text-ink">{r.text}</span>
              <span className="font-mono text-[13px] text-ink">{r.amt}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="type-overline mb-1 text-ink-3">Filter chips · 20px (Food on)</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = c.key === 'food';
            return (
              <span
                key={c.key}
                className={`inline-flex h-9 items-center gap-1.5 rounded-sm border px-2 text-[13px] ${on ? 'border-ink bg-fund-tint text-ink' : 'border-rule text-ink-2'}`}
              >
                <CategoryGlyph category={c.key} size={20} theme={theme} sketch={!on} className={on ? 'text-ink' : 'text-ink-3'} />
                {c.label}
              </span>
            );
          })}
        </div>
      </section>
      <section>
        <h2 className="type-overline mb-1 text-ink-3">Log spend grid · 24px</h2>
        <div className="grid w-[300px] grid-cols-4 gap-1">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="flex h-14 flex-col items-center justify-center gap-1 rounded-md border border-rule bg-card">
              <CategoryGlyph category={c.key} size={24} theme={theme} />
              <span className="text-[12px] text-ink-2">{c.label}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="type-overline mb-1 text-ink-3">Packing headers · 20px</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {PACKING_CATEGORIES.map((p) => (
            <span key={p.key} className="inline-flex items-center gap-1.5 text-ink">
              <IsoGlyph name={p.glyph} size={20} theme={theme} />
              <span className="type-overline">{p.label}</span>
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-1 border-y border-rule py-2 text-[14px] text-ink">
          {PACKING_PRESETS.map((p, i) => (
            <span key={p.key} className="inline-flex items-center gap-1.5 px-2">
              {i ? <span className="mr-2 text-ink-3">·</span> : null}
              <IsoGlyph name={p.glyph} size={20} theme={theme} />
              {p.label}
            </span>
          ))}
        </div>
      </section>
      <section>
        <h2 className="type-overline mb-1 text-ink-3">Seasons · notes · 20px</h2>
        <div className="flex flex-wrap gap-2">
          {SEASON_META.map((s) => (
            <span key={s.key} className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-rule px-2 text-[13px] text-ink">
              <IsoGlyph name={s.glyph} size={20} theme={theme} />
              {s.label} in Japan
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {NOTE_CATEGORIES.map((n) => (
            <span key={n.key} className="inline-flex items-center gap-1.5 text-[14px] text-ink">
              <IsoGlyph name={n.glyph} size={20} theme={theme} />
              {n.label}
            </span>
          ))}
        </div>
      </section>
      <section>
        <h2 className="type-overline mb-1 text-ink-3">Country chips</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-2">Popular from MY</span>
          {POPULAR_FROM_MY.map((c) => (
            <CountryChip key={c} code={c} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[15px] text-ink">
          <CountryChip code="MY" size="sm" tone="muted" /> → <CountryChip code="jp" size="sm" tone="muted" />
          <span className="font-mono text-[13px] text-ink-2">12–20 NOV · 9D8N</span>
        </div>
        <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-fund px-3 py-2">
          <CountryChip code="MY" tone="onFund" />
          <span className="text-[13px] text-on-fund">HOME · MY · RM</span>
        </div>
        <p className="mt-2 font-mono text-[11px] text-ink-3">{countries.length} destinations</p>
      </section>
    </div>
  );
}

function Panel({ theme }: { theme: ThemeName }) {
  return (
    <div className={`${theme} min-w-0 flex-1 bg-background p-4 text-foreground`}>
      <p className="type-overline mb-3 text-ink-3">{theme}</p>
      {view === 'context' ? (
        <Context theme={theme} />
      ) : view === 'big' ? (
        <Big theme={theme} />
      ) : view === 'strip' ? (
        <Strip theme={theme} />
      ) : (
        <Grid theme={theme} />
      )}
    </div>
  );
}

function Harness() {
  const themes: ThemeName[] = only ? [only] : ['light', 'dark'];
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {themes.map((t) => (
        <Panel key={t} theme={t} />
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <AppThemeProvider>
    <Harness />
  </AppThemeProvider>,
);

// Destination quick info (§9.6 Notes): mono key/value rows on sunken. Editors tap a value to change it in
// place; Enter or leaving the field saves (POST upserts by key), Escape puts it back, clearing it removes it.
// Text on sunken stays ink-2 or darker.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Pencil } from 'lucide-react';
import type { Note } from '@/types';
import type { QuickInfoField } from '@/data/notes';
import { getErrorMessage } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { quickInfoRows } from './quickInfo';

export interface QuickInfoPanelProps {
  quickInfo: Readonly<Record<string, Note>>;
  canEdit: boolean;
  onSave: (infoKey: string, content: string) => Promise<unknown>;
  onClear: (note: Note) => Promise<unknown>;
}

type Status = 'idle' | 'saving' | 'saved' | 'error';

function Row({ field, note, canEdit, onSave, onClear }: { field: QuickInfoField; note?: Note } & Omit<QuickInfoPanelProps, 'quickInfo'>) {
  const value = note?.content ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const editBtn = useRef<HTMLButtonElement>(null);
  const savedTimer = useRef<number>();
  // Enter/Escape already handled the edit; the blur that follows the input unmounting must not save again.
  const skipBlur = useRef(false);
  const uid = useId();

  useEffect(() => () => window.clearTimeout(savedTimer.current), []);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  const start = () => {
    skipBlur.current = false;
    setDraft(value);
    setError(null);
    setEditing(true);
  };
  const finish = (refocus: boolean) => {
    setEditing(false);
    if (refocus) window.requestAnimationFrame(() => editBtn.current?.focus());
  };

  const commit = async (refocus: boolean) => {
    if (status === 'saving') return;
    const next = draft.trim();
    if (next === value.trim()) return finish(refocus);
    setStatus('saving');
    setError(null);
    try {
      if (!next) {
        if (note) await onClear(note);
      } else {
        await onSave(field.key, next);
      }
      setStatus('saved');
      window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setStatus('idle'), 2500);
      finish(refocus);
    } catch (e) {
      skipBlur.current = false;
      setStatus('error');
      setError(getErrorMessage(e, "Couldn't save that. Try again."));
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      skipBlur.current = true;
      void commit(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // don't close a surrounding sheet
      skipBlur.current = true;
      setStatus('idle');
      setError(null);
      finish(true);
    }
  };

  const inputId = `${uid}-qi-${field.key}`;
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-x-3 border-b border-rule py-1 last:border-b-0 sm:grid-cols-[112px_minmax(0,1fr)]">
      <dt className="flex min-h-11 items-center">
        <label htmlFor={editing ? inputId : undefined} className="type-overline text-ink-2">
          {field.label}
        </label>
      </dt>
      <dd className="min-w-0">
        {editing ? (
          <div className="py-0.5">
            <input
              ref={input}
              id={inputId}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              onBlur={() => {
                if (skipBlur.current) {
                  skipBlur.current = false;
                  return;
                }
                void commit(false);
              }}
              placeholder={field.hint || undefined}
              maxLength={500}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${inputId}-err` : undefined}
              className="h-10 w-full rounded-t-sm border-0 border-b-[1.5px] border-fund bg-leaf px-2 font-mono text-[15px] text-ink outline-none placeholder:text-ink-2"
            />
            {error ? (
              <p id={`${inputId}-err`} role="alert" className="type-body-s mt-1 text-stamp">
                {error}
              </p>
            ) : (
              <p className="mt-1 font-mono text-[11px] text-ink-2">
                {status === 'saving' ? 'Saving…' : 'Enter to save · Esc to cancel'}
              </p>
            )}
          </div>
        ) : canEdit ? (
          <button
            ref={editBtn}
            type="button"
            onClick={start}
            aria-label={`${field.label}: ${value || 'not filled in'}. Edit`}
            className="group flex min-h-11 w-full items-start gap-2 rounded-sm px-1 py-2.5 text-left hover:bg-leaf"
          >
            <span
              className={cn(
                'min-w-0 flex-1 font-mono text-[14px] leading-5',
                value ? 'text-ink' : 'italic text-ink-2'
              )}
            >
              {value || field.hint || 'Add'}
            </span>
            <span aria-hidden="true" className="flex shrink-0 items-center gap-1 pt-0.5 text-ink-2">
              {status === 'saved' ? <span className="type-overline text-fund">Saved</span> : null}
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
            </span>
          </button>
        ) : (
          <p className={cn('min-h-11 px-1 py-2.5 font-mono text-[14px] leading-5', value ? 'text-ink' : 'text-ink-2')}>
            {value || 'Not filled in'}
          </p>
        )}
      </dd>
    </div>
  );
}

export function QuickInfoPanel({ quickInfo, canEdit, onSave, onClear }: QuickInfoPanelProps) {
  const rows = quickInfoRows(quickInfo);
  return (
    <dl className="rounded-lg bg-sunken px-3 py-1">
      {rows.map((f) => (
        <Row key={f.key} field={f} note={quickInfo[f.key]} canEdit={canEdit} onSave={onSave} onClear={onClear} />
      ))}
    </dl>
  );
}

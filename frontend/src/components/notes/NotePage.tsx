// One note on lined paper (§9.6 Notes): 28px rules behind Schibsted 16/28. Editors write straight onto the
// page; it saves when focus leaves the note (and when the category changes), with a mono status in the
// corner. A new note is a local draft until it has some text (the API needs content).
import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent } from 'react';
import { X } from 'lucide-react';
import type { Note, NoteCategory, NoteInput } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { IsoGlyph } from '@/components/glyphs';
import { NOTE_CATEGORIES, noteCategoryMeta } from '@/data/notes';
import { getErrorMessage } from '@/lib/axios';
import { cn } from '@/lib/utils';

export interface NotePageProps {
  /** Saved note; absent for a draft. */
  note?: Note;
  /** Category of a new draft. */
  draftCategory?: NoteCategory;
  canEdit: boolean;
  autoFocus?: boolean;
  onCreate: (data: NoteInput) => Promise<Note>;
  onUpdate: (noteId: number, data: NoteInput) => Promise<Note>;
  /** Saved notes: undoable remove. Drafts: discard. */
  onDelete: () => void;
}

type Status = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'empty';

const LINE = 28;
const PAPER = { ['--ledger-row' as string]: `${LINE}px` };

function useAutoHeight(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    // whole lines only, so the last rule always sits under the last line of text (min 3 lines)
    const lines = Math.max(3, Math.ceil(el.scrollHeight / LINE));
    el.style.height = `${lines * LINE}px`;
  }, [value]);
  return ref;
}

const STATUS_TEXT: Record<Status, string> = {
  idle: '',
  dirty: 'Unsaved',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved',
  empty: 'Empty notes aren’t kept',
};

export function NotePage({ note, draftCategory = 'local_tips', canEdit, autoFocus, onCreate, onUpdate, onDelete }: NotePageProps) {
  const uid = useId();
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [category, setCategory] = useState<NoteCategory>(
    (note ? noteCategoryMeta(note.infoKey).key : draftCategory) as NoteCategory
  );
  const [savedId, setSavedId] = useState<number | null>(note?.id ?? null);
  // The id as of the last finished save: a second save queued behind a create must update, not create again.
  const idRef = useRef<number | null>(note?.id ?? null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const body = useAutoHeight(content);
  const saving = useRef<Promise<unknown> | null>(null);
  const meta = noteCategoryMeta(category);

  // Someone else's edit (or a refetch) shows up unless you're mid-edit here.
  useEffect(() => {
    if (!note || status === 'dirty' || status === 'saving' || status === 'error') return;
    setTitle(note.title ?? '');
    setContent(note.content);
    setCategory(noteCategoryMeta(note.infoKey).key as NoteCategory);
    setSavedId(note.id);
    idRef.current = note.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the server copy changes
  }, [note?.id, note?.updatedAt]);

  useEffect(() => {
    if (!autoFocus) return;
    const id = window.requestAnimationFrame(() => body.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [autoFocus, body]);

  const save = async (next: { title: string; content: string; category: NoteCategory }) => {
    if (saving.current) await saving.current.catch(() => undefined);
    const text = next.content.trim();
    if (!text) {
      setStatus('empty');
      return;
    }
    const data: NoteInput = {
      noteType: 'custom',
      infoKey: next.category,
      title: next.title.trim() || undefined,
      content: next.content.replace(/\s+$/, ''),
    };
    setStatus('saving');
    setError(null);
    const id = idRef.current;
    const p = id ? onUpdate(id, data) : onCreate(data);
    saving.current = p;
    try {
      const saved = await p;
      idRef.current = saved.id;
      setSavedId(saved.id);
      setStatus('saved');
    } catch (e) {
      setStatus('error');
      setError(getErrorMessage(e, "Couldn't save this note. Try again."));
    } finally {
      saving.current = null;
    }
  };

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    // moving between the title and the page doesn't count as leaving the note
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    if (status === 'dirty' || status === 'error') void save({ title, content, category });
  };

  const changeCategory = (v: string) => {
    const c = v as NoteCategory;
    setCategory(c);
    if (idRef.current || content.trim()) void save({ title, content, category: c });
  };

  const edit = (fn: () => void) => {
    fn();
    setStatus('dirty');
  };

  const heading = title.trim() || meta.label;

  if (!canEdit) {
    return (
      <article className="rounded-lg border border-rule bg-card px-4 pb-4 pt-3 md:px-5">
        <p className="type-overline flex items-center gap-2 text-ink-2">
          <IsoGlyph name={meta.glyph} size={20} />
          {meta.label}
        </p>
        <h3 className="type-title mt-2 text-ink">{heading}</h3>
        <p
          className="ledger-rule mt-1 whitespace-pre-wrap break-words font-sans text-base text-ink"
          style={{ ...PAPER, lineHeight: `${LINE}px` }}
        >
          {note?.content}
        </p>
      </article>
    );
  }

  const statusText = STATUS_TEXT[status];
  return (
    <article
      className="rounded-lg border border-rule bg-card px-4 pb-4 pt-2 focus-within:border-ink md:px-5"
      onBlur={onBlur}
      aria-label={savedId ? `Note: ${heading}` : 'New note'}
    >
      <div className="flex items-center gap-2">
        <Select value={category} onValueChange={changeCategory}>
          <SelectTrigger
            aria-label={`Category: ${meta.label}`}
            className="h-11 w-auto gap-2 border-0 bg-transparent px-1 hover:bg-sunken"
          >
            <span>
              <span className="type-overline flex items-center gap-2 text-ink-2">
                <IsoGlyph name={meta.glyph} size={20} />
                {meta.label}
              </span>
            </span>
          </SelectTrigger>
          <SelectContent>
            {NOTE_CATEGORIES.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                <span className="flex items-center gap-2">
                  <IsoGlyph name={c.glyph} size={20} />
                  {c.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span
          role="status"
          aria-live="polite"
          className={cn(
            'type-overline ml-auto truncate',
            status === 'saved' ? 'text-fund' : status === 'error' ? 'text-stamp' : 'text-ink-2'
          )}
        >
          {statusText}
        </span>
        {status === 'error' ? (
          <button
            type="button"
            onClick={() => void save({ title, content, category })}
            className="type-label h-11 px-2 text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
          >
            Retry
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          aria-label={savedId ? `Delete note ${heading}` : 'Discard this note'}
          className="pressable -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-accent hover:text-stamp"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <label htmlFor={`${uid}-title`} className="sr-only">
        Note title
      </label>
      <input
        id={`${uid}-title`}
        value={title}
        onChange={(e) => edit(() => setTitle(e.target.value))}
        placeholder="Title (optional)"
        maxLength={255}
        className="type-title h-10 w-full border-0 bg-transparent px-0 text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none"
      />
      <label htmlFor={`${uid}-body`} className="sr-only">
        Note
      </label>
      <textarea
        ref={body}
        id={`${uid}-body`}
        value={content}
        onChange={(e) => edit(() => setContent(e.target.value))}
        placeholder={meta.hint}
        rows={3}
        maxLength={20000}
        aria-invalid={status === 'error' ? true : undefined}
        aria-describedby={error ? `${uid}-err` : undefined}
        className="ledger-rule block w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-sans text-base text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none"
        style={{ ...PAPER, lineHeight: `${LINE}px` }}
      />
      {error ? (
        <p id={`${uid}-err`} className="type-body-s mt-2 text-stamp">
          {error}
        </p>
      ) : null}
    </article>
  );
}

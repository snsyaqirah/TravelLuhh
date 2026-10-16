// Notes tab (§9.6): destination quick info and the trip's notes, saved to the trip (destination_notes) so the
// whole geng sees them. Desktop: two columns. Phones: stacked, quick info folds away. Notes the old tab kept
// on this device are moved to the trip once, on first open by someone who can write.
import { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, Plus } from 'lucide-react';
import type { Note, NoteCategory, NoteInput, Trip } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IsoGlyph } from '@/components/glyphs';
import { NOTE_CATEGORIES, noteCategoryMeta } from '@/data/notes';
import { useNotes } from '@/hooks/useNotes';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import { queryKeys } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { DESKTOP_QUERY, useMediaQuery } from '@/components/shell/useMediaQuery';
import { NotePage } from '@/components/notes/NotePage';
import { QuickInfoPanel } from '@/components/notes/QuickInfoPanel';
import { quickInfoSummary } from '@/components/notes/quickInfo';
import { useLegacyNotesMigration } from '@/components/notes/useLegacyNotesMigration';

export interface NotesTabProps {
  trip: Trip;
  canEdit: boolean;
}

interface Draft {
  key: string;
  category: NoteCategory;
}

function NotesSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Skeleton className="h-64" style={{ ['--ledger-row' as string]: '48px' }} />
      <div className="space-y-4">
        <Skeleton className="h-40" style={{ ['--ledger-row' as string]: '28px' }} />
        <Skeleton className="h-28" style={{ ['--ledger-row' as string]: '28px' }} />
      </div>
    </div>
  );
}

export function NotesTab({ trip, canEdit }: NotesTabProps) {
  const { pathname } = useLocation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const { notes, quickInfo, customNotes, isLoading, error, refetch, createNote, updateNote, deleteNote, saveQuickInfo } =
    useNotes(trip.id);

  useLegacyNotesMigration(trip.id, { ready: !isLoading && !error, canEdit, notes, createNote });

  const undoable = useUndoableDelete<Note>({
    queryKey: queryKeys.notes(trip.id),
    remove: (n) => deleteNote(n.id),
    message: (n) => `Removed "${n.title?.trim() || noteCategoryMeta(n.infoKey).label}".`,
    flushKey: pathname,
  });
  const { pendingIds } = undoable;
  const visibleNotes = useMemo(
    () => (pendingIds.size ? customNotes.filter((n) => !pendingIds.has(n.id)) : customNotes),
    [customNotes, pendingIds]
  );

  // Drafts live here until they have text. Once saved, the note keeps its draft's React key so the page
  // (and the cursor in it) doesn't remount.
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const adopted = useRef(new Map<number, string>());
  const draftSeq = useRef(0);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  // Picking a category opens a draft and puts the cursor in it; the menu must not pull focus back to its trigger.
  const keepFocus = useRef(false);
  const addDraft = (category: NoteCategory) => {
    keepFocus.current = true;
    const key = `draft-${++draftSeq.current}`;
    setDrafts((d) => [...d, { key, category }]);
    setFocusKey(key);
  };
  const createFromDraft = useCallback(
    (key: string) => (data: NoteInput) =>
      createNote(data).then((n) => {
        adopted.current.set(n.id, key);
        setDrafts((d) => d.filter((x) => x.key !== key));
        return n;
      }),
    [createNote]
  );

  const [infoOpen, setInfoOpen] = useState(false);

  if (isLoading) return <NotesSkeleton />;

  if (error && !notes.length) {
    return (
      <div role="alert" className="border-l-[3px] border-stamp bg-stamp-tint px-4 py-3">
        <p className="type-body text-ink">{error}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const panel = (
    <QuickInfoPanel
      quickInfo={quickInfo}
      canEdit={canEdit}
      onSave={(key, content) => saveQuickInfo(key, content)}
      onClear={(n) => deleteNote(n.id)}
    />
  );

  const newNoteMenu = canEdit ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          <Plus aria-hidden="true" />
          New note
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[13rem]"
        onCloseAutoFocus={(e) => {
          if (keepFocus.current) e.preventDefault();
          keepFocus.current = false;
        }}
      >
        <DropdownMenuLabel className="type-overline text-ink-2">What about?</DropdownMenuLabel>
        {NOTE_CATEGORIES.map((c) => (
          <DropdownMenuItem key={c.key} onSelect={() => addDraft(c.key)} className="gap-2">
            <IsoGlyph name={c.glyph} size={20} />
            {c.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const empty = !visibleNotes.length && !drafts.length;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
      <section aria-labelledby="notes-quick-info" className="min-w-0">
        {desktop ? (
          <>
            <h2 id="notes-quick-info" className="type-title mb-3 flex min-h-11 items-center text-ink">
              Quick info
            </h2>
            {panel}
          </>
        ) : (
          <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
            <h2 id="notes-quick-info">
              <CollapsibleTrigger className="flex min-h-12 w-full items-center gap-3 border-y border-rule text-left">
                <span className="type-title flex-1 text-ink">Quick info</span>
                <span className="font-mono text-[12px] text-ink-2">{quickInfoSummary(quickInfo)}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn('h-5 w-5 text-ink-2 transition-transform duration-ui', infoOpen && 'rotate-180')}
                  strokeWidth={1.75}
                />
              </CollapsibleTrigger>
            </h2>
            <CollapsibleContent className="pt-3">{panel}</CollapsibleContent>
          </Collapsible>
        )}
      </section>

      <section aria-labelledby="notes-heading" className="min-w-0">
        <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
          <h2 id="notes-heading" className="type-title text-ink">
            Notes
          </h2>
          {!empty ? newNoteMenu : null}
        </div>

        {empty ? (
          <div
            className="ledger-rule rounded-lg border border-dashed border-rule-strong px-4 py-5"
            style={{ ['--ledger-row' as string]: '28px' }}
          >
            <p className="type-body text-ink">
              {canEdit
                ? 'Nothing written yet. Halal spots, the train pass, the hotel phone number: put it here so everyone has it.'
                : 'Nothing written yet.'}
            </p>
            {newNoteMenu ? <div className="mt-4">{newNoteMenu}</div> : null}
          </div>
        ) : (
          <div className="space-y-4">
            {[
              ...visibleNotes.map((n) => (
                <NotePage
                  key={adopted.current.get(n.id) ?? `note-${n.id}`}
                  note={n}
                  canEdit={canEdit}
                  onCreate={createNote}
                  onUpdate={updateNote}
                  onDelete={() => undoable.remove(n)}
                />
              )),
              // one flat keyed list, so a draft that just saved keeps its instance when it moves into the notes
              ...drafts
                .filter((d) => ![...adopted.current.values()].includes(d.key))
                .map((d) => (
                <NotePage
                  key={d.key}
                  draftCategory={d.category}
                  canEdit={canEdit}
                  autoFocus={focusKey === d.key}
                  onCreate={createFromDraft(d.key)}
                  onUpdate={updateNote}
                  onDelete={() => setDrafts((all) => all.filter((x) => x.key !== d.key))}
                />
              )),
            ]}
          </div>
        )}
      </section>
    </div>
  );
}

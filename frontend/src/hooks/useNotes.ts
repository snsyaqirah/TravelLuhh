import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Note, NoteInput } from '@/types';
import { noteService } from '@/services/noteService';
import { AppError, getErrorMessage, toAppError } from '@/lib/axios';
import { queryKeys } from '@/lib/queryClient';
import { toId } from '@/lib/ids';

const EMPTY: Note[] = [];

export function useNotes(tripId: number | string | undefined) {
  const id = toId(tripId);
  const qc = useQueryClient();
  const key = queryKeys.notes(id ?? 0);

  const query = useQuery({
    queryKey: key,
    queryFn: () => noteService.list(id as number),
    enabled: id !== undefined,
  });

  const need = () => {
    if (!id) throw new AppError('This trip could not be found.');
    return id;
  };
  const upsertInCache = (note: Note) =>
    qc.setQueryData<Note[]>(key, (old) =>
      old?.some((n) => n.id === note.id) ? old.map((n) => (n.id === note.id ? note : n)) : [...(old ?? []), note]
    );
  const touchActivity = () => {
    if (id) void qc.invalidateQueries({ queryKey: queryKeys.activity(id) });
  };

  const create = useMutation({
    mutationFn: (data: NoteInput) => noteService.create(need(), data),
    onSuccess: (note) => {
      upsertInCache(note);
      touchActivity();
    },
  });
  const update = useMutation({
    mutationFn: ({ noteId, data }: { noteId: number; data: NoteInput }) => noteService.update(need(), noteId, data),
    onSuccess: (note) => {
      upsertInCache(note);
      touchActivity();
    },
  });
  const remove = useMutation({
    mutationFn: async (noteId: number) => {
      await noteService.remove(need(), noteId);
      return noteId;
    },
    onSuccess: (noteId) => {
      qc.setQueryData<Note[]>(key, (old) => old?.filter((n) => n.id !== noteId));
      touchActivity();
    },
  });

  const { mutateAsync: createAsync } = create;
  const { mutateAsync: updateAsync } = update;
  const { mutateAsync: removeAsync } = remove;
  const fail = (e: unknown) => Promise.reject(toAppError(e));

  const notes = query.data ?? EMPTY;
  const { quickInfo, customNotes } = useMemo(() => {
    const qi: Record<string, Note> = {};
    const custom: Note[] = [];
    for (const n of notes) {
      if (n.noteType === 'quick_info' && n.infoKey) qi[n.infoKey] = n;
      else custom.push(n);
    }
    return { quickInfo: qi, customNotes: custom };
  }, [notes]);

  return {
    notes,
    /** infoKey → note, for the destination quick-info rows. */
    quickInfo,
    customNotes,
    isLoading: query.isLoading,
    error: query.error ? getErrorMessage(query.error) : null,
    refetch: query.refetch,
    createNote: useCallback((data: NoteInput) => createAsync(data).catch(fail), [createAsync]),
    updateNote: useCallback(
      (noteId: number, data: NoteInput) => updateAsync({ noteId, data }).catch(fail),
      [updateAsync]
    ),
    deleteNote: useCallback(
      (noteId: number) => removeAsync(noteId).then(() => undefined, fail),
      [removeAsync]
    ),
    /** Quick info is keyed: posting an existing infoKey updates it server-side. */
    saveQuickInfo: useCallback(
      (infoKey: string, content: string, title?: string) =>
        createAsync({ noteType: 'quick_info', infoKey, title, content }).catch(fail),
      [createAsync]
    ),
    isSaving: create.isPending || update.isPending,
  };
}

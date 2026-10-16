import { api } from '@/lib/axios';
import type { Note, NoteInput } from '@/types';
import { apiPaths } from '@/services/apiPaths';

export const noteService = {
  async list(tripId: number): Promise<Note[]> {
    const res = await api.get<Note[]>(`/trips/${tripId}/notes`);
    return res.data ?? [];
  },

  /** For quick_info, posting an existing infoKey updates it. */
  async create(tripId: number, data: NoteInput): Promise<Note> {
    const res = await api.post<Note>(`/trips/${tripId}/notes`, data);
    return res.data;
  },

  async update(tripId: number, noteId: number, data: NoteInput): Promise<Note> {
    const res = await api.put<Note>(`/trips/${tripId}/notes/${noteId}`, data);
    return res.data;
  },

  async remove(tripId: number, noteId: number): Promise<void> {
    await api.delete(apiPaths.note(tripId, noteId));
  },
};

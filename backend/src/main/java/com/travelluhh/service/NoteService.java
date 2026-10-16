package com.travelluhh.service;

import com.travelluhh.dto.note.NoteRequest;
import com.travelluhh.dto.note.NoteResponse;
import com.travelluhh.entity.DestinationNote;
import com.travelluhh.entity.DestinationNote.NoteType;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.exception.ConflictException;
import com.travelluhh.exception.NotFoundException;
import com.travelluhh.repository.DestinationNoteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Trip notes in destination_notes (API contract, Notes). Members read; owner and editors write.
 * - custom: infoKey is the category, defaulting to "custom".
 * - quick_info: infoKey is the field key and there is one row per key; POST with a key that
 *   already exists updates that row.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class NoteService {

    public static final Set<String> CATEGORIES = Set.of("local_tips", "food", "transport", "safety", "emergency", "custom");

    static final String NOTE_NOT_FOUND = "Note not found";
    private static final Pattern INFO_KEY = Pattern.compile("[a-z0-9_]{1,50}");

    private final DestinationNoteRepository noteRepository;
    private final TripAccessService tripAccess;
    private final ActivityService activityService;

    /** created is false when a quick_info POST updated an existing row. */
    public record Saved(NoteResponse note, boolean created) {}

    /** A validated request. */
    private record Fields(NoteType type, String infoKey, String title, String content) {}

    @Transactional(readOnly = true)
    public List<NoteResponse> getNotes(Long tripId, String userEmail) {
        tripAccess.requireMember(tripId, userEmail);
        return noteRepository.findByTripIdOrderByCreatedAtAscIdAsc(tripId).stream()
                .map(NoteResponse::from)
                .toList();
    }

    public Saved createNote(Long tripId, NoteRequest request, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.editor);
        Fields fields = parse(request, NoteType.custom);

        if (fields.type() == NoteType.quick_info) {
            Optional<DestinationNote> existing =
                    noteRepository.findFirstByTripIdAndNoteTypeAndInfoKey(tripId, NoteType.quick_info, fields.infoKey());
            if (existing.isPresent()) {
                DestinationNote note = apply(existing.get(), fields);
                note = noteRepository.saveAndFlush(note);
                logSaved(access.user(), note, false);
                return new Saved(NoteResponse.from(note), false);
            }
        }

        DestinationNote note = apply(DestinationNote.builder().tripId(tripId).build(), fields);
        note = noteRepository.saveAndFlush(note);
        logSaved(access.user(), note, true);
        return new Saved(NoteResponse.from(note), true);
    }

    /** Replaces the note's fields. noteType may be omitted to keep the current type. */
    public NoteResponse updateNote(Long tripId, Long noteId, NoteRequest request, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.editor);
        DestinationNote note = findNote(tripId, noteId);
        Fields fields = parse(request, note.getNoteType());

        if (fields.type() == NoteType.quick_info) {
            noteRepository.findFirstByTripIdAndNoteTypeAndInfoKey(tripId, NoteType.quick_info, fields.infoKey())
                    .filter(other -> !Objects.equals(other.getId(), note.getId()))
                    .ifPresent(other -> {
                        throw new ConflictException("There's already quick info for " + label(fields.infoKey())
                                + ". Edit that one instead.");
                    });
        }

        DestinationNote saved = noteRepository.saveAndFlush(apply(note, fields));
        logSaved(access.user(), saved, false);
        return NoteResponse.from(saved);
    }

    public void deleteNote(Long tripId, Long noteId, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.editor);
        DestinationNote note = findNote(tripId, noteId);
        noteRepository.delete(note);

        String actor = TripAccessService.actorName(access.user());
        String text = note.getNoteType() == NoteType.quick_info
                ? actor + " cleared the " + label(note.getInfoKey()) + " quick info"
                : actor + " deleted the note " + describe(note);
        logActivity(tripId, access.user(), "note_deleted", text);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private DestinationNote findNote(Long tripId, Long noteId) {
        if (noteId == null) {
            throw new NotFoundException(NOTE_NOT_FOUND);
        }
        return noteRepository.findByIdAndTripId(noteId, tripId)
                .orElseThrow(() -> new NotFoundException(NOTE_NOT_FOUND));
    }

    static Fields parse(NoteRequest request, NoteType defaultType) {
        NoteType type = parseType(request.getNoteType(), defaultType);
        String key = request.getInfoKey() == null || request.getInfoKey().isBlank()
                ? null
                : request.getInfoKey().trim().toLowerCase(Locale.ROOT);

        if (type == NoteType.quick_info) {
            if (key == null) {
                throw new BadRequestException("Quick info needs an infoKey, like language or plug");
            }
            if (!INFO_KEY.matcher(key).matches()) {
                throw new BadRequestException("infoKey can only use letters, numbers and underscores");
            }
        } else {
            if (key == null) {
                key = "custom";
            } else if (!CATEGORIES.contains(key)) {
                throw new BadRequestException("Category must be local_tips, food, transport, safety, emergency or custom");
            }
        }

        String content = request.getContent();
        if (content == null || content.isBlank()) {
            throw new BadRequestException("Write something first");
        }
        String title = request.getTitle() == null || request.getTitle().isBlank() ? null : request.getTitle().trim();
        return new Fields(type, key, title, content.strip());
    }

    private static NoteType parseType(String raw, NoteType fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback != null ? fallback : NoteType.custom;
        }
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "quick_info" -> NoteType.quick_info;
            case "custom" -> NoteType.custom;
            default -> throw new BadRequestException("noteType must be quick_info or custom");
        };
    }

    private static DestinationNote apply(DestinationNote note, Fields fields) {
        note.setNoteType(fields.type());
        note.setInfoKey(fields.infoKey());
        note.setTitle(fields.title());
        note.setContent(fields.content());
        return note;
    }

    private void logSaved(User actor, DestinationNote note, boolean created) {
        String name = TripAccessService.actorName(actor);
        String text;
        if (note.getNoteType() == NoteType.quick_info) {
            text = name + (created ? " added the " : " updated the ") + label(note.getInfoKey()) + " quick info";
        } else {
            text = name + (created ? " added the note " : " edited the note ") + describe(note);
        }
        logActivity(note.getTripId(), actor, "note_saved", text);
    }

    /** "emergency_number" → "emergency number". */
    private static String label(String key) {
        return key == null ? "trip" : key.replace('_', ' ');
    }

    /** The title in quotes, or the start of the text when there is no title. */
    private static String describe(DestinationNote note) {
        String source = note.getTitle() != null && !note.getTitle().isBlank() ? note.getTitle() : note.getContent();
        if (source == null || source.isBlank()) {
            return "without a title";
        }
        String oneLine = source.strip().replaceAll("\\s+", " ");
        return "\"" + (oneLine.length() > 60 ? oneLine.substring(0, 57) + "..." : oneLine) + "\"";
    }

    private void logActivity(Long tripId, User actor, String type, String text) {
        try {
            activityService.log(tripId, actor.getId(), TripAccessService.actorName(actor), type, text);
        } catch (RuntimeException e) {
            log.warn("Could not log {} for trip {}: {}", type, tripId, e.getMessage());
        }
    }
}

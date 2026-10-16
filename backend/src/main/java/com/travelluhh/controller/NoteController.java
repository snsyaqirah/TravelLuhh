package com.travelluhh.controller;

import com.travelluhh.dto.note.NoteRequest;
import com.travelluhh.dto.note.NoteResponse;
import com.travelluhh.service.NoteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Trip notes and destination quick info. GET: any member. Writes: owner or editor. */
@RestController
@RequestMapping("/api/trips/{tripId}/notes")
@RequiredArgsConstructor
public class NoteController {

    private final NoteService noteService;

    @GetMapping
    public ResponseEntity<List<NoteResponse>> list(@PathVariable Long tripId, Authentication authentication) {
        return ResponseEntity.ok(noteService.getNotes(tripId, authentication.getName()));
    }

    /** 201 for a new note; 200 when a quick_info POST updated the existing row for that infoKey. */
    @PostMapping
    public ResponseEntity<NoteResponse> create(
            @PathVariable Long tripId,
            @Valid @RequestBody NoteRequest request,
            Authentication authentication
    ) {
        NoteService.Saved saved = noteService.createNote(tripId, request, authentication.getName());
        return ResponseEntity.status(saved.created() ? HttpStatus.CREATED : HttpStatus.OK).body(saved.note());
    }

    @PutMapping("/{noteId}")
    public ResponseEntity<NoteResponse> update(
            @PathVariable Long tripId,
            @PathVariable Long noteId,
            @Valid @RequestBody NoteRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(noteService.updateNote(tripId, noteId, request, authentication.getName()));
    }

    @DeleteMapping("/{noteId}")
    public ResponseEntity<Void> delete(
            @PathVariable Long tripId,
            @PathVariable Long noteId,
            Authentication authentication
    ) {
        noteService.deleteNote(tripId, noteId, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}

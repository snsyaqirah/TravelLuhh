package com.travelluhh.repository;

import com.travelluhh.entity.DestinationNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DestinationNoteRepository extends JpaRepository<DestinationNote, Long> {

    List<DestinationNote> findByTripIdOrderByCreatedAtAscIdAsc(Long tripId);

    List<DestinationNote> findByTripIdAndNoteTypeOrderByCreatedAtAscIdAsc(Long tripId, DestinationNote.NoteType noteType);

    Optional<DestinationNote> findByIdAndTripId(Long id, Long tripId);

    /** Quick-info upsert lookup: one row per (trip, infoKey). */
    Optional<DestinationNote> findFirstByTripIdAndNoteTypeAndInfoKey(Long tripId, DestinationNote.NoteType noteType, String infoKey);

    Optional<DestinationNote> findFirstByTripIdAndInfoKey(Long tripId, String infoKey);
}

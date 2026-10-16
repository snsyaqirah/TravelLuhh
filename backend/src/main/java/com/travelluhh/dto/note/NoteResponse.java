package com.travelluhh.dto.note;

import com.travelluhh.entity.DestinationNote;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NoteResponse {
    private Long id;
    private Long tripId;
    /** quick_info | custom */
    private String noteType;
    private String infoKey;
    private String title;
    private String content;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static NoteResponse from(DestinationNote note) {
        return NoteResponse.builder()
                .id(note.getId())
                .tripId(note.getTripId())
                .noteType(note.getNoteType() != null ? note.getNoteType().name() : DestinationNote.NoteType.custom.name())
                .infoKey(note.getInfoKey())
                .title(note.getTitle())
                .content(note.getContent())
                .createdAt(note.getCreatedAt())
                .updatedAt(note.getUpdatedAt())
                .build();
    }
}

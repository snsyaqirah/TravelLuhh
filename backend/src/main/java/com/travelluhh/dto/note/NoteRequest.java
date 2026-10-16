package com.travelluhh.dto.note;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * POST and PUT /api/trips/{tripId}/notes.
 * - noteType "custom" (default): infoKey is the category (local_tips | food | transport | safety | emergency | custom).
 * - noteType "quick_info": infoKey is the field key (language, plug, tipping ...); POST upserts by infoKey.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NoteRequest {

    private String noteType;

    @Size(max = 50, message = "Key can't be longer than 50 characters")
    private String infoKey;

    @Size(max = 255, message = "Title can't be longer than 255 characters")
    private String title;

    @NotBlank(message = "Write something first")
    @Size(max = 20000, message = "Notes can't be longer than 20,000 characters")
    private String content;
}

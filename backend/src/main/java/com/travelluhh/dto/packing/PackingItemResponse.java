package com.travelluhh.dto.packing;

import com.travelluhh.entity.PackingItem;
import lombok.*;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PackingItemResponse {
    private Long id;
    private Long tripId;
    private String label;
    private String category;
    private Boolean isChecked;
    private Long addedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static PackingItemResponse of(PackingItem item) {
        return PackingItemResponse.builder()
                .id(item.getId())
                .tripId(item.getTripId())
                .label(item.getLabel())
                .category(item.getCategory())
                .isChecked(Boolean.TRUE.equals(item.getIsChecked()))
                .addedBy(item.getAddedBy())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .build();
    }
}

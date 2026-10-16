package com.travelluhh.dto.itinerary;

import com.travelluhh.entity.ItineraryItem;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ItineraryItemResponse {
    private Long id;
    private Long tripId;
    private LocalDate itemDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private String title;
    private String description;
    private String location;
    private String category;
    private Integer sortOrder;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ItineraryItemResponse of(ItineraryItem item) {
        return ItineraryItemResponse.builder()
                .id(item.getId())
                .tripId(item.getTripId())
                .itemDate(item.getItemDate())
                .startTime(item.getStartTime())
                .endTime(item.getEndTime())
                .title(item.getTitle())
                .description(item.getDescription())
                .location(item.getLocation())
                .category(item.getCategory())
                .sortOrder(item.getSortOrder())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .build();
    }
}

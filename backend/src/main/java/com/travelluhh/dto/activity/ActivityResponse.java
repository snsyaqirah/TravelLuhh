package com.travelluhh.dto.activity;

import com.travelluhh.entity.TripActivity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActivityResponse {
    private Long id;
    private Long tripId;
    /** Null once the actor's account is deleted. */
    private Long userId;
    private String actorName;
    private String actionType;
    private String description;
    private LocalDateTime createdAt;

    public static ActivityResponse from(TripActivity a) {
        return ActivityResponse.builder()
                .id(a.getId())
                .tripId(a.getTripId())
                .userId(a.getUserId())
                .actorName(a.getActorName())
                .actionType(a.getActionType())
                .description(a.getDescription())
                .createdAt(a.getCreatedAt())
                .build();
    }
}

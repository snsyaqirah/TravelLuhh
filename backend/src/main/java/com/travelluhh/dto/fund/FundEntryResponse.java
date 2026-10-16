package com.travelluhh.dto.fund;

import com.travelluhh.entity.TripFundEntry;
import com.travelluhh.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** amount in the trip currency; negative is a withdrawal. userId/userName are null once the user is deleted. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FundEntryResponse {
    private Long id;
    private Long tripId;
    private Long userId;
    private String userName;
    private BigDecimal amount;
    private String note;
    private LocalDate entryDate;
    private LocalDateTime createdAt;

    /** user is passed separately because the entity's association is read-only and may not be loaded after a save. */
    public static FundEntryResponse from(TripFundEntry entry, User user) {
        return FundEntryResponse.builder()
                .id(entry.getId())
                .tripId(entry.getTripId())
                .userId(entry.getUserId())
                .userName(user != null ? user.getName() : null)
                .amount(entry.getAmount())
                .note(entry.getNote())
                .entryDate(entry.getEntryDate())
                .createdAt(entry.getCreatedAt())
                .build();
    }
}

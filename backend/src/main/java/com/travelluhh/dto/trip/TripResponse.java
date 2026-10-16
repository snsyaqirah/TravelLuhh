package com.travelluhh.dto.trip;

import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripMember;
import com.travelluhh.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** All money is in the trip currency. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TripResponse {

    private Long id;
    private Long ownerId;
    private OwnerDto owner;
    private String name;
    private String destinationCountry;
    private LocalDate startDate;
    private LocalDate endDate;
    private String description;
    private String image;
    private BigDecimal budget;
    private String currency;
    private String budgetType;
    private String season;
    private String notes;
    private Trip.TripStatus status;
    private Boolean isArchived;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<MemberDto> members;
    private Integer memberCount;
    /** trips.spent_amount (trigger-maintained). Same value as spentAmount; kept for older clients. */
    private BigDecimal totalExpenses;
    private BigDecimal spentAmount;
    /** trips.remaining_budget (generated column). Not in the frozen contract; additive. */
    private BigDecimal remainingBudget;
    /** SUM(trip_fund_entries.amount), 0 when there are none. */
    private BigDecimal savedAmount;
    /** The caller's role: owner | editor | viewer. */
    private String myRole;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OwnerDto {
        private Long id;
        private String name;
        private String email;
        private String avatar;

        public static OwnerDto of(User user) {
            if (user == null) return null;
            return OwnerDto.builder()
                    .id(user.getId())
                    .name(user.getName())
                    .email(user.getEmail())
                    .avatar(user.getAvatar())
                    .build();
        }
    }

    /** id is the member_id (trip_members row), userId the user. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberDto {
        private Long id;
        private Long userId;
        private String name;
        private String email;
        private String avatar;
        private String role;
        private LocalDateTime joinedAt;

        /**
         * Maps a member whose user is loaded (e.g. from findByTripIdWithUser). Pass the role
         * already resolved by TripAccessService rules if it may differ from the stored one.
         */
        public static MemberDto of(TripMember member, TripMember.MemberRole role) {
            User user = member.getUser();
            return MemberDto.builder()
                    .id(member.getId())
                    .userId(member.getUserId())
                    .name(user != null ? user.getName() : null)
                    .email(user != null ? user.getEmail() : null)
                    .avatar(user != null ? user.getAvatar() : null)
                    .role((role != null ? role : member.getRole()).name())
                    .joinedAt(member.getJoinedAt())
                    .build();
        }

        public static MemberDto of(TripMember member) {
            return of(member, member.getRole());
        }
    }
}

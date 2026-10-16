package com.travelluhh.dto.expense;

import com.travelluhh.entity.Expense;
import com.travelluhh.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** amount/currency are in the trip currency; originalAmount/originalCurrency are what was paid. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExpenseResponse {

    private Long id;
    private Long tripId;
    private String description;
    private BigDecimal amount;
    private String currency;
    private BigDecimal originalAmount;
    private String originalCurrency;
    private BigDecimal fxRate;
    private Expense.ExpenseCategory category;
    private LocalDate expenseDate;
    private String notes;
    private Long addedBy;
    private UserRef addedByUser;
    /** Falls back to addedBy for expenses logged before paid_by existed. */
    private Long paidBy;
    private UserRef paidByUser;
    private List<SubItemDto> subItems;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubItemDto {
        private Long id;
        private String description;
        private BigDecimal amount;
        private Expense.ExpenseCategory category;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserRef {
        private Long id;
        private String name;
        private String email;
        private String avatar;

        public static UserRef of(User user) {
            if (user == null) return null;
            return UserRef.builder()
                    .id(user.getId())
                    .name(user.getName())
                    .email(user.getEmail())
                    .avatar(user.getAvatar())
                    .build();
        }
    }
}

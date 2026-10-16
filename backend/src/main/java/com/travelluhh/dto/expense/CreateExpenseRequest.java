package com.travelluhh.dto.expense;

import com.travelluhh.entity.Expense;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import jakarta.validation.groups.Default;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Body for POST /api/expenses and PUT /api/expenses/{id}.
 *
 * amount is always in the trip currency. When the user paid in another currency the client
 * converts first and also sends originalAmount + originalCurrency (+ fxRate). See
 * ExpenseService.resolveMoney for the exact rules.
 */
@Data
public class CreateExpenseRequest {

    /** Validation group for POST, where tripId is required. PUT validates the Default group only. */
    public interface OnCreate extends Default {}

    @NotNull(groups = OnCreate.class, message = "Trip ID is required")
    private Long tripId;

    @NotBlank(message = "Description is required")
    @Size(max = 255, message = "Description can't be longer than 255 characters")
    private String description;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "Amount must be greater than 0")
    @Digits(integer = 10, fraction = 2, message = "Amount can have at most 10 digits and 2 decimals")
    private BigDecimal amount;

    @NotBlank(message = "Currency is required")
    @Pattern(regexp = "^[A-Za-z]{3}$", message = "Currency must be a 3-letter code, like MYR")
    private String currency;

    @NotNull(message = "Category is required")
    private Expense.ExpenseCategory category;

    @NotNull(message = "Expense date is required")
    private LocalDate expenseDate;

    @Size(max = 2000, message = "Notes can't be longer than 2000 characters")
    private String notes;

    /** What was actually paid, in originalCurrency. Rounded to 2 decimals on save. */
    @DecimalMin(value = "0.0", inclusive = false, message = "Original amount must be greater than 0")
    @Digits(integer = 10, fraction = 4, message = "Original amount can have at most 10 digits")
    private BigDecimal originalAmount;

    @Pattern(regexp = "^[A-Za-z]{3}$", message = "Original currency must be a 3-letter code, like JPY")
    private String originalCurrency;

    /** originalAmount x fxRate ~= amount. Rounded to 8 decimals on save; derived when omitted. */
    @DecimalMin(value = "0.0", inclusive = false, message = "Exchange rate must be greater than 0")
    @DecimalMax(value = "9999999999", message = "Exchange rate is too large")
    private BigDecimal fxRate;

    /** userId of a trip member. Create: defaults to the caller. Update: omitted keeps the current payer. */
    private Long paidBy;

    /** Update: null keeps the current sub-items, [] removes them all. */
    @Valid
    @Size(max = 50, message = "An expense can have at most 50 sub-items")
    private List<SubItemRequest> subItems;

    @Data
    public static class SubItemRequest {
        @NotBlank(message = "Sub-item description is required")
        @Size(max = 255, message = "Sub-item description can't be longer than 255 characters")
        private String description;

        @NotNull(message = "Sub-item amount is required")
        @DecimalMin(value = "0.0", inclusive = false, message = "Sub-item amount must be greater than 0")
        @Digits(integer = 10, fraction = 2, message = "Sub-item amount can have at most 10 digits and 2 decimals")
        private BigDecimal amount;

        private Expense.ExpenseCategory category;
    }
}

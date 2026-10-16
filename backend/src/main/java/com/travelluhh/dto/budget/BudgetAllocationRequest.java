package com.travelluhh.dto.budget;

import jakarta.validation.constraints.Digits;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * One entry of PUT /api/trips/{tripId}/budgets (the body is a JSON array of these).
 * allocated is in the trip currency; 0 removes the member's allocation.
 * BudgetController validates each element (@Digits stops sizes like 1e20000000 early);
 * BudgetService.validate checks the rest.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BudgetAllocationRequest {
    private Long userId;
    @Digits(integer = 10, fraction = 2, message = "Budgets can have at most 10 digits and 2 decimals")
    private BigDecimal allocated;
}

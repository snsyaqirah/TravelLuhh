package com.travelluhh.dto.budget;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * One entry of PUT /api/trips/{tripId}/budgets (the body is a JSON array of these).
 * allocated is in the trip currency; 0 removes the member's allocation.
 * Validated in BudgetService because the body is a bare list.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BudgetAllocationRequest {
    private Long userId;
    private BigDecimal allocated;
}

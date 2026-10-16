package com.travelluhh.dto.budget;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * One row per trip member (owner first). Members without an allocation have allocated 0.
 * spent is what the member has paid on the trip, attributed by COALESCE(paid_by, added_by);
 * remaining = allocated - spent. All money in the trip currency.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberBudgetResponse {
    private Long userId;
    private String name;
    private String avatar;
    private BigDecimal allocated;
    private BigDecimal spent;
    private BigDecimal remaining;
}

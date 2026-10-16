package com.travelluhh.dto.fund;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/** GET /api/trips/{tripId}/fund. target is the trip budget, saved the sum of all entries, both in currency. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FundSummaryResponse {
    private BigDecimal target;
    private BigDecimal saved;
    private String currency;
    /** Newest first. */
    private List<FundEntryResponse> entries;
}

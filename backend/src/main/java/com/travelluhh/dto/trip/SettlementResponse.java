package com.travelluhh.dto.trip;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

/**
 * GET /api/trips/{tripId}/settlement. All amounts are in the trip currency, 2 decimals, and cent-exact:
 * the shares add up to totalSpent and the nets add up to 0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SettlementResponse {
    private BigDecimal totalSpent;
    private String currency;
    /** totalSpent / number of people on the trip, rounded to the cent. Informational on separated trips. */
    private BigDecimal perPerson;
    private List<Balance> balances;
    private List<Transaction> transactions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Balance {
        private Long userId;
        private String name;
        private String avatar;
        private BigDecimal paid;
        private BigDecimal share;
        /** paid - share: positive is owed money, negative owes. */
        private BigDecimal net;
        /**
         * False for someone who paid for expenses on the trip but has since left or been removed.
         * They take no share of the split; the others pay them back. Additive to the contract.
         */
        private Boolean onTrip;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Transaction {
        private Long fromUserId;
        private String fromName;
        private Long toUserId;
        private String toName;
        private BigDecimal amount;
    }
}

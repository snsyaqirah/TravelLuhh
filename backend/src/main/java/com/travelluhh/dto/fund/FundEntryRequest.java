package com.travelluhh.dto.fund;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/** POST /api/trips/{tripId}/fund. amount is in the trip currency; negative is a withdrawal, never 0. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FundEntryRequest {

    @NotNull(message = "Amount is required")
    @Digits(integer = 10, fraction = 2, message = "Amount can have up to 10 digits and 2 decimal places")
    private BigDecimal amount;

    @NotNull(message = "Pick a date")
    private LocalDate entryDate;

    @Size(max = 500, message = "Note can't be longer than 500 characters")
    private String note;
}

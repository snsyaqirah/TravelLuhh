package com.travelluhh.dto.trip;

import com.travelluhh.entity.Trip;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Partial update: null fields are left unchanged. Send season "" to clear it. */
@Data
public class UpdateTripRequest {

    @Size(max = 255, message = "Trip name can't be longer than 255 characters")
    @Pattern(regexp = "(?s).*\\S.*", message = "Trip name can't be empty")
    private String name;

    @Pattern(regexp = "^[A-Za-z]{2}$", message = "Country must be a 2-letter code, like JP")
    private String destinationCountry;

    private LocalDate startDate;

    private LocalDate endDate;

    @Size(max = 5000, message = "Description can't be longer than 5000 characters")
    private String description;

    @Size(max = 500, message = "Image URL can't be longer than 500 characters")
    private String image;

    @DecimalMin(value = "0.0", inclusive = false, message = "Budget must be greater than 0")
    @Digits(integer = 10, fraction = 2, message = "Budget can have at most 10 digits and 2 decimals")
    private BigDecimal budget;

    @Pattern(regexp = "^[A-Za-z]{3}$", message = "Currency must be a 3-letter code, like MYR")
    private String currency;

    /** Owner only (when it actually changes). */
    @Pattern(regexp = "^(solo|shared|separated)$", message = "Budget type must be solo, shared or separated")
    private String budgetType;

    private String season;

    @Size(max = 10000, message = "Notes can't be longer than 10000 characters")
    private String notes;

    private Trip.TripStatus status;

    /** Owner only (when it actually changes). */
    private Boolean isArchived;
}

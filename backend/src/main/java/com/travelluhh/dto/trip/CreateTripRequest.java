package com.travelluhh.dto.trip;

import com.travelluhh.entity.Trip;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateTripRequest {

    @NotBlank(message = "Trip name is required")
    @Size(max = 255, message = "Trip name can't be longer than 255 characters")
    private String name;

    @NotBlank(message = "Destination country is required")
    @Pattern(regexp = "^[A-Za-z]{2}$", message = "Country must be a 2-letter code, like JP")
    private String destinationCountry;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    @NotNull(message = "End date is required")
    private LocalDate endDate;

    @Size(max = 5000, message = "Description can't be longer than 5000 characters")
    private String description;

    @Size(max = 500, message = "Image URL can't be longer than 500 characters")
    private String image;

    @NotNull(message = "Budget is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "Budget must be greater than 0")
    @Digits(integer = 10, fraction = 2, message = "Budget can have at most 10 digits and 2 decimals")
    private BigDecimal budget;

    @NotBlank(message = "Currency is required")
    @Pattern(regexp = "^[A-Za-z]{3}$", message = "Currency must be a 3-letter code, like MYR")
    private String currency;

    @Pattern(regexp = "^(solo|shared|separated)$", message = "Budget type must be solo, shared or separated")
    private String budgetType = "solo";

    /** spring | summer | autumn | winter | tropical, or null. Validated and lower-cased in TripService. */
    private String season;

    @Size(max = 10000, message = "Notes can't be longer than 10000 characters")
    private String notes;

    private Trip.TripStatus status = Trip.TripStatus.PLANNED;
}

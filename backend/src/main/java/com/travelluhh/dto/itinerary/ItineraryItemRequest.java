package com.travelluhh.dto.itinerary;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;

/** Body for POST and PUT. PUT replaces every field. Times are "HH:mm" or "HH:mm:ss". */
@Data
public class ItineraryItemRequest {

    @NotNull(message = "Date is required")
    private LocalDate itemDate;

    @NotBlank(message = "Title is required")
    @Size(max = 255, message = "Title can't be longer than 255 characters")
    private String title;

    private LocalTime startTime;

    private LocalTime endTime;

    @Size(max = 5000, message = "Description can't be longer than 5000 characters")
    private String description;

    @Size(max = 255, message = "Location can't be longer than 255 characters")
    private String location;

    @Size(max = 50, message = "Category can't be longer than 50 characters")
    private String category;

    /** Optional manual order within a day; lower first. */
    @Min(value = 0, message = "Sort order can't be negative")
    private Integer sortOrder;
}

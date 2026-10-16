package com.travelluhh.dto.user;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Partial update: null fields are left as they are. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileRequest {

    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String name;

    @Pattern(regexp = "^[A-Za-z]{2}$", message = "Country must be a 2-letter code like MY")
    private String country;

    @Pattern(regexp = "^[A-Za-z]{3}$", message = "Currency must be a 3-letter code like MYR")
    private String currency;

    private Boolean onboardingCompleted;
}

package com.travelluhh.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CompleteSignupRequest {

    /** Short-lived typ=verify JWT returned by /verify-email */
    @NotBlank(message = "Verification token is required")
    private String verificationToken;

    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String name;

    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 128, message = "Password must be between 8 and 128 characters")
    private String password;

    /** Optional home country (ISO-2). With currency, it completes onboarding at sign-up. */
    @Pattern(regexp = "^[A-Za-z]{2}$", message = "Country must be a 2-letter code like MY")
    private String country;

    /** Optional home currency (ISO-4217). */
    @Pattern(regexp = "^[A-Za-z]{3}$", message = "Currency must be a 3-letter code like MYR")
    private String currency;
}

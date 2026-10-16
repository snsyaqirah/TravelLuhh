package com.travelluhh.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class VerifyEmailRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;

    @NotBlank(message = "Code is required")
    @Pattern(regexp = "^\\s*\\d{6}\\s*$", message = "Enter the 6-digit code from the email")
    private String code;

    @NotBlank(message = "Purpose is required")
    @Pattern(regexp = "^(signup|forgot_password)$", message = "Purpose must be signup or forgot_password")
    private String purpose;
}

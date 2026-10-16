package com.travelluhh.dto.user;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.travelluhh.dto.auth.LoginResponse;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * {@code {message, accessToken, refreshToken, expiresIn, user}}.
 * Changing the password ends every other session, so the caller gets a fresh token pair to stay logged in.
 * Clients that only read {@code message} keep working.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PasswordChangedResponse {

    private String message;

    @JsonUnwrapped
    private LoginResponse session;
}

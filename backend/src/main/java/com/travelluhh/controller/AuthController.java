package com.travelluhh.controller;

import com.travelluhh.dto.auth.*;
import com.travelluhh.exception.InvalidTokenException;
import com.travelluhh.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Public auth routes.
 *
 * Email sign-up:   POST /initiate-signup {email} → POST /verify-email {email, code, purpose:"signup"}
 *                  → POST /complete-signup {verificationToken, name, password, country?, currency?}
 * Login:           POST /login {email, password}
 * Forgot password: POST /forgot-password {email} → POST /verify-email {…, purpose:"forgot_password"}
 *                  → POST /reset-password {email, verificationToken, newPassword}
 * Sessions:        POST /refresh and POST /logout, both with "Authorization: Bearer <refreshToken>"
 * Google:          GET /oauth2/authorization/google (handled by Spring Security, not here)
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/initiate-signup")
    public ResponseEntity<MessageResponse> initiateSignup(@Valid @RequestBody InitiateSignupRequest request) {
        return ResponseEntity.ok(authService.initiateSignup(request));
    }

    @PostMapping("/verify-email")
    public ResponseEntity<VerifyEmailResponse> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        return ResponseEntity.ok(authService.verifyEmail(request));
    }

    @PostMapping("/complete-signup")
    public ResponseEntity<LoginResponse> completeSignup(@Valid @RequestBody CompleteSignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.completeSignup(request));
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<MessageResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.forgotPassword(request));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(authService.resetPassword(request));
    }

    /** Rotates: the presented refresh token is revoked and a new pair is returned. */
    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader) {
        String token = bearer(authHeader);
        if (token == null) {
            throw new InvalidTokenException("Your session has ended. Log in again.");
        }
        return ResponseEntity.ok(authService.refreshToken(token));
    }

    /** Revokes the presented refresh token. Always 204, even for a missing or unknown token. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader) {
        try {
            authService.logout(bearer(authHeader));
        } catch (RuntimeException e) {
            log.warn("Logout could not revoke a refresh token: {}", e.getMessage());
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }

    private static String bearer(String header) {
        if (header == null || header.isBlank()) return null;
        String token = header.startsWith("Bearer ") ? header.substring(7) : header;
        return token.isBlank() ? null : token.trim();
    }
}

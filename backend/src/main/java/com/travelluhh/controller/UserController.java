package com.travelluhh.controller;

import com.travelluhh.dto.user.ChangePasswordRequest;
import com.travelluhh.dto.user.PasswordChangedResponse;
import com.travelluhh.dto.user.UpdateProfileRequest;
import com.travelluhh.dto.user.UserResponse;
import com.travelluhh.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** The signed-in user's own account. Every endpoint needs an access token; the JWT subject is the email. */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(Authentication authentication) {
        return ResponseEntity.ok(userService.getCurrentUser(authentication.getName()));
    }

    @PutMapping("/profile")
    public ResponseEntity<UserResponse> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(userService.updateProfile(authentication.getName(), request));
    }

    /** {@code {message, accessToken, refreshToken, expiresIn, user}}: other sessions end, this one gets new tokens. */
    @PutMapping("/change-password")
    public ResponseEntity<PasswordChangedResponse> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(userService.changePassword(authentication.getName(), request));
    }
}

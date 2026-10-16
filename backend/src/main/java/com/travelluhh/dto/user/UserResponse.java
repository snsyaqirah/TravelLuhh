package com.travelluhh.dto.user;

import com.travelluhh.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * The only shape a user leaves the API in (GET /users/me, PUT /users/profile, LoginResponse.user).
 * Never carries the password hash or the Google subject id.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {

    private Long id;
    private String name;
    private String email;
    private String avatar;
    /** "local" or "google" */
    private String authProvider;
    private String country;
    private String currency;
    private boolean onboardingCompleted;
    private boolean emailVerified;
    /** False for Google-only accounts; the frontend hides change-password for them. */
    private boolean hasPassword;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static UserResponse from(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .avatar(user.getAvatar())
                .authProvider(user.getAuthProvider() != null ? user.getAuthProvider().name() : User.AuthProvider.local.name())
                .country(user.getCountry())
                .currency(user.getCurrency())
                .onboardingCompleted(Boolean.TRUE.equals(user.getOnboardingCompleted()))
                .emailVerified(Boolean.TRUE.equals(user.getEmailVerified()))
                .hasPassword(user.hasPassword())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}

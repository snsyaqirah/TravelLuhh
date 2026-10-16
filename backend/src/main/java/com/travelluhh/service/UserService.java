package com.travelluhh.service;

import com.travelluhh.dto.user.ChangePasswordRequest;
import com.travelluhh.dto.user.PasswordChangedResponse;
import com.travelluhh.dto.user.UpdateProfileRequest;
import com.travelluhh.dto.user.UserResponse;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.repository.UserRepository;
import com.travelluhh.security.TokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(String userEmail) {
        return UserResponse.from(getUserByEmail(userEmail));
    }

    /**
     * Partial update; null fields are left alone.
     * {@code onboardingCompleted} is set when sent. Older clients that send country + currency without it are
     * finishing onboarding, so that still marks it complete.
     */
    public UserResponse updateProfile(String userEmail, UpdateProfileRequest request) {
        User user = getUserByEmail(userEmail);

        if (request.getName() != null && !request.getName().isBlank()) {
            user.setName(request.getName().trim());
        }
        if (request.getCountry() != null && !request.getCountry().isBlank()) {
            user.setCountry(request.getCountry().toUpperCase(Locale.ROOT));
        }
        if (request.getCurrency() != null && !request.getCurrency().isBlank()) {
            user.setCurrency(request.getCurrency().toUpperCase(Locale.ROOT));
        }
        if (request.getOnboardingCompleted() != null) {
            user.setOnboardingCompleted(request.getOnboardingCompleted());
        } else if (request.getCountry() != null && request.getCurrency() != null) {
            user.setOnboardingCompleted(true);
        }

        return UserResponse.from(userRepository.save(user));
    }

    /**
     * Checks the current password, sets the new one and ends every other session.
     * Returns a fresh token pair so the caller stays logged in.
     */
    public PasswordChangedResponse changePassword(String userEmail, ChangePasswordRequest request) {
        User user = getUserByEmail(userEmail);

        if (!user.hasPassword()) {
            throw new BadRequestException(
                    "This account signs in with Google, so there's no password to change. Use Forgot password to add one.");
        }
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect.");
        }
        if (request.getCurrentPassword().equals(request.getNewPassword())) {
            throw new BadRequestException("The new password must be different from the current one.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user = userRepository.save(user);
        tokenService.revokeAllForUser(user.getId());

        return new PasswordChangedResponse("Password changed.", tokenService.issueSession(user));
    }

    @Transactional(readOnly = true)
    public User getUserByEmail(String userEmail) {
        return userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    @Transactional(readOnly = true)
    public User getUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }
}

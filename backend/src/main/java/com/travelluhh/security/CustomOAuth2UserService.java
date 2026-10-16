package com.travelluhh.security;

import com.travelluhh.entity.User;
import com.travelluhh.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Map;

/**
 * Maps a Google profile to a TravelLuhh user, matching by Google id first and then by email.
 *
 * - New email: creates a Google account (verified, no password, onboarding pending).
 * - Existing local account with that email: links the Google id and keeps it a local account, so its
 *   password keeps working.
 * Google must say the email is verified; otherwise anyone could claim an address on Google and take over the
 * matching TravelLuhh account.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);
        return toPrincipal(oAuth2User.getAttributes());
    }

    /** Split from loadUser so it can be exercised without calling Google. */
    OAuth2UserPrincipal toPrincipal(Map<String, Object> attributes) {
        String googleId = stringAttr(attributes, "sub");
        String rawEmail = stringAttr(attributes, "email");
        String name = stringAttr(attributes, "name");
        String avatar = stringAttr(attributes, "picture");

        if (googleId == null || rawEmail == null || rawEmail.isBlank()) {
            throw failure("missing_profile", "Google did not share an id and email");
        }
        if (!isTrue(attributes.get("email_verified"))) {
            throw failure("email_not_verified", "Google has not verified this email address");
        }
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);

        User user = userRepository.findByGoogleId(googleId)
                .or(() -> userRepository.findByEmail(email))
                .map(existing -> link(existing, googleId, name, avatar))
                .orElseGet(() -> create(googleId, email, name, avatar));

        user = userRepository.save(user);
        log.info("Google profile mapped to user {}", user.getId());
        return new OAuth2UserPrincipal(user, attributes);
    }

    private User link(User user, String googleId, String name, String avatar) {
        user.setGoogleId(googleId);
        // Google has proven ownership of the address, so a half-finished email signup becomes usable too.
        user.setEmailVerified(true);
        if (user.getAuthProvider() == null) user.setAuthProvider(User.AuthProvider.google);
        if (user.getName() == null || user.getName().isBlank()) user.setName(name);
        if (user.getAvatar() == null || user.getAvatar().isBlank()) user.setAvatar(avatar);
        return user;
    }

    private User create(String googleId, String email, String name, String avatar) {
        return User.builder()
                .googleId(googleId)
                .email(email)
                .name(name)
                .avatar(avatar)
                .authProvider(User.AuthProvider.google)
                .emailVerified(true)
                .onboardingCompleted(false)
                .build();
    }

    private static String stringAttr(Map<String, Object> attributes, String key) {
        Object value = attributes.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private static boolean isTrue(Object value) {
        return value instanceof Boolean b ? b : "true".equalsIgnoreCase(String.valueOf(value));
    }

    private static OAuth2AuthenticationException failure(String code, String description) {
        return new OAuth2AuthenticationException(new OAuth2Error(code, description, null), description);
    }
}

package com.travelluhh.security;

import com.travelluhh.dto.auth.LoginResponse;
import com.travelluhh.dto.user.UserResponse;
import com.travelluhh.entity.RefreshToken;
import com.travelluhh.entity.User;
import com.travelluhh.exception.InvalidTokenException;
import com.travelluhh.repository.RefreshTokenRepository;
import com.travelluhh.repository.UserRepository;
import com.travelluhh.util.JwtUtil;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Issues sessions (access + refresh pair) and owns the refresh-token lifecycle: persist, rotate, revoke.
 * Only the SHA-256 of a refresh token is stored.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TokenService {

    static final String SESSION_ENDED = "Your session has ended. Log in again.";

    private final JwtUtil jwtUtil;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;

    /** New access token + new persisted refresh token + the user, as returned by login, signup and refresh. */
    @Transactional
    public LoginResponse issueSession(User user) {
        LocalDateTime now = LocalDateTime.now();
        String accessToken = jwtUtil.generateAccessToken(user);
        String refreshToken = jwtUtil.generateRefreshToken(user);

        refreshTokenRepository.deleteExpiredForUser(user.getId(), now);
        refreshTokenRepository.save(RefreshToken.builder()
                .userId(user.getId())
                .tokenHash(sha256Hex(refreshToken))
                .expiresAt(now.plus(Duration.ofMillis(jwtUtil.getRefreshExpirationMs())))
                .revoked(false)
                .build());

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(jwtUtil.getAccessExpirationMs())
                .user(UserResponse.from(user))
                .build();
    }

    /**
     * Exchanges a valid, unrevoked refresh token for a new pair and revokes the old one.
     * Anything else (access token, verification token, expired, revoked, unknown, tokens issued before
     * refresh tokens were stored) is a 401.
     */
    @Transactional
    public LoginResponse rotate(String rawRefreshToken) {
        Claims claims = jwtUtil.parse(rawRefreshToken, JwtUtil.TokenType.REFRESH)
                .orElseThrow(() -> new InvalidTokenException(SESSION_ENDED));

        RefreshToken stored = refreshTokenRepository.findByTokenHash(sha256Hex(rawRefreshToken.trim()))
                .orElseThrow(() -> new InvalidTokenException(SESSION_ENDED));

        if (stored.isRevoked()) {
            log.warn("Revoked refresh token presented again for user {}", stored.getUserId());
            throw new InvalidTokenException(SESSION_ENDED);
        }
        if (stored.isExpired(LocalDateTime.now())) {
            throw new InvalidTokenException(SESSION_ENDED);
        }

        User user = userRepository.findById(stored.getUserId())
                .filter(u -> u.getEmail() != null && u.getEmail().equalsIgnoreCase(claims.getSubject()))
                .orElseThrow(() -> new InvalidTokenException(SESSION_ENDED));

        stored.setRevoked(true);
        refreshTokenRepository.save(stored);
        return issueSession(user);
    }

    /** Logout. Best effort and silent: an unknown or already-revoked token is not an error. */
    @Transactional
    public void revoke(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) return;
        Optional<RefreshToken> stored = refreshTokenRepository.findByTokenHash(sha256Hex(rawRefreshToken.trim()));
        stored.filter(t -> !t.isRevoked()).ifPresent(t -> {
            t.setRevoked(true);
            refreshTokenRepository.save(t);
        });
    }

    /** Ends every session of a user (password changed or reset). Access tokens already issued live out their TTL. */
    @Transactional
    public void revokeAllForUser(Long userId) {
        if (userId == null) return;
        int revoked = refreshTokenRepository.revokeAllForUser(userId);
        log.info("Revoked {} refresh token(s) for user {}", revoked, userId);
    }

    static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}

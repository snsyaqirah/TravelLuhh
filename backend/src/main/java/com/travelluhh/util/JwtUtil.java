package com.travelluhh.util;

import com.travelluhh.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

/**
 * Issues and checks the three kinds of JWT the app uses. Every token carries a {@code typ} claim and a token
 * is only ever accepted as the type it was issued as, so a refresh or verification token can't call the API
 * and an access token can't be used to refresh.
 *
 * Subject is the user's email (controllers read it through {@code authentication.getName()}).
 */
@Slf4j
@Component
public class JwtUtil {

    public enum TokenType {
        ACCESS("access"),
        REFRESH("refresh"),
        VERIFY("verify");

        public final String claim;

        TokenType(String claim) {
            this.claim = claim;
        }
    }

    public static final String CLAIM_TYPE = "typ";
    public static final String CLAIM_USER_ID = "uid";
    public static final String CLAIM_PURPOSE = "purpose";
    static final String ISSUER = "travelluhh";

    /** Real tokens are well under 1 KB; anything this large is not ours and isn't worth parsing. */
    private static final int MAX_TOKEN_LENGTH = 4096;
    private static final String BASE64_PREFIX = "base64:";
    private static final String DEV_SECRET_MARKER = "dev-only";

    private final SecretKey signingKey;
    private final JwtParser parser;
    private final long accessExpirationMs;
    private final long refreshExpirationMs;
    private final long verificationExpirationMs;

    public JwtUtil(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration:86400000}") long accessExpirationMs,
            @Value("${app.jwt.refresh-expiration:604800000}") long refreshExpirationMs,
            @Value("${app.jwt.verification-expiration:300000}") long verificationExpirationMs
    ) {
        this.signingKey = deriveKey(secret);
        // signature comparison inside jjwt is constant-time; unsigned ("alg":"none") tokens are rejected by default
        this.parser = Jwts.parser()
                .verifyWith(signingKey)
                .requireIssuer(ISSUER)
                .build();
        this.accessExpirationMs = accessExpirationMs;
        this.refreshExpirationMs = refreshExpirationMs;
        this.verificationExpirationMs = verificationExpirationMs;
    }

    /**
     * Keeps the original derivation (raw UTF-8 bytes of the configured secret) so existing deployments keep
     * working. A secret written as {@code base64:<key>} is decoded first, which is the format to use when rotating.
     */
    private static SecretKey deriveKey(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("app.jwt.secret (JWT_SECRET) is not set.");
        }
        byte[] keyBytes = secret.startsWith(BASE64_PREFIX)
                ? Decoders.BASE64.decode(secret.substring(BASE64_PREFIX.length()))
                : secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException("app.jwt.secret (JWT_SECRET) must be at least 32 bytes (256 bits).");
        }
        if (secret.contains(DEV_SECRET_MARKER)) {
            log.warn("JWT secret is the development placeholder. Set JWT_SECRET before deploying anywhere public.");
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    // ── Issuing ──────────────────────────────────────────────────────────────

    public String generateAccessToken(User user) {
        return build(TokenType.ACCESS, user.getEmail(), user.getId(), null, accessExpirationMs);
    }

    /** Carries a random jti so two refresh tokens issued in the same second still hash differently. */
    public String generateRefreshToken(User user) {
        return build(TokenType.REFRESH, user.getEmail(), user.getId(), null, refreshExpirationMs);
    }

    /** Proof that an emailed code was entered, for /complete-signup ({@code signup}) or /reset-password ({@code forgot_password}). */
    public String generateVerificationToken(String email, String purpose) {
        return build(TokenType.VERIFY, email, null, purpose, verificationExpirationMs);
    }

    private String build(TokenType type, String subject, Long userId, String purpose, long ttlMs) {
        Date now = new Date();
        var builder = Jwts.builder()
                .id(UUID.randomUUID().toString())
                .issuer(ISSUER)
                .subject(subject)
                .claim(CLAIM_TYPE, type.claim)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + ttlMs));
        if (userId != null) builder.claim(CLAIM_USER_ID, userId);
        if (purpose != null) builder.claim(CLAIM_PURPOSE, purpose);
        return builder.signWith(signingKey).compact();
    }

    // ── Checking ─────────────────────────────────────────────────────────────

    /**
     * Returns the claims only if the token is well-formed, signed by us, unexpired, has a subject and is of
     * the expected type. Never throws for a bad token.
     */
    public Optional<Claims> parse(String token, TokenType expected) {
        if (token == null || token.isBlank() || token.length() > MAX_TOKEN_LENGTH) {
            return Optional.empty();
        }
        try {
            Claims claims = parser.parseSignedClaims(token.trim()).getPayload();
            if (!expected.claim.equals(claims.get(CLAIM_TYPE, String.class))) {
                log.debug("Rejected a JWT of type '{}' where '{}' was expected", claims.get(CLAIM_TYPE), expected.claim);
                return Optional.empty();
            }
            if (claims.getSubject() == null || claims.getSubject().isBlank()) {
                return Optional.empty();
            }
            return Optional.of(claims);
        } catch (ExpiredJwtException e) {
            log.debug("Expired {} token", expected.claim);
            return Optional.empty();
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Invalid {} token: {}", expected.claim, e.getMessage());
            return Optional.empty();
        }
    }

    public long getAccessExpirationMs() {
        return accessExpirationMs;
    }

    public long getRefreshExpirationMs() {
        return refreshExpirationMs;
    }
}

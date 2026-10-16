package com.travelluhh.util;

import com.travelluhh.entity.User;
import com.travelluhh.util.JwtUtil.TokenType;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Date;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtUtilTest {

    private static final String SECRET = "a-test-secret-that-is-comfortably-longer-than-thirty-two-bytes-0123456789";
    private final JwtUtil jwt = new JwtUtil(SECRET, 60_000, 120_000, 30_000);
    private final User user = User.builder().id(42L).email("siti@example.com").build();

    @Test
    void accessTokenIsOnlyAcceptedAsAccess() {
        String token = jwt.generateAccessToken(user);

        Optional<Claims> access = jwt.parse(token, TokenType.ACCESS);
        assertThat(access).isPresent();
        assertThat(access.get().getSubject()).isEqualTo("siti@example.com");
        assertThat(access.get().get(JwtUtil.CLAIM_USER_ID, Long.class)).isEqualTo(42L);

        assertThat(jwt.parse(token, TokenType.REFRESH)).isEmpty();
        assertThat(jwt.parse(token, TokenType.VERIFY)).isEmpty();
    }

    @Test
    void refreshTokenCannotAuthenticateApiCalls() {
        String token = jwt.generateRefreshToken(user);

        assertThat(jwt.parse(token, TokenType.REFRESH)).isPresent();
        assertThat(jwt.parse(token, TokenType.ACCESS)).isEmpty();
        assertThat(jwt.parse(token, TokenType.VERIFY)).isEmpty();
    }

    @Test
    void verificationTokenCarriesPurposeAndIsNotAnAccessToken() {
        String token = jwt.generateVerificationToken("siti@example.com", "forgot_password");

        Optional<Claims> verify = jwt.parse(token, TokenType.VERIFY);
        assertThat(verify).isPresent();
        assertThat(verify.get().get(JwtUtil.CLAIM_PURPOSE, String.class)).isEqualTo("forgot_password");

        assertThat(jwt.parse(token, TokenType.ACCESS)).isEmpty();
        assertThat(jwt.parse(token, TokenType.REFRESH)).isEmpty();
    }

    @Test
    void refreshTokensIssuedBackToBackAreDistinct() {
        // they are stored by hash under a unique constraint, so identical tokens would collide
        assertThat(jwt.generateRefreshToken(user)).isNotEqualTo(jwt.generateRefreshToken(user));
    }

    @Test
    void expiredTokenIsRejected() {
        JwtUtil expired = new JwtUtil(SECRET, -1_000, -1_000, -1_000);
        assertThat(jwt.parse(expired.generateAccessToken(user), TokenType.ACCESS)).isEmpty();
        assertThat(jwt.parse(expired.generateRefreshToken(user), TokenType.REFRESH)).isEmpty();
    }

    @Test
    void tokenSignedWithAnotherSecretIsRejected() {
        JwtUtil other = new JwtUtil("another-secret-that-is-also-longer-than-thirty-two-bytes!!", 60_000, 60_000, 60_000);
        assertThat(jwt.parse(other.generateAccessToken(user), TokenType.ACCESS)).isEmpty();
    }

    @Test
    void tamperedPayloadIsRejected() {
        String token = jwt.generateAccessToken(user);
        String[] parts = token.split("\\.");
        String forgedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(
                "{\"sub\":\"aiman@example.com\",\"typ\":\"access\",\"iss\":\"travelluhh\",\"exp\":9999999999}"
                        .getBytes(StandardCharsets.UTF_8));
        String forged = parts[0] + "." + forgedPayload + "." + parts[2];

        assertThat(jwt.parse(forged, TokenType.ACCESS)).isEmpty();
    }

    @Test
    void legacyTokenWithoutTypeIsRejected() {
        // what the app issued before typ existed: same key, subject + expiry only
        String legacy = Jwts.builder()
                .subject("siti@example.com")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();

        assertThat(jwt.parse(legacy, TokenType.ACCESS)).isEmpty();
        assertThat(jwt.parse(legacy, TokenType.REFRESH)).isEmpty();
    }

    @Test
    void garbageNeverThrows() {
        assertThat(jwt.parse(null, TokenType.ACCESS)).isEmpty();
        assertThat(jwt.parse("", TokenType.ACCESS)).isEmpty();
        assertThat(jwt.parse("not.a.jwt", TokenType.ACCESS)).isEmpty();
        assertThat(jwt.parse("x".repeat(10_000), TokenType.ACCESS)).isEmpty();
    }

    @Test
    void base64SecretIsDecoded() {
        byte[] raw = new byte[48];
        for (int i = 0; i < raw.length; i++) raw[i] = (byte) (i * 7);
        String b64 = "base64:" + Base64.getEncoder().encodeToString(raw);
        JwtUtil util = new JwtUtil(b64, 60_000, 60_000, 60_000);

        String token = util.generateAccessToken(user);
        assertThat(util.parse(token, TokenType.ACCESS)).isPresent();
        // the same characters used as raw UTF-8 bytes would be a different key
        assertThat(new JwtUtil(b64.substring(7), 60_000, 60_000, 60_000).parse(token, TokenType.ACCESS)).isEmpty();
    }

    @Test
    void shortSecretFailsFast() {
        assertThatThrownBy(() -> new JwtUtil("too-short", 1, 1, 1))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 bytes");
        assertThatThrownBy(() -> new JwtUtil(" ", 1, 1, 1)).isInstanceOf(IllegalStateException.class);
    }
}

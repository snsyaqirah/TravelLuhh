package com.travelluhh.security;

import com.travelluhh.dto.auth.LoginResponse;
import com.travelluhh.entity.RefreshToken;
import com.travelluhh.entity.User;
import com.travelluhh.exception.InvalidTokenException;
import com.travelluhh.repository.RefreshTokenRepository;
import com.travelluhh.repository.UserRepository;
import com.travelluhh.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TokenServiceTest {

    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private UserRepository userRepository;

    private final JwtUtil jwtUtil =
            new JwtUtil("a-test-secret-that-is-comfortably-longer-than-thirty-two-bytes-0123456789", 60_000, 120_000, 30_000);
    private final User user = User.builder().id(7L).email("siti@example.com").name("Siti").emailVerified(true).build();
    private TokenService tokenService;

    @BeforeEach
    void setUp() {
        tokenService = new TokenService(jwtUtil, refreshTokenRepository, userRepository);
    }

    @Test
    void issuedRefreshTokenIsStoredOnlyAsItsHash() {
        LoginResponse session = tokenService.issueSession(user);

        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(saved.capture());
        assertThat(saved.getValue().getTokenHash())
                .isEqualTo(TokenService.sha256Hex(session.getRefreshToken()))
                .hasSize(64)
                .doesNotContain(".");
        assertThat(saved.getValue().getUserId()).isEqualTo(7L);
        assertThat(saved.getValue().isRevoked()).isFalse();
        assertThat(session.getUser().getEmail()).isEqualTo("siti@example.com");
        assertThat(session.getExpiresIn()).isEqualTo(60_000L);
    }

    @Test
    void rotateRevokesTheOldTokenAndIssuesANewPair() {
        String refresh = jwtUtil.generateRefreshToken(user);
        RefreshToken stored = stored(refresh, false, LocalDateTime.now().plusDays(1));
        when(refreshTokenRepository.findByTokenHash(TokenService.sha256Hex(refresh))).thenReturn(Optional.of(stored));
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));

        LoginResponse session = tokenService.rotate(refresh);

        assertThat(stored.isRevoked()).isTrue();
        assertThat(session.getRefreshToken()).isNotEqualTo(refresh);
        assertThat(jwtUtil.parse(session.getAccessToken(), JwtUtil.TokenType.ACCESS)).isPresent();
    }

    @Test
    void revokedTokenCannotBeReused() {
        String refresh = jwtUtil.generateRefreshToken(user);
        when(refreshTokenRepository.findByTokenHash(anyString()))
                .thenReturn(Optional.of(stored(refresh, true, LocalDateTime.now().plusDays(1))));

        assertThatThrownBy(() -> tokenService.rotate(refresh)).isInstanceOf(InvalidTokenException.class);
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void accessTokenCannotBeUsedToRefresh() {
        String access = jwtUtil.generateAccessToken(user);

        assertThatThrownBy(() -> tokenService.rotate(access)).isInstanceOf(InvalidTokenException.class);
        verify(refreshTokenRepository, never()).findByTokenHash(anyString());
    }

    @Test
    void signedButUnstoredTokenIsRejected() {
        // e.g. issued before refresh tokens were persisted, or deleted after expiry
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tokenService.rotate(jwtUtil.generateRefreshToken(user)))
                .isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void storedRowPastItsExpiryIsRejected() {
        String refresh = jwtUtil.generateRefreshToken(user);
        when(refreshTokenRepository.findByTokenHash(anyString()))
                .thenReturn(Optional.of(stored(refresh, false, LocalDateTime.now().minusSeconds(1))));

        assertThatThrownBy(() -> tokenService.rotate(refresh)).isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void logoutIsSilentForUnknownTokens() {
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThatCode(() -> tokenService.revoke("whatever")).doesNotThrowAnyException();
        assertThatCode(() -> tokenService.revoke(null)).doesNotThrowAnyException();
    }

    @Test
    void logoutRevokesTheStoredToken() {
        String refresh = jwtUtil.generateRefreshToken(user);
        RefreshToken stored = stored(refresh, false, LocalDateTime.now().plusDays(1));
        when(refreshTokenRepository.findByTokenHash(TokenService.sha256Hex(refresh))).thenReturn(Optional.of(stored));

        tokenService.revoke(refresh);

        assertThat(stored.isRevoked()).isTrue();
        verify(refreshTokenRepository).save(stored);
    }

    private static RefreshToken stored(String raw, boolean revoked, LocalDateTime expiresAt) {
        return RefreshToken.builder()
                .id(1L)
                .userId(7L)
                .tokenHash(TokenService.sha256Hex(raw))
                .revoked(revoked)
                .expiresAt(expiresAt)
                .build();
    }
}

package com.travelluhh.service;

import com.travelluhh.dto.auth.ForgotPasswordRequest;
import com.travelluhh.dto.auth.InitiateSignupRequest;
import com.travelluhh.dto.auth.LoginRequest;
import com.travelluhh.dto.auth.ResetPasswordRequest;
import com.travelluhh.dto.auth.VerifyEmailRequest;
import com.travelluhh.dto.auth.VerifyEmailResponse;
import com.travelluhh.entity.EmailVerificationCode;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.exception.EmailDeliveryException;
import com.travelluhh.exception.InvalidTokenException;
import com.travelluhh.exception.TooManyRequestsException;
import com.travelluhh.exception.UserAlreadyExistsException;
import com.travelluhh.repository.EmailVerificationCodeRepository;
import com.travelluhh.repository.UserRepository;
import com.travelluhh.security.OtpRateLimiter;
import com.travelluhh.security.TokenService;
import com.travelluhh.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceOtpTest {

    private static final String EMAIL = "siti@example.com";

    @Mock private UserRepository userRepository;
    @Mock private EmailVerificationCodeRepository codeRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private EmailService emailService;
    @Mock private TokenService tokenService;

    private final JwtUtil jwtUtil =
            new JwtUtil("a-test-secret-that-is-comfortably-longer-than-thirty-two-bytes-0123456789", 60_000, 120_000, 30_000);
    private final OtpRateLimiter rateLimiter = new OtpRateLimiter();
    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, codeRepository, passwordEncoder, jwtUtil,
                emailService, tokenService, rateLimiter, 10);
    }

    // ── Wrong-code attempts ──────────────────────────────────────────────────

    @Test
    void wrongCodeCountsAnAttemptAndSaysHowManyAreLeft() {
        EmailVerificationCode code = activeCode("123456", 0);
        givenActiveCode(code);

        assertThatThrownBy(() -> authService.verifyEmail(verifyRequest("000000")))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("That code doesn't match. 4 tries left.");

        assertThat(code.getAttempts()).isEqualTo(1);
        assertThat(code.getUsed()).isFalse();
        verify(codeRepository).save(code);
    }

    @Test
    void fifthWrongCodeBurnsTheCode() {
        EmailVerificationCode code = activeCode("123456", 4);
        givenActiveCode(code);

        assertThatThrownBy(() -> authService.verifyEmail(verifyRequest("000000")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("last try");

        assertThat(code.getAttempts()).isEqualTo(5);
        assertThat(code.getUsed()).isTrue();
    }

    @Test
    void burntCodeIsRefusedEvenWhenTheGuessIsRight() {
        EmailVerificationCode code = activeCode("123456", 5);
        givenActiveCode(code);

        assertThatThrownBy(() -> authService.verifyEmail(verifyRequest("123456")))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Too many wrong tries. Ask for a new code.");
        assertThat(code.getUsed()).isTrue();
    }

    @Test
    void legacyRowWithNullAttemptsStillCounts() {
        EmailVerificationCode code = activeCode("123456", 0);
        code.setAttempts(null);
        givenActiveCode(code);

        assertThatThrownBy(() -> authService.verifyEmail(verifyRequest("111111"))).isInstanceOf(BadRequestException.class);
        assertThat(code.getAttempts()).isEqualTo(1);
    }

    @Test
    void expiredCodeIsRefusedAndBurnt() {
        EmailVerificationCode code = activeCode("123456", 0);
        code.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        givenActiveCode(code);

        assertThatThrownBy(() -> authService.verifyEmail(verifyRequest("123456")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("expired");
        assertThat(code.getUsed()).isTrue();
    }

    @Test
    void noActiveCodeIsA400NotA401() {
        when(codeRepository.findTopByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(EMAIL, "signup"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.verifyEmail(verifyRequest("123456"))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void rightCodeAfterSomeMissesReturnsAVerifyToken() {
        EmailVerificationCode code = activeCode("123456", 3);
        givenActiveCode(code);

        VerifyEmailResponse response = authService.verifyEmail(verifyRequest(" 123456 "));

        assertThat(jwtUtil.parse(response.getVerificationToken(), JwtUtil.TokenType.VERIFY))
                .hasValueSatisfying(c -> {
                    assertThat(c.getSubject()).isEqualTo(EMAIL);
                    assertThat(c.get(JwtUtil.CLAIM_PURPOSE, String.class)).isEqualTo("signup");
                });
        // a verify token must never pass as an access token
        assertThat(jwtUtil.parse(response.getVerificationToken(), JwtUtil.TokenType.ACCESS)).isEmpty();
        verify(codeRepository).markAllUsedByEmailAndPurpose(EMAIL, "signup");
    }

    // ── Sending codes: throttle, failures, enumeration ───────────────────────

    @Test
    void secondSignupCodeWithinAMinuteIs429AndSendsNothing() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        authService.initiateSignup(signup("Siti@Example.com "));
        assertThatThrownBy(() -> authService.initiateSignup(signup(EMAIL)))
                .isInstanceOf(TooManyRequestsException.class);

        verify(emailService, times(1)).sendVerificationCode(eq(EMAIL), anyString(), eq("signup"));
        verify(codeRepository, times(1)).save(any(EmailVerificationCode.class));
    }

    @Test
    void signupCodeIsSixDigitsAndStartsWithZeroAttempts() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        authService.initiateSignup(signup(EMAIL));

        ArgumentCaptor<EmailVerificationCode> saved = ArgumentCaptor.forClass(EmailVerificationCode.class);
        verify(codeRepository).save(saved.capture());
        assertThat(saved.getValue().getCode()).matches("\\d{6}");
        assertThat(saved.getValue().getAttempts()).isZero();
        assertThat(saved.getValue().getExpiresAt()).isAfter(LocalDateTime.now().plusMinutes(9));
        verify(emailService).sendVerificationCode(EMAIL, saved.getValue().getCode(), "signup");
    }

    @Test
    void signupMailFailureSurfacesAsEmailDeliveryException() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
        doThrow(new EmailDeliveryException("We couldn't send the email right now.", null))
                .when(emailService).sendVerificationCode(eq(EMAIL), anyString(), eq("signup"));

        assertThatThrownBy(() -> authService.initiateSignup(signup(EMAIL)))
                .isInstanceOf(EmailDeliveryException.class);
    }

    @Test
    void signupForAVerifiedAccountIs409WithoutUsingTheThrottle() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(verifiedUser()));

        assertThatThrownBy(() -> authService.initiateSignup(signup(EMAIL)))
                .isInstanceOf(UserAlreadyExistsException.class);
        verify(emailService, never()).sendVerificationCode(anyString(), anyString(), anyString());
    }

    @Test
    void forgotPasswordLooksTheSameForUnknownAndKnownEmails() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(verifiedUser()));

        String unknown = authService.forgotPassword(forgot("nobody@example.com")).getMessage();
        String known = authService.forgotPassword(forgot(EMAIL)).getMessage();

        assertThat(unknown).isEqualTo(known).isEqualTo(AuthService.FORGOT_PASSWORD_MESSAGE);
        verify(emailService, times(1)).sendVerificationCodeAsync(eq(EMAIL), anyString(), eq("forgot_password"));
        verify(emailService, never()).sendVerificationCodeAsync(eq("nobody@example.com"), anyString(), anyString());
    }

    @Test
    void forgotPasswordThrottlesUnknownEmailsToo() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        authService.forgotPassword(forgot("nobody@example.com"));
        assertThatThrownBy(() -> authService.forgotPassword(forgot("nobody@example.com")))
                .isInstanceOf(TooManyRequestsException.class);
    }

    // ── Verification token use ───────────────────────────────────────────────

    @Test
    void resetPasswordRevokesEverySession() {
        User user = verifiedUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("new-password-123")).thenReturn("hashed");

        ResetPasswordRequest req = new ResetPasswordRequest();
        req.setEmail(EMAIL);
        req.setVerificationToken(jwtUtil.generateVerificationToken(EMAIL, "forgot_password"));
        req.setNewPassword("new-password-123");
        authService.resetPassword(req);

        assertThat(user.getPasswordHash()).isEqualTo("hashed");
        verify(tokenService).revokeAllForUser(7L);
    }

    @Test
    void resetPasswordRefusesASignupTokenAndAnAccessToken() {
        ResetPasswordRequest req = new ResetPasswordRequest();
        req.setEmail(EMAIL);
        req.setNewPassword("new-password-123");

        req.setVerificationToken(jwtUtil.generateVerificationToken(EMAIL, "signup"));
        assertThatThrownBy(() -> authService.resetPassword(req)).isInstanceOf(InvalidTokenException.class);

        req.setVerificationToken(jwtUtil.generateAccessToken(verifiedUser()));
        assertThatThrownBy(() -> authService.resetPassword(req)).isInstanceOf(InvalidTokenException.class);
        verify(tokenService, never()).revokeAllForUser(any());
    }

    @Test
    void resetPasswordRefusesATokenForAnotherEmail() {
        ResetPasswordRequest req = new ResetPasswordRequest();
        req.setEmail("aiman@example.com");
        req.setNewPassword("new-password-123");
        req.setVerificationToken(jwtUtil.generateVerificationToken(EMAIL, "forgot_password"));

        assertThatThrownBy(() -> authService.resetPassword(req)).isInstanceOf(BadRequestException.class);
    }

    // ── Login ────────────────────────────────────────────────────────────────

    @Test
    void loginWithUnknownEmailIsBadCredentials() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("nobody@example.com", "whatever1")))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void loginToGoogleOnlyAccountExplainsWhy() {
        User google = verifiedUser();
        google.setPasswordHash(null);
        google.setAuthProvider(User.AuthProvider.google);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(google));

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMAIL, "whatever1")))
                .isInstanceOf(DisabledException.class)
                .hasMessageContaining("Google");
    }

    // ── Fixtures ─────────────────────────────────────────────────────────────

    private void givenActiveCode(EmailVerificationCode code) {
        when(codeRepository.findTopByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(EMAIL, "signup"))
                .thenReturn(Optional.of(code));
    }

    private static EmailVerificationCode activeCode(String value, int attempts) {
        return EmailVerificationCode.builder()
                .id(1L)
                .email(EMAIL)
                .code(value)
                .purpose("signup")
                .attempts(attempts)
                .used(false)
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .build();
    }

    private static User verifiedUser() {
        return User.builder().id(7L).email(EMAIL).name("Siti").passwordHash("old-hash").emailVerified(true).build();
    }

    private static VerifyEmailRequest verifyRequest(String code) {
        VerifyEmailRequest req = new VerifyEmailRequest();
        req.setEmail(EMAIL);
        req.setCode(code);
        req.setPurpose("signup");
        return req;
    }

    private static InitiateSignupRequest signup(String email) {
        InitiateSignupRequest req = new InitiateSignupRequest();
        req.setEmail(email);
        return req;
    }

    private static ForgotPasswordRequest forgot(String email) {
        return new ForgotPasswordRequest(email);
    }
}

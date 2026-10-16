package com.travelluhh.service;

import com.travelluhh.dto.auth.*;
import com.travelluhh.entity.EmailVerificationCode;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.exception.InvalidTokenException;
import com.travelluhh.exception.UserAlreadyExistsException;
import com.travelluhh.repository.EmailVerificationCodeRepository;
import com.travelluhh.repository.UserRepository;
import com.travelluhh.security.OtpRateLimiter;
import com.travelluhh.security.TokenService;
import com.travelluhh.util.JwtUtil;
import io.jsonwebtoken.Claims;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Locale;

/**
 * Email sign-up (initiate → verify → complete), login, forgot/reset password, refresh and logout.
 *
 * Status codes the frontend relies on: wrong or expired emailed code → 400; wrong password → 401;
 * resend too soon → 429; mail server down on sign-up → 503; bad verification or refresh token → 401.
 */
@Slf4j
@Service
@Transactional
public class AuthService {

    public static final String PURPOSE_SIGNUP = "signup";
    public static final String PURPOSE_RESET = "forgot_password";
    static final int MAX_CODE_ATTEMPTS = 5;
    static final String FORGOT_PASSWORD_MESSAGE =
            "If an account uses that email, we've sent a 6-digit code to it. Not there? Check spam.";

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final EmailVerificationCodeRepository codeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EmailService emailService;
    private final TokenService tokenService;
    private final OtpRateLimiter otpRateLimiter;
    private final int codeExpiryMinutes;
    private volatile String dummyHash;

    public AuthService(UserRepository userRepository,
                       EmailVerificationCodeRepository codeRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       EmailService emailService,
                       TokenService tokenService,
                       OtpRateLimiter otpRateLimiter,
                       @Value("${app.email.verification-expiry-minutes:10}") int codeExpiryMinutes) {
        this.userRepository = userRepository;
        this.codeRepository = codeRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.emailService = emailService;
        this.tokenService = tokenService;
        this.otpRateLimiter = otpRateLimiter;
        this.codeExpiryMinutes = codeExpiryMinutes;
    }

    // ── Sign-up step 1: email a code ─────────────────────────────────────────

    public MessageResponse initiateSignup(InitiateSignupRequest request) {
        String email = normalise(request.getEmail());

        userRepository.findByEmail(email).ifPresent(existing -> {
            if (Boolean.TRUE.equals(existing.getEmailVerified())) {
                throw new UserAlreadyExistsException("An account already uses this email. Log in instead.");
            }
        });

        otpRateLimiter.acquire(email, PURPOSE_SIGNUP);
        String code = createCode(email, PURPOSE_SIGNUP);
        // Synchronous: a mail failure becomes a 503 and rolls the code back, instead of a false "code sent".
        emailService.sendVerificationCode(email, code, PURPOSE_SIGNUP);
        return new MessageResponse("We sent a 6-digit code to " + email + ". Not there? Check spam.");
    }

    // ── Sign-up step 2 / reset step 2: check the code ────────────────────────

    /** Wrong guesses must be saved even though the request fails, hence noRollbackFor. */
    @Transactional(noRollbackFor = BadRequestException.class)
    public VerifyEmailResponse verifyEmail(VerifyEmailRequest request) {
        String email = normalise(request.getEmail());
        String purpose = request.getPurpose();
        checkCode(email, request.getCode().trim(), purpose);

        codeRepository.markAllUsedByEmailAndPurpose(email, purpose);
        String verificationToken = jwtUtil.generateVerificationToken(email, purpose);
        return new VerifyEmailResponse(verificationToken, "Email verified.");
    }

    // ── Sign-up step 3: create the account ───────────────────────────────────

    public LoginResponse completeSignup(CompleteSignupRequest request) {
        String email = verifiedEmail(request.getVerificationToken(), PURPOSE_SIGNUP,
                "This sign-up step has expired. Start again to get a new code.");

        User user = userRepository.findByEmail(email)
                .orElseGet(() -> User.builder().email(email).authProvider(User.AuthProvider.local).build());

        if (Boolean.TRUE.equals(user.getEmailVerified())) {
            throw new UserAlreadyExistsException("An account already uses this email. Log in instead.");
        }

        user.setName(request.getName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setEmailVerified(true);

        // The Register profile step collects home country and currency; with both, onboarding is done.
        boolean hasHome = notBlank(request.getCountry()) && notBlank(request.getCurrency());
        if (hasHome) {
            user.setCountry(request.getCountry().toUpperCase(Locale.ROOT));
            user.setCurrency(request.getCurrency().toUpperCase(Locale.ROOT));
        }
        user.setOnboardingCompleted(hasHome);

        user = userRepository.save(user);
        return tokenService.issueSession(user);
    }

    // ── Login ────────────────────────────────────────────────────────────────

    public LoginResponse login(LoginRequest request) {
        String email = normalise(request.getEmail());
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            // Spend the same bcrypt time as a real check so response timing doesn't reveal unknown emails.
            passwordEncoder.matches(request.getPassword(), timingDummyHash());
            throw new BadCredentialsException("unknown email");
        }

        if (!user.hasPassword()) {
            // Reveals only that the address uses Google sign-in, which /initiate-signup's 409 reveals anyway.
            throw new DisabledException(
                    "This account signs in with Google. Use Continue with Google, or reset your password to add one.");
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("wrong password");
        }
        if (!Boolean.TRUE.equals(user.getEmailVerified())) {
            throw new DisabledException("This email isn't verified yet. Finish signing up first.");
        }
        return tokenService.issueSession(user);
    }

    // ── Forgot password ──────────────────────────────────────────────────────

    /**
     * Same 200 and message whether or not the email has an account. The throttle runs before the lookup,
     * so a 429 doesn't give it away either.
     */
    public MessageResponse forgotPassword(ForgotPasswordRequest request) {
        String email = normalise(request.getEmail());
        otpRateLimiter.acquire(email, PURPOSE_RESET);

        userRepository.findByEmail(email)
                .filter(u -> Boolean.TRUE.equals(u.getEmailVerified()))
                .ifPresent(u -> {
                    String code = createCode(email, PURPOSE_RESET);
                    emailService.sendVerificationCodeAsync(email, code, PURPOSE_RESET);
                });
        return new MessageResponse(FORGOT_PASSWORD_MESSAGE);
    }

    // ── Reset password ───────────────────────────────────────────────────────

    public MessageResponse resetPassword(ResetPasswordRequest request) {
        String email = verifiedEmail(request.getVerificationToken(), PURPOSE_RESET,
                "This reset step has expired. Ask for a new code.");
        if (request.getEmail() == null || !email.equals(normalise(request.getEmail()))) {
            throw new BadRequestException("This code was sent to a different email address.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidTokenException("This reset step has expired. Ask for a new code."));

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        tokenService.revokeAllForUser(user.getId());

        return new MessageResponse("Password updated. Log in with your new password.");
    }

    // ── Sessions ─────────────────────────────────────────────────────────────

    public LoginResponse refreshToken(String refreshToken) {
        return tokenService.rotate(refreshToken);
    }

    public void logout(String refreshToken) {
        tokenService.revoke(refreshToken);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String timingDummyHash() {
        String hash = dummyHash;
        if (hash == null) {
            hash = passwordEncoder.encode("timing-equaliser-" + RANDOM.nextLong());
            dummyHash = hash;
        }
        return hash;
    }

    /** Burns any earlier unused codes for this email + purpose, then stores and returns a fresh one. */
    private String createCode(String email, String purpose) {
        codeRepository.markAllUsedByEmailAndPurpose(email, purpose);
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        codeRepository.save(EmailVerificationCode.builder()
                .email(email)
                .code(code)
                .purpose(purpose)
                .attempts(0)
                .used(false)
                .expiresAt(LocalDateTime.now().plusMinutes(codeExpiryMinutes))
                .build());
        return code;
    }

    private void checkCode(String email, String code, String purpose) {
        EmailVerificationCode record = codeRepository
                .findTopByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(email, purpose)
                .orElseThrow(() -> new BadRequestException("There's no active code for this email. Ask for a new one."));

        if (record.isExpired()) {
            record.setUsed(true);
            codeRepository.save(record);
            throw new BadRequestException("That code has expired. Ask for a new one.");
        }
        if (record.attemptsSoFar() >= MAX_CODE_ATTEMPTS) {
            record.setUsed(true);
            codeRepository.save(record);
            throw new BadRequestException("Too many wrong tries. Ask for a new code.");
        }
        if (!constantTimeEquals(record.getCode(), code)) {
            int attempts = record.attemptsSoFar() + 1;
            record.setAttempts(attempts);
            int left = MAX_CODE_ATTEMPTS - attempts;
            if (left <= 0) {
                record.setUsed(true);
            }
            codeRepository.save(record);
            throw new BadRequestException(left <= 0
                    ? "That code doesn't match, and that was the last try. Ask for a new code."
                    : "That code doesn't match. " + left + (left == 1 ? " try" : " tries") + " left.");
        }
    }

    /** Email from a typ=verify token issued for {@code purpose}; anything else is a 401. */
    private String verifiedEmail(String token, String purpose, String expiredMessage) {
        Claims claims = jwtUtil.parse(token, JwtUtil.TokenType.VERIFY)
                .orElseThrow(() -> new InvalidTokenException(expiredMessage));
        if (!purpose.equals(claims.get(JwtUtil.CLAIM_PURPOSE, String.class))) {
            throw new InvalidTokenException(expiredMessage);
        }
        return normalise(claims.getSubject());
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        if (expected == null || actual == null) return false;
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }

    private static String normalise(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}

package com.travelluhh.security;

import com.travelluhh.exception.TooManyRequestsException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OtpRateLimiterTest {

    /** A clock the test moves by hand. */
    static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-10-15T09:00:00Z");

        void advance(Duration d) { now = now.plus(d); }

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private final MutableClock clock = new MutableClock();
    private final OtpRateLimiter limiter = new OtpRateLimiter(clock);

    @Test
    void secondRequestWithinSixtySecondsIsRefusedWithRetryAfter() {
        limiter.acquire("siti@example.com", "signup");
        clock.advance(Duration.ofSeconds(20));

        assertThatThrownBy(() -> limiter.acquire("siti@example.com", "signup"))
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessageContaining("40 seconds")
                .satisfies(e -> assertThat(((TooManyRequestsException) e).getRetryAfterSeconds()).isEqualTo(40));
    }

    @Test
    void requestAfterCooldownIsAllowed() {
        limiter.acquire("siti@example.com", "signup");
        clock.advance(Duration.ofSeconds(60));
        assertThatCode(() -> limiter.acquire("siti@example.com", "signup")).doesNotThrowAnyException();
    }

    @Test
    void atMostFivePerHour() {
        for (int i = 0; i < 5; i++) {
            limiter.acquire("siti@example.com", "forgot_password");
            clock.advance(Duration.ofSeconds(61));
        }
        assertThatThrownBy(() -> limiter.acquire("siti@example.com", "forgot_password"))
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessageContaining("5 codes in the last hour");

        // the first of the five falls out of the window an hour after it was made
        clock.advance(Duration.ofHours(1).minus(Duration.ofSeconds(5 * 61)));
        assertThatCode(() -> limiter.acquire("siti@example.com", "forgot_password")).doesNotThrowAnyException();
    }

    @Test
    void refusedRequestsDoNotExtendTheCooldown() {
        limiter.acquire("siti@example.com", "signup");
        clock.advance(Duration.ofSeconds(30));
        assertThatThrownBy(() -> limiter.acquire("siti@example.com", "signup")).isInstanceOf(TooManyRequestsException.class);
        clock.advance(Duration.ofSeconds(30));
        assertThatCode(() -> limiter.acquire("siti@example.com", "signup")).doesNotThrowAnyException();
    }

    @Test
    void emailsAndPurposesAreThrottledSeparately() {
        limiter.acquire("siti@example.com", "signup");
        assertThatCode(() -> limiter.acquire("aiman@example.com", "signup")).doesNotThrowAnyException();
        assertThatCode(() -> limiter.acquire("siti@example.com", "forgot_password")).doesNotThrowAnyException();
    }
}

package com.travelluhh.security;

import com.travelluhh.exception.TooManyRequestsException;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Throttles "send me a code" requests per email + purpose: one every 60 seconds, at most 5 an hour.
 *
 * It counts requests, not emails actually sent, so an unknown address on /forgot-password is throttled exactly
 * like a real one and the 429 can't be used to find out which emails have accounts. In memory on purpose:
 * one backend instance, and losing the window on restart only means one extra code.
 */
@Component
public class OtpRateLimiter {

    static final Duration COOLDOWN = Duration.ofSeconds(60);
    static final Duration WINDOW = Duration.ofHours(1);
    static final int MAX_PER_WINDOW = 5;
    private static final int PRUNE_THRESHOLD = 10_000;

    private final Clock clock;
    private final Map<String, Deque<Instant>> requests = new ConcurrentHashMap<>();

    public OtpRateLimiter() {
        this(Clock.systemUTC());
    }

    OtpRateLimiter(Clock clock) {
        this.clock = clock;
    }

    /**
     * Records a request, or throws {@link TooManyRequestsException} (429) without recording it.
     * Check-and-record is atomic per key.
     */
    public void acquire(String email, String purpose) {
        Instant now = clock.instant();
        if (requests.size() > PRUNE_THRESHOLD) {
            pruneStale(now);
        }
        requests.compute(purpose + ':' + email, (key, times) -> {
            Deque<Instant> deque = times != null ? times : new ArrayDeque<>();
            while (!deque.isEmpty() && !deque.peekFirst().isAfter(now.minus(WINDOW))) {
                deque.pollFirst();
            }
            Instant last = deque.peekLast();
            if (last != null && last.plus(COOLDOWN).isAfter(now)) {
                long wait = Math.max(1, Duration.between(now, last.plus(COOLDOWN)).toSeconds());
                throw new TooManyRequestsException(
                        "We just sent a code. Wait " + wait + " seconds before asking for another.", wait);
            }
            if (deque.size() >= MAX_PER_WINDOW) {
                Instant freeAt = deque.peekFirst().plus(WINDOW);
                long waitSeconds = Math.max(1, Duration.between(now, freeAt).toSeconds());
                long minutes = Math.max(1, (waitSeconds + 59) / 60);
                throw new TooManyRequestsException(
                        "That's " + MAX_PER_WINDOW + " codes in the last hour for this email. Try again in "
                                + minutes + (minutes == 1 ? " minute." : " minutes."), waitSeconds);
            }
            deque.addLast(now);
            return deque;
        });
    }

    private void pruneStale(Instant now) {
        Instant cutoff = now.minus(WINDOW);
        // per-key compute keeps each ArrayDeque touched by one thread at a time; returning null drops the key
        for (String key : requests.keySet()) {
            requests.computeIfPresent(key, (k, times) -> {
                Instant last = times.peekLast();
                return last == null || !last.isAfter(cutoff) ? null : times;
            });
        }
    }
}

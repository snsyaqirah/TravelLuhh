package com.travelluhh.util;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

class DecimalsTest {

    private static BigDecimal d(String s) {
        return new BigDecimal(s);
    }

    @Test
    void countsDigitsBeforeThePoint() {
        assertThat(Decimals.integerDigits(d("123.45"))).isEqualTo(3);
        assertThat(Decimals.integerDigits(d("-123.45"))).isEqualTo(3);
        assertThat(Decimals.integerDigits(d("0.5"))).isZero();
        assertThat(Decimals.integerDigits(d("0.00"))).isZero();
        assertThat(Decimals.integerDigits(d("1.2E+3"))).isEqualTo(4);
        assertThat(Decimals.integerDigits(d("9999999999.99"))).isEqualTo(10);
    }

    @Test
    void countsDecimalsThatCarryADigit() {
        assertThat(Decimals.fractionDigits(d("12.5"))).isEqualTo(1);
        assertThat(Decimals.fractionDigits(d("12.5000"))).isEqualTo(1);
        assertThat(Decimals.fractionDigits(d("12.05"))).isEqualTo(2);
        assertThat(Decimals.fractionDigits(d("1200"))).isZero();
        assertThat(Decimals.fractionDigits(d("1200.000"))).isZero();
        assertThat(Decimals.fractionDigits(d("0"))).isZero();
        assertThat(Decimals.fractionDigits(d("0.030854674"))).isEqualTo(9);
    }

    @Test
    void fitsChecksBothSidesAndAcceptsNull() {
        assertThat(Decimals.fits(null, 10, 2)).isTrue();
        assertThat(Decimals.fits(d("9999999999.99"), 10, 2)).isTrue();
        assertThat(Decimals.fits(d("10000000000"), 10, 2)).isFalse();
        assertThat(Decimals.fits(d("1.005"), 10, 2)).isFalse();
        assertThat(Decimals.fits(d("1.000"), 10, 2)).isTrue();
        assertThat(Decimals.fits(d("-80.50"), 10, 2)).isTrue();
    }

    @Test
    void hugeExponentsAreAnsweredAtOnce() {
        // setScale on any of these would build a power of ten with millions of digits.
        assertTimeoutPreemptively(Duration.ofMillis(500), () -> {
            assertThat(Decimals.fits(d("1e-20000000"), 10, 16)).isFalse();
            assertThat(Decimals.fits(d("1e20000000"), 10, 16)).isFalse();
            assertThat(Decimals.fits(d("-1e20000000"), 10, 2)).isFalse();
            assertThat(Decimals.fits(d("1e2147483647"), 10, 2)).isFalse();
            assertThat(Decimals.fits(d("1e-2147483647"), 10, 2)).isFalse();
            assertThat(Decimals.fractionDigits(d("1e-20000000"))).isEqualTo(20_000_000L);
            assertThat(Decimals.integerDigits(d("1e20000000"))).isEqualTo(20_000_001L);
            // Zero written with a huge exponent is still just zero.
            assertThat(Decimals.fits(d("0e20000000"), 10, 2)).isTrue();
            assertThat(Decimals.fits(d("0e-20000000"), 10, 2)).isTrue();
        });
    }
}

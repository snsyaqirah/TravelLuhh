package com.travelluhh.util;

import java.math.BigDecimal;

/**
 * Cheap size checks for decimals that come from clients, to run before any setScale, rounding or
 * division.
 *
 * Why: a JSON number like 1e-20000000 or 1e20000000 parses into a tiny BigDecimal (unscaled value 1,
 * scale ±20,000,000), but setScale on it builds a 20-million-digit power of ten, which took about
 * 10 seconds of CPU per request. These helpers only read precision() and scale() (plus
 * stripTrailingZeros(), which works on the digits that are actually there and never expands the
 * exponent), so they answer in microseconds whatever the exponent is.
 */
public final class Decimals {

    private Decimals() {
    }

    /** Digits before the decimal point: 3 for 123.45, 0 for 0.5 and for 0. Huge for 1e20000000. */
    public static long integerDigits(BigDecimal value) {
        if (value == null || value.signum() == 0) {
            return 0;
        }
        return Math.max(0L, (long) value.precision() - value.scale());
    }

    /** Decimal places that carry a digit: 2 for 12.50 and 12.5000 alike, 0 for 1200. Huge for 1e-20000000. */
    public static long fractionDigits(BigDecimal value) {
        if (value == null || value.signum() == 0 || value.scale() <= 0) {
            return 0;
        }
        return Math.max(0L, value.stripTrailingZeros().scale());
    }

    /**
     * True when value has at most maxInteger digits before the point and maxFraction decimal places
     * (trailing zeros don't count, so 12.500 fits 2). Null fits; required-ness is checked elsewhere.
     */
    public static boolean fits(BigDecimal value, int maxInteger, int maxFraction) {
        if (value == null) {
            return true;
        }
        return integerDigits(value) <= maxInteger && fractionDigits(value) <= maxFraction;
    }
}

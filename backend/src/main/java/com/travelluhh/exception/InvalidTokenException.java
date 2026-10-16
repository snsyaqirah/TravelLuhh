package com.travelluhh.exception;

/**
 * A JWT (refresh or verification) is missing, malformed, expired, revoked or of the wrong type.
 * Mapped to HTTP 401. Not used for wrong OTP codes, which are a 400.
 */
public class InvalidTokenException extends RuntimeException {
    public InvalidTokenException(String message) {
        super(message);
    }
}

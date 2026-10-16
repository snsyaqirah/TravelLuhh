package com.travelluhh.exception;

/** Mapped to HTTP 409 by GlobalExceptionHandler. The message is shown to the user. */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}

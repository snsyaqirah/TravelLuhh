package com.travelluhh.exception;

/** Mapped to HTTP 403 by GlobalExceptionHandler. The message is shown to the user. */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}

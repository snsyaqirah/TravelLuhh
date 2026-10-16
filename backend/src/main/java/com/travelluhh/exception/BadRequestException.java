package com.travelluhh.exception;

/** Mapped to HTTP 400 by GlobalExceptionHandler. The message is shown to the user. */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}

package com.travelluhh.exception;

/** Mapped to HTTP 404 by GlobalExceptionHandler. The message is shown to the user. */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}

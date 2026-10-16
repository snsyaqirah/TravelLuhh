package com.travelluhh.exception;

/** The mail server refused or couldn't be reached. Mapped to HTTP 503 by GlobalExceptionHandler. */
public class EmailDeliveryException extends RuntimeException {
    public EmailDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}

package com.travelluhh.exception;

/** An account already uses this email. Mapped to HTTP 409. */
public class UserAlreadyExistsException extends ConflictException {
    public UserAlreadyExistsException(String message) {
        super(message);
    }
}

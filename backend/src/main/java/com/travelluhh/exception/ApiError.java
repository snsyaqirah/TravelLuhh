package com.travelluhh.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * The one error body every 4xx/5xx returns (API contract, "Conventions").
 * {@code fieldErrors} is only present on 400 validation failures.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(
        int status,
        String error,
        String message,
        String path,
        String timestamp,
        Map<String, String> fieldErrors
) {

    private static final DateTimeFormatter TIMESTAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    public static ApiError of(HttpStatusCode status, String message, String path) {
        return of(status, message, path, null);
    }

    public static ApiError of(HttpStatusCode status, String message, String path, Map<String, String> fieldErrors) {
        HttpStatus resolved = HttpStatus.resolve(status.value());
        String reason = resolved != null ? resolved.getReasonPhrase() : "Error";
        return new ApiError(
                status.value(),
                reason,
                message,
                path,
                LocalDateTime.now().format(TIMESTAMP),
                fieldErrors == null || fieldErrors.isEmpty() ? null : fieldErrors
        );
    }
}

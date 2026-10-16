package com.travelluhh.exception;

import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Turns every exception into the contract error body ({@link ApiError}).
 *
 * Extends {@link ResponseEntityExceptionHandler} so Spring MVC's own exceptions (bad JSON, unknown route,
 * wrong method, missing header) get the same shape instead of ProblemDetail or a 500.
 * User errors never become a 500, and stack traces are logged, never returned.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    static final String GENERIC_500 = "Something went wrong on our side.";

    /** Messages that look like they came from a library rather than from us (class names, SQL). */
    private static final Pattern TECHNICAL = Pattern.compile("(\\b[a-z]+\\.[a-z]+\\.[A-Za-z])|(\\bSQL\\b)|(Exception)");

    // ── Our own exceptions ───────────────────────────────────────────────────

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(NotFoundException ex, HttpServletRequest req) {
        return respond(HttpStatus.NOT_FOUND, ex.getMessage(), req);
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ApiError> handleForbidden(ForbiddenException ex, HttpServletRequest req) {
        return respond(HttpStatus.FORBIDDEN, ex.getMessage(), req);
    }

    /** Also covers {@link UserAlreadyExistsException}, which extends ConflictException. */
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ApiError> handleConflict(ConflictException ex, HttpServletRequest req) {
        return respond(HttpStatus.CONFLICT, ex.getMessage(), req);
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ApiError> handleBadRequest(BadRequestException ex, HttpServletRequest req) {
        return respond(HttpStatus.BAD_REQUEST, ex.getMessage(), req);
    }

    @ExceptionHandler(InvalidTokenException.class)
    public ResponseEntity<ApiError> handleInvalidToken(InvalidTokenException ex, HttpServletRequest req) {
        return respond(HttpStatus.UNAUTHORIZED, ex.getMessage(), req);
    }

    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<ApiError> handleTooManyRequests(TooManyRequestsException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()))
                .body(ApiError.of(HttpStatus.TOO_MANY_REQUESTS, ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(EmailDeliveryException.class)
    public ResponseEntity<ApiError> handleEmailDelivery(EmailDeliveryException ex, HttpServletRequest req) {
        return respond(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage(), req);
    }

    // ── Spring Security ──────────────────────────────────────────────────────

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException ex, HttpServletRequest req) {
        return respond(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.", req);
    }

    /** Thrown by AuthService.login with a specific, user-facing message (unverified or Google-only account). */
    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<ApiError> handleDisabled(DisabledException ex, HttpServletRequest req) {
        return respond(HttpStatus.UNAUTHORIZED, ex.getMessage(), req);
    }

    @ExceptionHandler(UsernameNotFoundException.class)
    public ResponseEntity<ApiError> handleUserNotFound(UsernameNotFoundException ex, HttpServletRequest req) {
        return respond(HttpStatus.NOT_FOUND, "We couldn't find that account.", req);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuthentication(AuthenticationException ex, HttpServletRequest req) {
        return respond(HttpStatus.UNAUTHORIZED, "Log in to continue.", req);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex, HttpServletRequest req) {
        return respond(HttpStatus.FORBIDDEN, "You don't have access to that.", req);
    }

    @ExceptionHandler(JwtException.class)
    public ResponseEntity<ApiError> handleJwt(JwtException ex, HttpServletRequest req) {
        return respond(HttpStatus.UNAUTHORIZED, "Your session has ended. Log in again.", req);
    }

    // ── Validation and bad input outside Spring MVC's binding ────────────────

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest req) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (ConstraintViolation<?> v : ex.getConstraintViolations()) {
            fieldErrors.putIfAbsent(lastNode(v.getPropertyPath().toString()), v.getMessage());
        }
        String message = fieldErrors.values().stream().findFirst().orElse("Check the highlighted fields.");
        return ResponseEntity.badRequest()
                .body(ApiError.of(HttpStatus.BAD_REQUEST, message, req.getRequestURI(), fieldErrors));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException ex, HttpServletRequest req) {
        String message = ex.getMessage();
        if (message == null || message.isBlank() || TECHNICAL.matcher(message).find()) {
            log.debug("IllegalArgumentException on {}: {}", req.getRequestURI(), message);
            message = "That request isn't valid.";
        }
        return respond(HttpStatus.BAD_REQUEST, message, req);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleDataIntegrity(DataIntegrityViolationException ex, HttpServletRequest req) {
        // The root cause names tables and constraints, so it stays in the log.
        log.warn("Data integrity violation on {}: {}", req.getRequestURI(), ex.getMostSpecificCause().getMessage());
        return respond(HttpStatus.CONFLICT, "That clashes with something already saved. Refresh and try again.", req);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex, HttpServletRequest req) {
        log.error("Unhandled exception on {} {}", req.getMethod(), req.getRequestURI(), ex);
        return respond(HttpStatus.INTERNAL_SERVER_ERROR, GENERIC_500, req);
    }

    // ── Spring MVC exceptions (overrides of ResponseEntityExceptionHandler) ──

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            @NonNull MethodArgumentNotValidException ex, @NonNull HttpHeaders headers,
            @NonNull HttpStatusCode status, @NonNull WebRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        String firstMessage = null;
        for (ObjectError error : ex.getBindingResult().getAllErrors()) {
            String msg = error.getDefaultMessage();
            if (firstMessage == null) firstMessage = msg;
            if (error instanceof FieldError fe) {
                fieldErrors.putIfAbsent(fe.getField(), msg);
            }
        }
        String message = firstMessage != null ? firstMessage : "Check the highlighted fields.";
        return ResponseEntity.badRequest()
                .body(ApiError.of(HttpStatus.BAD_REQUEST, message, pathOf(request), fieldErrors));
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            @NonNull HttpMessageNotReadableException ex, @NonNull HttpHeaders headers,
            @NonNull HttpStatusCode status, @NonNull WebRequest request) {
        return ResponseEntity.badRequest()
                .body(ApiError.of(HttpStatus.BAD_REQUEST, unreadableMessage(ex), pathOf(request)));
    }

    @Override
    protected ResponseEntity<Object> handleTypeMismatch(
            @NonNull TypeMismatchException ex, @NonNull HttpHeaders headers,
            @NonNull HttpStatusCode status, @NonNull WebRequest request) {
        String name = ex instanceof MethodArgumentTypeMismatchException m ? m.getName() : ex.getPropertyName();
        String message = describeExpected(name != null ? name : "A value", ex.getRequiredType(), ex.getValue());
        return ResponseEntity.badRequest().body(ApiError.of(HttpStatus.BAD_REQUEST, message, pathOf(request)));
    }

    @Override
    protected ResponseEntity<Object> handleHandlerMethodValidationException(
            @NonNull HandlerMethodValidationException ex, @NonNull HttpHeaders headers,
            @NonNull HttpStatusCode status, @NonNull WebRequest request) {
        String message = ex.getAllValidationResults().stream()
                .flatMap(r -> r.getResolvableErrors().stream())
                .map(e -> e.getDefaultMessage())
                .filter(m -> m != null && !m.isBlank())
                .findFirst()
                .orElse("That request isn't valid.");
        return ResponseEntity.badRequest().body(ApiError.of(HttpStatus.BAD_REQUEST, message, pathOf(request)));
    }

    /** Every other Spring MVC exception lands here; replace ProblemDetail with our body. */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            @NonNull Exception ex, @Nullable Object body, @NonNull HttpHeaders headers,
            @NonNull HttpStatusCode statusCode, @NonNull WebRequest request) {
        if (statusCode.is5xxServerError()) {
            log.error("Request failed on {}", pathOf(request), ex);
        }
        return ResponseEntity.status(statusCode)
                .headers(headers)
                .body(ApiError.of(statusCode, mvcMessage(ex, statusCode), pathOf(request)));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static ResponseEntity<ApiError> respond(HttpStatus status, String message, HttpServletRequest req) {
        String safe = message == null || message.isBlank() ? defaultMessage(status) : message;
        return ResponseEntity.status(status).body(ApiError.of(status, safe, req.getRequestURI()));
    }

    private static String pathOf(WebRequest request) {
        if (request instanceof ServletWebRequest swr) {
            return swr.getRequest().getRequestURI();
        }
        return null;
    }

    private static String mvcMessage(Exception ex, HttpStatusCode status) {
        if (ex instanceof ResponseStatusException rse && rse.getReason() != null && !rse.getReason().isBlank()) {
            return rse.getReason();
        }
        if (ex instanceof MissingRequestHeaderException m) {
            return "The " + m.getHeaderName() + " header is missing.";
        }
        if (ex instanceof MissingServletRequestParameterException m) {
            return "The '" + m.getParameterName() + "' parameter is missing.";
        }
        if (ex instanceof HttpRequestMethodNotSupportedException m) {
            return m.getMethod() + " isn't supported on this address.";
        }
        if (ex instanceof HttpMediaTypeNotSupportedException) {
            return "Send the request body as JSON.";
        }
        if (ex instanceof NoResourceFoundException || ex instanceof NoHandlerFoundException) {
            return "There's nothing at this address.";
        }
        return defaultMessage(status);
    }

    static String defaultMessage(HttpStatusCode status) {
        return switch (status.value()) {
            case 400 -> "That request isn't valid.";
            case 401 -> "Log in to continue.";
            case 403 -> "You don't have access to that.";
            case 404 -> "We couldn't find that.";
            case 405 -> "That method isn't allowed here.";
            case 409 -> "That clashes with something already saved.";
            case 413 -> "That's too large.";
            case 415 -> "Send the request body as JSON.";
            case 429 -> "Too many requests. Wait a moment and try again.";
            case 503 -> "This is unavailable right now. Try again in a moment.";
            default -> status.is5xxServerError() ? GENERIC_500 : "That request couldn't be completed.";
        };
    }

    /** Explains a bad JSON body in words a person can act on, e.g. a misspelt enum or a date in the wrong format. */
    static String unreadableMessage(HttpMessageNotReadableException ex) {
        Throwable cause = ex.getCause();
        if (cause instanceof InvalidFormatException ife) {
            return describeExpected(jsonPath(ife), ife.getTargetType(), ife.getValue());
        }
        if (cause instanceof MismatchedInputException mie) {
            String field = jsonPath(mie);
            if (mie.getTargetType() != null && !"A value".equals(field)) {
                return describeExpected(field, mie.getTargetType(), null);
            }
            return "The request body has a value of the wrong type.";
        }
        if (cause instanceof JsonMappingException jme && !jme.getPath().isEmpty()) {
            return jsonPath(jme) + " has a value we can't read.";
        }
        if (cause instanceof JsonParseException) {
            return "The request body isn't valid JSON.";
        }
        String msg = ex.getMessage();
        if (msg != null && msg.startsWith("Required request body is missing")) {
            return "The request body is missing.";
        }
        return "The request body couldn't be read.";
    }

    private static String jsonPath(JsonMappingException ex) {
        List<JsonMappingException.Reference> path = ex.getPath();
        if (path == null || path.isEmpty()) return "A value";
        StringBuilder sb = new StringBuilder();
        for (JsonMappingException.Reference ref : path) {
            if (ref.getFieldName() != null) {
                if (!sb.isEmpty()) sb.append('.');
                sb.append(ref.getFieldName());
            } else if (ref.getIndex() >= 0) {
                sb.append('[').append(ref.getIndex()).append(']');
            }
        }
        return sb.isEmpty() ? "A value" : sb.toString();
    }

    static String describeExpected(String field, @Nullable Class<?> type, @Nullable Object value) {
        if (type == null) return field + " has an invalid value.";
        if (type.isEnum()) {
            String allowed = Arrays.stream(type.getEnumConstants())
                    .map(Object::toString)
                    .collect(Collectors.joining(", "));
            return field + " must be one of: " + allowed + ".";
        }
        if (type == LocalDate.class) return field + " must be a date like 2026-10-15.";
        if (type == LocalTime.class) return field + " must be a time like 09:30.";
        if (type == LocalDateTime.class) return field + " must be a date and time like 2026-10-15T09:30:00.";
        if (type == Boolean.class || type == boolean.class) return field + " must be true or false.";
        if (Number.class.isAssignableFrom(type) || (type.isPrimitive() && type != char.class)) {
            return field + " must be a number" + (value != null ? ", not \"" + truncate(value) + "\"." : ".");
        }
        return field + " has an invalid value.";
    }

    private static String truncate(Object value) {
        String s = String.valueOf(value);
        return s.length() > 40 ? s.substring(0, 40) + "…" : s;
    }

    private static String lastNode(String propertyPath) {
        int dot = propertyPath.lastIndexOf('.');
        return dot >= 0 ? propertyPath.substring(dot + 1) : propertyPath;
    }
}

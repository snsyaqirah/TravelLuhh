package com.travelluhh.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.method.annotation.ExceptionHandlerMethodResolver;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

class GlobalExceptionHandlerTest {

    enum BudgetType { solo, shared, separated }

    record TripBody(String name, BudgetType budgetType, LocalDate startDate, java.math.BigDecimal budget) {}

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private String unreadable(String json) {
        Throwable cause = catchThrowable(() -> mapper.readValue(json, TripBody.class));
        return GlobalExceptionHandler.unreadableMessage(
                new HttpMessageNotReadableException("JSON parse error", cause, new MockHttpInputMessage(new byte[0])));
    }

    @Test
    void everyExceptionResolvesToExactlyOneHandler() {
        // the constructor throws on ambiguous mappings, the same check Spring runs at startup
        ExceptionHandlerMethodResolver resolver = new ExceptionHandlerMethodResolver(GlobalExceptionHandler.class);

        assertThat(resolver.resolveMethod(new UserAlreadyExistsException("x")).getName()).isEqualTo("handleConflict");
        assertThat(resolver.resolveMethod(new NotFoundException("x")).getName()).isEqualTo("handleNotFound");
        assertThat(resolver.resolveMethod(new BadCredentialsException("x")).getName()).isEqualTo("handleBadCredentials");
        assertThat(resolver.resolveMethod(new UsernameNotFoundException("x")).getName()).isEqualTo("handleUserNotFound");
        // Spring MVC's own exceptions go through ResponseEntityExceptionHandler and then handleExceptionInternal
        assertThat(resolver.resolveMethod(new ResponseStatusException(HttpStatus.GONE, "x")).getName()).isEqualTo("handleException");
        assertThat(resolver.resolveMethod(new IllegalStateException("x")).getName()).isEqualTo("handleUnexpected");
    }

    @Test
    void badEnumNamesTheAllowedValues() {
        assertThat(unreadable("{\"budgetType\":\"group\"}"))
                .isEqualTo("budgetType must be one of: solo, shared, separated.");
    }

    @Test
    void badDateShowsTheExpectedFormat() {
        assertThat(unreadable("{\"startDate\":\"15/10/2026\"}"))
                .isEqualTo("startDate must be a date like 2026-10-15.");
    }

    @Test
    void badNumberSaysItMustBeANumber() {
        assertThat(unreadable("{\"budget\":\"lots\"}")).startsWith("budget must be a number");
    }

    @Test
    void brokenJsonIsCalledOut() {
        assertThat(unreadable("{\"name\": ")).isIn("The request body isn't valid JSON.", "The request body couldn't be read.");
    }

    @Test
    void technicalIllegalArgumentMessagesAreHidden() {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/trips");
        ResponseEntity<ApiError> hidden = handler.handleIllegalArgument(
                new IllegalArgumentException("No enum constant com.travelluhh.entity.Trip.BudgetType.group"), req);
        ResponseEntity<ApiError> shown = handler.handleIllegalArgument(
                new IllegalArgumentException("End date must be on or after the start date."), req);

        assertThat(hidden.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(hidden.getBody().message()).isEqualTo("That request isn't valid.");
        assertThat(shown.getBody().message()).isEqualTo("End date must be on or after the start date.");
        assertThat(shown.getBody().path()).isEqualTo("/api/trips");
        assertThat(shown.getBody().error()).isEqualTo("Bad Request");
        assertThat(shown.getBody().fieldErrors()).isNull();
    }

    @Test
    void unexpectedExceptionsNeverLeakDetails() {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/trips/9");
        ResponseEntity<ApiError> res = handler.handleUnexpected(new IllegalStateException("password_hash is null"), req);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(res.getBody().message()).isEqualTo("Something went wrong on our side.");
    }

    @Test
    void tooManyRequestsCarriesRetryAfter() {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/forgot-password");
        ResponseEntity<ApiError> res = handler.handleTooManyRequests(new TooManyRequestsException("Wait 42 seconds.", 42), req);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(res.getHeaders().getFirst("Retry-After")).isEqualTo("42");
    }
}

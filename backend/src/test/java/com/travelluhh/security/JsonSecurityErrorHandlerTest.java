package com.travelluhh.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.InsufficientAuthenticationException;

import static org.assertj.core.api.Assertions.assertThat;

class JsonSecurityErrorHandlerTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final JsonSecurityErrorHandler handler = new JsonSecurityErrorHandler(mapper);

    @Test
    void unauthenticatedApiCallIsJson401NotARedirect() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/trips");
        req.addHeader("Authorization", "Bearer expired.token.here");
        MockHttpServletResponse res = new MockHttpServletResponse();

        handler.commence(req, res, new InsufficientAuthenticationException("no"));

        assertThat(res.getStatus()).isEqualTo(401);
        assertThat(res.getRedirectedUrl()).isNull();
        assertThat(res.getContentType()).startsWith("application/json");
        JsonNode body = mapper.readTree(res.getContentAsString());
        assertThat(body.get("status").asInt()).isEqualTo(401);
        assertThat(body.get("error").asText()).isEqualTo("Unauthorized");
        assertThat(body.get("message").asText()).isEqualTo("Your session has ended. Log in again.");
        assertThat(body.get("path").asText()).isEqualTo("/api/trips");
        assertThat(body.get("timestamp").asText()).matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}");
        assertThat(body.has("fieldErrors")).isFalse();
    }

    @Test
    void noTokenAtAllAsksToLogIn() throws Exception {
        MockHttpServletResponse res = new MockHttpServletResponse();
        handler.commence(new MockHttpServletRequest("GET", "/api/users/me"), res, new InsufficientAuthenticationException("no"));

        assertThat(mapper.readTree(res.getContentAsString()).get("message").asText()).isEqualTo("Log in to continue.");
    }

    @Test
    void accessDeniedIsJson403() throws Exception {
        MockHttpServletResponse res = new MockHttpServletResponse();
        handler.handle(new MockHttpServletRequest("DELETE", "/api/trips/9"), res, new AccessDeniedException("no"));

        assertThat(res.getStatus()).isEqualTo(403);
        assertThat(mapper.readTree(res.getContentAsString()).get("error").asText()).isEqualTo("Forbidden");
    }

    @Test
    void corsOriginsAreParsedFromCommaSeparatedConfig() {
        assertThat(SecurityConfig.parseOrigins(" http://localhost:5173 , https://travelluhh.app/ ,, "))
                .containsExactly("http://localhost:5173", "https://travelluhh.app");
        assertThat(SecurityConfig.parseOrigins(""))
                .containsExactly("http://localhost:5173", "http://localhost:5174", "http://localhost:8081");
    }
}

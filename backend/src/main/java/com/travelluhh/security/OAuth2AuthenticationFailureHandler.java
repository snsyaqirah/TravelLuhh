package com.travelluhh.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Cancelled consent, an unverified Google email, or any other OAuth failure: back to the SPA's login page with
 * {@code ?error=oauth} instead of Spring's built-in /login?error page.
 */
@Slf4j
@Component
public class OAuth2AuthenticationFailureHandler extends SimpleUrlAuthenticationFailureHandler {

    private final String frontendUrl;

    public OAuth2AuthenticationFailureHandler(@Value("${app.frontend.url:http://localhost:5173}") String frontendUrl) {
        this.frontendUrl = OAuth2AuthenticationSuccessHandler.stripTrailingSlash(frontendUrl);
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException {
        log.info("Google sign-in failed: {}", exception.getMessage());
        getRedirectStrategy().sendRedirect(request, response, frontendUrl + "/login?error=oauth");
    }
}

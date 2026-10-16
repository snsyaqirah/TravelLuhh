package com.travelluhh.security;

import com.travelluhh.dto.auth.LoginResponse;
import com.travelluhh.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

/**
 * After Google sign-in: issue a session (refresh token persisted like any other login) and hand it to the SPA
 * at {@code {frontend}/auth/callback?token=…&refresh=…&newUser=true|false}.
 * The parameter names are the ones OAuthCallback.tsx reads.
 */
@Slf4j
@Component
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final TokenService tokenService;
    private final String frontendUrl;

    public OAuth2AuthenticationSuccessHandler(
            TokenService tokenService,
            @Value("${app.frontend.url:http://localhost:5173}") String frontendUrl) {
        this.tokenService = tokenService;
        this.frontendUrl = stripTrailingSlash(frontendUrl);
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        if (!(authentication.getPrincipal() instanceof OAuth2UserPrincipal principal)) {
            log.warn("OAuth2 success with an unexpected principal type; sending the user back to login");
            getRedirectStrategy().sendRedirect(request, response, frontendUrl + "/login?error=oauth");
            return;
        }
        User user = principal.getUser();
        LoginResponse session = tokenService.issueSession(user);
        boolean isNewUser = !Boolean.TRUE.equals(user.getOnboardingCompleted());

        String redirectUrl = UriComponentsBuilder
                .fromUriString(frontendUrl + "/auth/callback")
                .queryParam("token", session.getAccessToken())
                .queryParam("refresh", session.getRefreshToken())
                .queryParam("newUser", isNewUser)
                .build()
                .encode()
                .toUriString();

        // The HTTP session only existed to carry the OAuth state parameter; nothing else should live in it.
        HttpSession httpSession = request.getSession(false);
        if (httpSession != null) {
            httpSession.invalidate();
        }
        log.info("Google sign-in for user {}", user.getId());
        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }

    static String stripTrailingSlash(String url) {
        return url != null && url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}

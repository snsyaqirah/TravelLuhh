package com.travelluhh.dto.auth;

import com.travelluhh.dto.user.UserResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {

    private String accessToken;
    private String refreshToken;
    /** Access-token lifetime in milliseconds. */
    private Long expiresIn;
    private UserResponse user;
}

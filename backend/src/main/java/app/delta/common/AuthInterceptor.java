package app.delta.common;

import app.delta.onboarding.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    public static final String USER_ID = "userId";

    private final UserRepository users;

    public AuthInterceptor(UserRepository users) {
        this.users = users;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) throw ApiException.unauthorized();
        String token = header.substring("Bearer ".length()).trim();
        var user = users.findByTokenHash(Tokens.hash(token)).orElseThrow(ApiException::unauthorized);
        request.setAttribute(USER_ID, user.getId());
        return true;
    }
}

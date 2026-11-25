package app.delta.common;

import app.delta.auth.SessionRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    public static final String USER_ID = "userId";
    /** SHA-256 of the bearer token, i.e. the current session id. */
    public static final String SESSION = "sessionTokenHash";

    private final SessionRepository sessions;

    public AuthInterceptor(SessionRepository sessions) {
        this.sessions = sessions;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) throw ApiException.unauthorized();
        String token = header.substring("Bearer ".length()).trim();
        String hash = Tokens.hash(token);
        var session = sessions.findById(hash).orElseThrow(ApiException::unauthorized);
        request.setAttribute(USER_ID, session.getUserId());
        request.setAttribute(SESSION, hash);
        return true;
    }
}

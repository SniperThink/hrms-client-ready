"""
Session validation middleware for single-login-per-user enforcement
"""
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
import logging

logger = logging.getLogger(__name__)


class SingleSessionMiddleware(MiddlewareMixin):
    """
    Middleware to enforce single-session-per-user policy
    """
    
    # Endpoints that should skip session validation
    SKIP_SESSION_VALIDATION = [
        '/api/auth/login/',
        '/api/auth/logout/',
        '/api/auth/force-logout/',
        '/api/auth/register/',
        '/api/auth/refresh/',
        '/api/public/login/',
        '/api/public/signup/',
        '/api/password-reset/',
        '/api/verify-otp/',
        '/api/reset-password/',
        '/api/accept-invitation/',
        '/api/validate-invitation-token/',
        '/api/health/',
        '/admin/',
        '/static/',
        '/media/',
    ]

    def __call__(self, request):
        # Skip validation for certain endpoints
        if any(request.path.startswith(path) for path in self.SKIP_SESSION_VALIDATION):
            return self.get_response(request)
        
        # Skip for non-authenticated requests
        if isinstance(request.user, AnonymousUser):
            return self.get_response(request)
        
        # Try to authenticate user via JWT
        user = self.authenticate_user(request)
        if not user:
            return self.get_response(request)
        
        # Validate session for authenticated users
        if not self.validate_user_session(user, request):
            return JsonResponse({
                'error': 'Session expired or invalid. Please login again.',
                'code': 'SESSION_INVALID',
                'logout_required': True
            }, status=401)
        
        return self.get_response(request)
    
    def authenticate_user(self, request):
        """
        Authenticate user using JWT token
        """
        try:
            jwt_auth = JWTAuthentication()
            auth_result = jwt_auth.authenticate(request)
            if auth_result:
                user, token = auth_result
                return user
        except (InvalidToken, TokenError):
            # Token is invalid or expired
            pass
        except Exception as e:
            logger.error(f"JWT authentication error: {e}")
        
        return None
    
    def validate_user_session(self, user, request):
        """
        Validate if user's session is still valid
        """
        try:
            from ..utils.session_manager import SessionManager
            return SessionManager.validate_session_middleware(user, request)
        except Exception as e:
            logger.error(f"Session validation error for user {user.email}: {e}")
            return False

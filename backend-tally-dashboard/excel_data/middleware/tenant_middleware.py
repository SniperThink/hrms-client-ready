from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from ..models import Tenant
import logging
import jwt
from django.conf import settings

logger = logging.getLogger(__name__)

class TenantMiddleware(MiddlewareMixin):
    """
    Middleware to identify tenants based on subdomain and set request.tenant
    Allows public endpoints to work without tenant context
    """
    
    # Public endpoints that don't require tenant context
    PUBLIC_ENDPOINTS = [
        '/api/public/signup/',
        '/api/public/login/',
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
        # Skip tenant resolution for admin, static files, and API docs
        if any(request.path.startswith(path) for path in ['/admin/', '/static/', '/media/', '/api-docs/']):
            return self.get_response(request)
        
        # Skip tenant requirement for public endpoints
        if any(request.path.startswith(endpoint) for endpoint in self.PUBLIC_ENDPOINTS):
            request.tenant = None
            return self.get_response(request)
        
        # Get tenant from various sources
        tenant = self.get_tenant(request)
        
        # Set tenant in request
        request.tenant = tenant
        
        # Add tenant to thread local for model access
        if tenant:
            from ..utils.utils import set_current_tenant
            set_current_tenant(tenant)
        
        response = self.get_response(request)
        
        # Clear tenant from thread local
        from ..utils.utils import clear_current_tenant
        clear_current_tenant()
        
        return response

    def get_tenant(self, request):
        """
        Resolve tenant from request. Priority:
        1. JWT token (primary method - no subdomain needed)
        2. Header (X-Tenant-ID or X-Tenant-Subdomain)
        3. Query parameter (?tenant_id=123 or ?tenant=subdomain)
        4. Subdomain (subdomain.domain.com) - optional
        5. Custom domain (custom-domain.com) - optional
        """
        
        # Method 1: Try to get tenant from JWT token (PRIMARY METHOD)
        tenant_from_token = self.get_tenant_from_jwt(request)
        if tenant_from_token:
            return tenant_from_token
        
        # Method 2: Header-based (for API clients)
        tenant_id_header = request.headers.get('X-Tenant-ID')
        if tenant_id_header:
            try:
                return Tenant.objects.get(id=tenant_id_header, is_active=True)
            except (Tenant.DoesNotExist, ValueError):
                pass
        
        tenant_subdomain_header = request.headers.get('X-Tenant-Subdomain')
        if tenant_subdomain_header:
            try:
                return Tenant.objects.get(subdomain=tenant_subdomain_header, is_active=True)
            except Tenant.DoesNotExist:
                pass
        
        # Method 3: Query parameter
        tenant_id_param = request.GET.get('tenant_id')
        if tenant_id_param:
            try:
                return Tenant.objects.get(id=tenant_id_param, is_active=True)
            except (Tenant.DoesNotExist, ValueError):
                pass
        
        tenant_param = request.GET.get('tenant')
        if tenant_param:
            try:
                return Tenant.objects.get(subdomain=tenant_param, is_active=True)
            except Tenant.DoesNotExist:
                pass
        
        # Method 4: Subdomain resolution (optional)
        host = request.get_host().split(':')[0]  # Remove port if present
        subdomain = self.extract_subdomain(host)
        
        if subdomain:
            try:
                return Tenant.objects.get(subdomain=subdomain, is_active=True)
            except Tenant.DoesNotExist:
                pass
        
        # Method 5: Custom domain (optional)
        try:
            return Tenant.objects.get(custom_domain=host, is_active=True)
        except Tenant.DoesNotExist:
            pass
        
        # No tenant found - this is OK for single-tenant setups
        logger.info(f"No tenant found for host: {host} - using default tenant resolution")
        return None

    def extract_subdomain(self, host):
        """
        Extract subdomain from host
        """
        parts = host.split('.')
        
        # For localhost development
        if host in ['localhost', '127.0.0.1']:
            return None
        
        # For subdomain.domain.com (at least 3 parts)
        if len(parts) >= 3:
            return parts[0]
        
        return None

    def get_tenant_from_jwt(self, request):
        """
        Extract tenant from JWT token in Authorization header
        """
        try:
            auth_header = request.headers.get('Authorization')
            logger.debug(f"Auth header: {auth_header}")
            
            if not auth_header or not auth_header.startswith('Bearer '):
                logger.debug("No valid Authorization header found")
                return None
            
            token = auth_header.split(' ')[1]
            logger.debug(f"Token extracted: {token[:20]}...")
            
            # Get the JWT secret from settings
            secret_key = settings.SECRET_KEY
            
            # Decode the token
            payload = jwt.decode(token, secret_key, algorithms=['HS256'])
            logger.debug(f"JWT payload: {payload}")
            
            user_id = payload.get('user_id')
            
            if user_id:
                # Import here to avoid circular imports
                from ..models import CustomUser
                try:
                    user = CustomUser.objects.select_related('tenant').get(id=user_id)
                    if user.tenant and user.tenant.is_active:
                        logger.debug(f"Found tenant: {user.tenant.name}")
                        return user.tenant
                    else:
                        logger.debug(f"User {user_id} has no active tenant")
                except CustomUser.DoesNotExist:
                    logger.debug(f"User {user_id} not found")
                    pass
                    
        except (jwt.InvalidTokenError, jwt.DecodeError, KeyError, ValueError) as e:
            logger.debug(f"JWT decode error: {e}")
            pass
        
        return None

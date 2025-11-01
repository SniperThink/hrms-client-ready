from rest_framework import permissions

class IsAdminOrHR(permissions.BasePermission):
    """
    Custom permission to only allow admin or HR users to access the view.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.user.is_admin or request.user.is_hr)

class IsSuperUser(permissions.BasePermission):
    """
    Custom permission to only allow superusers to access the view.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superuser

class IsEmployee(permissions.BasePermission):
    """
    Custom permission to only allow employees to access their own data.
    """
    def has_object_permission(self, request, view, obj):
        # Allow employees to only access their own data
        return request.user.is_authenticated and (
            request.user.is_admin or 
            request.user.is_hr or 
            (hasattr(obj, 'employee_id') and obj.employee_id == request.user.employee_id)
        ) 
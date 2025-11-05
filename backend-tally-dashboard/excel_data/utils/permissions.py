from rest_framework import permissions

class IsAdminOrHR(permissions.BasePermission):
    """
    Custom permission to only allow admin, HR Manager, or Payroll Master users to access the view.
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        role = getattr(request.user, 'role', None)
        return role in ['admin', 'hr_manager', 'payroll_master']

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
        if not request.user.is_authenticated:
            return False
        role = getattr(request.user, 'role', None)
        is_admin_or_hr_or_payroll = role in ['admin', 'hr_manager', 'payroll_master']
        return is_admin_or_hr_or_payroll or (hasattr(obj, 'employee_id') and obj.employee_id == request.user.employee_id) 
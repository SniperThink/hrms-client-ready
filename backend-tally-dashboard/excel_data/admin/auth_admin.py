from django.contrib import admin
from ..models import CustomUser, UserPermissions


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('email', 'first_name', 'last_name', 'tenant', 'role', 'is_active', 'date_joined')
    list_filter = ('tenant', 'role', 'is_active', 'is_invited', 'date_joined')
    search_fields = ('email', 'first_name', 'last_name', 'tenant__name')
    readonly_fields = ('date_joined', 'last_login', 'invitation_token')


@admin.register(UserPermissions)
class UserPermissionsAdmin(admin.ModelAdmin):
    list_display = ('id', 'can_view', 'can_modify', 'can_invite_users', 'can_manage_payroll', 'can_export_data')
    list_filter = ('can_view', 'can_modify', 'can_invite_users', 'can_manage_payroll', 'can_export_data')
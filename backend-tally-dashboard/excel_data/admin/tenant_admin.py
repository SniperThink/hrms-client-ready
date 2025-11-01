from django.contrib import admin
from ..models import Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ('name', 'subdomain', 'plan', 'is_active', 'max_employees', 'created_at')
    list_filter = ('is_active', 'plan', 'created_at')
    search_fields = ('name', 'subdomain')
    readonly_fields = ('created_at',)
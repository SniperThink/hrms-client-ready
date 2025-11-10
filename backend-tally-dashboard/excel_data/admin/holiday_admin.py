from django.contrib import admin
from ..models import Holiday


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ('name', 'date', 'holiday_type', 'is_active', 'applies_to_all', 'created_by', 'tenant', 'created_at')
    list_filter = ('tenant', 'holiday_type', 'is_active', 'applies_to_all', 'date', 'created_at')
    search_fields = ('name', 'description', 'specific_departments')
    date_hierarchy = 'date'
    ordering = ('-date',)
    readonly_fields = ('created_at', 'updated_at', 'tenant')
    
    fieldsets = (
        ('Holiday Information', {
            'fields': ('tenant', 'name', 'date', 'holiday_type', 'description')
        }),
        ('Scope', {
            'fields': ('applies_to_all', 'specific_departments')
        }),
        ('Status', {
            'fields': ('is_active', 'created_by')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        """Filter holidays by tenant for non-superusers"""
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        # For non-superusers, show only their tenant's holidays
        if hasattr(request.user, 'tenant') and request.user.tenant:
            return qs.filter(tenant=request.user.tenant)
        return qs.none()


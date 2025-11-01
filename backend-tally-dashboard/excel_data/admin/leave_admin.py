from django.contrib import admin
from ..models import Leave


@admin.register(Leave)
class LeaveAdmin(admin.ModelAdmin):
    list_display = ('employee', 'leave_type', 'start_date', 'end_date', 'days_count', 'status', 'applied_date')
    list_filter = ('tenant', 'leave_type', 'status', 'start_date', 'applied_date')
    search_fields = ('employee__name', 'reason')
    readonly_fields = ('applied_date', 'created_at', 'updated_at')
    
    fieldsets = (
        ('Leave Information', {
            'fields': ('employee', 'leave_type', 'start_date', 'end_date', 'days_count', 'reason')
        }),
        ('Approval', {
            'fields': ('status', 'approved_by')
        }),
        ('System Information', {
            'fields': ('applied_date', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
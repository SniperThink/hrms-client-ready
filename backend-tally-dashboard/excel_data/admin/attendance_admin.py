from django.contrib import admin
from ..models import Attendance, DailyAttendance


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = [
        'tenant', 'employee_id', 'name', 'department', 'date', 
        'calendar_days', 'total_working_days', 'present_days', 
        'absent_days', 'ot_hours', 'late_minutes'
    ]
    list_filter = ['tenant', 'date', 'department']
    search_fields = ['employee_id', 'name', 'department']
    ordering = ['-date', 'name']
    
    def get_readonly_fields(self, request, obj=None):
        # Make certain fields read-only as they are calculated
        return ['absent_days', 'created_at', 'updated_at']


@admin.register(DailyAttendance)
class DailyAttendanceAdmin(admin.ModelAdmin):
    list_display = [
        'tenant', 'date', 'employee_id', 'employee_name',
        'department', 'designation', 'employment_type',
        'attendance_status', 'check_in', 'check_out',
        'working_hours', 'time_status'
    ]
    list_filter = [
        'tenant', 'date', 'department', 'attendance_status',
        'time_status', 'employment_type'
    ]
    search_fields = [
        'employee_id', 'employee_name', 'department', 'designation'
    ]
    ordering = ['-date', 'employee_name']
    readonly_fields = ['working_hours', 'time_status', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Tenant Information', {
            'fields': ('tenant',)
        }),
        ('Employee Information', {
            'fields': (
                'employee_id', 'employee_name', 'department',
                'designation', 'employment_type'
            )
        }),
        ('Attendance Details', {
            'fields': (
                'date', 'attendance_status', 'check_in', 'check_out',
                'working_hours', 'time_status'
            )
        }),
        ('System Information', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
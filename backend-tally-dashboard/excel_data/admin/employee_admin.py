from django.contrib import admin
from ..models import EmployeeProfile


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'employee_id', 'first_name', 'last_name', 'department', 'designation', 
                    'mobile_number', 'email', 'is_active')
    list_filter = ('tenant', 'department', 'is_active', 'employment_type', 'date_of_joining')
    search_fields = ('first_name', 'last_name', 'employee_id', 'mobile_number', 'email', 'department')
    readonly_fields = ('employee_id', 'created_at', 'updated_at')
    
    fieldsets = (
        ('Tenant Information', {
            'fields': ('tenant',)
        }),
        ('Personal Information', {
            'fields': ('first_name', 'last_name', 'mobile_number', 'email', 'date_of_birth',
                      'marital_status', 'gender', 'nationality', 'address', 'city', 'state')
        }),
        ('Professional Information', {
            'fields': ('department', 'designation', 'employment_type', 'date_of_joining',
                      'location_branch', 'shift_start_time', 'shift_end_time', 
                      'basic_salary', 'tds_percentage')
        }),
        ('Off Days', {
            'fields': ('off_monday', 'off_tuesday', 'off_wednesday', 'off_thursday',
                      'off_friday', 'off_saturday', 'off_sunday')
        }),
        ('System Information', {
            'fields': ('employee_id', 'is_active', 'created_at', 'updated_at')
        }),
    )
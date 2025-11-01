from django.urls import path

from ..views import (
    dashboard_stats, cleanup_salary_data, health_check, get_dropdown_options,
    calculate_ot_rate, attendance_status, bulk_update_attendance,
    update_monthly_summaries_parallel, get_eligible_employees_for_date,
    CleanupTokensView
)

urlpatterns = [
    path('dashboard/stats/', dashboard_stats, name='dashboard-stats'),
    path('admin/cleanup/', cleanup_salary_data, name='cleanup-data'),
    path('health/', health_check, name='health-check'),
    path('dropdown-options/', get_dropdown_options, name='dropdown-options'),
    path('calculate-ot/', calculate_ot_rate, name='calculate-ot'),
    path('attendance-status/', attendance_status, name='attendance-status'),
    path('bulk-update-attendance/', bulk_update_attendance, name='bulk-update-attendance'),
    path('update-monthly-summaries/', update_monthly_summaries_parallel, name='update-monthly-summaries'),
    path('eligible-employees/', get_eligible_employees_for_date, name='eligible-employees'),
]

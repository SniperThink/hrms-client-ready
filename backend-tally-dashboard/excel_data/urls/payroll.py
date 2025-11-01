from django.urls import path

from ..views import (
    calculate_payroll, update_advance_deduction, lock_payroll_period,
    mark_salary_paid, payroll_summary, payroll_periods_list, available_calculation_periods,
    get_months_with_attendance, calculate_simple_payroll, calculate_simple_payroll_ultra_fast,
    update_payroll_entry, mark_payroll_paid, payroll_overview, create_current_month_payroll,
    payroll_period_detail, add_employee_advance, auto_payroll_settings, manual_calculate_payroll,
    save_payroll_period_direct, bulk_update_payroll_period
)

urlpatterns = [
    path('calculate-payroll/', calculate_payroll, name='calculate_payroll'),
    path('update-advance-deduction/', update_advance_deduction, name='update_advance_deduction'),
    path('lock-payroll-period/<int:period_id>/', lock_payroll_period, name='lock_payroll_period'),
    path('mark-salary-paid/', mark_salary_paid, name='mark_salary_paid'),
    path('payroll-summary/<int:period_id>/', payroll_summary, name='payroll_summary'),
    path('payroll-periods-list/', payroll_periods_list, name='payroll_periods_list'),
    path('available-calculation-periods/', available_calculation_periods, name='available_calculation_periods'),

    # Simplified Payroll System endpoints
    path('months-with-attendance/', get_months_with_attendance, name='months_with_attendance'),
    path('calculate-simple-payroll/', calculate_simple_payroll, name='calculate_simple_payroll'),
    path('calculate-simple-payroll-ultra-fast/', calculate_simple_payroll_ultra_fast, name='calculate_simple_payroll_ultra_fast'),
    path('update-payroll-entry/', update_payroll_entry, name='update_payroll_entry'),
    path('mark-payroll-paid/', mark_payroll_paid, name='mark_payroll_paid'),

    # Enhanced Payroll Overview endpoints
    path('payroll-overview/', payroll_overview, name='payroll_overview'),
    path('create-current-month-payroll/', create_current_month_payroll, name='create_current_month_payroll'),
    path('payroll-period-detail/<int:period_id>/', payroll_period_detail, name='payroll_period_detail'),
    path('add-employee-advance/', add_employee_advance, name='add_employee_advance'),

    # Auto payroll calculation endpoints
    path('auto-payroll-settings/', auto_payroll_settings, name='auto-payroll-settings'),
    path('manual-calculate-payroll/', manual_calculate_payroll, name='manual-calculate-payroll'),

    # Direct payroll save endpoint
    path('save-payroll-period-direct/', save_payroll_period_direct, name='save-payroll-period-direct'),

    # Bulk update payroll period endpoint
    path('payroll-periods/<int:period_id>/bulk-update/', bulk_update_payroll_period, name='bulk-update-payroll-period'),
]

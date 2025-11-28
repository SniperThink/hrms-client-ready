from django.urls import include, path
from rest_framework.routers import DefaultRouter

from ..views import (
    TenantViewSet, SalaryDataViewSet, EmployeeProfileViewSet,
    AttendanceViewSet, DailyAttendanceViewSet, AdvanceLedgerViewSet,
    PaymentViewSet, UserManagementViewSet, UserInvitationViewSet,
    PayrollPeriodViewSet, CalculatedSalaryViewSet, AdvancePaymentViewSet,
    CacheManagementViewSet, HolidayViewSet, SupportTicketViewSet,
)
from ..views.tenant_views import TenantCreditsView
from ..views.super_admin_views import (
    SuperAdminDashboardStatsView,
    SuperAdminTenantListView,
    SuperAdminTenantCreditsView,
    SuperAdminSupportTicketsView,
    SuperAdminSupportTicketStatusView,
    SuperAdminLoginAsTenantView,
    SuperAdminRestoreSessionView,
)

router = DefaultRouter()
router.register(r'tenants', TenantViewSet, basename='tenant')
router.register(r'salary-data', SalaryDataViewSet, basename='salarydata')
router.register(r'employees', EmployeeProfileViewSet, basename='employee')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'daily-attendance', DailyAttendanceViewSet, basename='dailyattendance')
router.register(r'advance-ledger', AdvanceLedgerViewSet, basename='advanceledger')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'users', UserManagementViewSet, basename='user-management')
router.register(r'user-invitations', UserInvitationViewSet, basename='user-invitations')

# Create another router for excel-prefixed endpoints (for frontend compatibility)
excel_router = DefaultRouter()
excel_router.register(r'salary-data', SalaryDataViewSet, basename='excel-salarydata')
excel_router.register(r'employees', EmployeeProfileViewSet, basename='excel-employee')
excel_router.register(r'attendance', AttendanceViewSet, basename='excel-attendance')
excel_router.register(r'daily-attendance', DailyAttendanceViewSet, basename='excel-dailyattendance')
excel_router.register(r'advance-ledger', AdvanceLedgerViewSet, basename='excel-advanceledger')
excel_router.register(r'payments', PaymentViewSet, basename='excel-payment')

# Autonomous Salary Calculation System
router.register(r'payroll-periods', PayrollPeriodViewSet, basename='payrollperiod')
router.register(r'calculated-salaries', CalculatedSalaryViewSet, basename='calculatedsalary')

# Advanced Payroll Management
router.register(r'advance-payments', AdvancePaymentViewSet, basename='advancepayment')

# Cache Management
router.register(r'cache', CacheManagementViewSet, basename='cache')

# Holiday Management
router.register(r'holidays', HolidayViewSet, basename='holiday')

# Support Ticket Management
router.register(r'support/tickets', SupportTicketViewSet, basename='support-ticket')

urlpatterns = [
    path('', include(router.urls)),
    path('excel/', include(excel_router.urls)),
    # Tenant credits endpoint
    path('tenant/credits/', TenantCreditsView.as_view(), name='tenant-credits'),
    # Super Admin endpoints
    path('super-admin/stats/', SuperAdminDashboardStatsView.as_view(), name='super-admin-stats'),
    path('super-admin/tenants/', SuperAdminTenantListView.as_view(), name='super-admin-tenants'),
    path('super-admin/tenants/<int:tenant_id>/credits/', SuperAdminTenantCreditsView.as_view(), name='super-admin-tenant-credits'),
    path('super-admin/tenants/<int:tenant_id>/login/', SuperAdminLoginAsTenantView.as_view(), name='super-admin-login-as-tenant'),
    path('super-admin/support/tickets/', SuperAdminSupportTicketsView.as_view(), name='super-admin-support-tickets'),
    path('super-admin/support/tickets/<int:ticket_id>/status/', SuperAdminSupportTicketStatusView.as_view(), name='super-admin-ticket-status'),
    path('super-admin/restore-session/', SuperAdminRestoreSessionView.as_view(), name='super-admin-restore-session'),
]

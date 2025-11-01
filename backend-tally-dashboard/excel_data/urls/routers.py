from django.urls import include, path
from rest_framework.routers import DefaultRouter

from ..views import (
    TenantViewSet, SalaryDataViewSet, EmployeeProfileViewSet,
    AttendanceViewSet, DailyAttendanceViewSet, AdvanceLedgerViewSet,
    PaymentViewSet, UserManagementViewSet, UserInvitationViewSet,
    PayrollPeriodViewSet, CalculatedSalaryViewSet, AdvancePaymentViewSet,
    CacheManagementViewSet,
)
from ..views.tenant_views import TenantCreditsView

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

urlpatterns = [
    path('', include(router.urls)),
    path('excel/', include(excel_router.urls)),
    # Tenant credits endpoint
    path('tenant/credits/', TenantCreditsView.as_view(), name='tenant-credits'),
]

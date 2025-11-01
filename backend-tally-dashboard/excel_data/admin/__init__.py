"""
This package contains admin configurations for the excel_data app.
Admin classes are organized in separate modules but imported here for registration.
"""

from .tenant_admin import TenantAdmin
from .auth_admin import CustomUserAdmin, UserPermissionsAdmin
from .employee_admin import EmployeeProfileAdmin
from .attendance_admin import AttendanceAdmin, DailyAttendanceAdmin
from .salary_admin import SalaryDataAdmin
from .ledger_admin import AdvanceLedgerAdmin, PaymentAdmin
from .leave_admin import LeaveAdmin

__all__ = [
    'TenantAdmin',
    'CustomUserAdmin',
    'UserPermissionsAdmin',
    'EmployeeProfileAdmin',
    'AttendanceAdmin',
    'DailyAttendanceAdmin',
    'SalaryDataAdmin',
    'AdvanceLedgerAdmin',
    'PaymentAdmin',
    'LeaveAdmin',
]
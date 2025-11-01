"""
This package contains models used by the excel_data app.
Models are organized in separate modules but re-exported here to maintain API compatibility.
"""

# Tenant Models
from .tenant import (
    Tenant,
    TenantAwareManager,
    TenantAwareModel,
)

# Leave Models
from .leave import (
    Leave,
)

# Auth Models
from .auth import (
    UserPermissions,
    CustomUser,
    CustomUserManager,
    InvitationToken,
    PasswordResetOTP,
    ActiveSession,
)

# Email Verification Models
from .email_verification import (
    EmailVerification,
)

# Employee Models
from .employee import (
    EmployeeProfile,
)

# Attendance Models
from .attendance import (
    Attendance,
    DailyAttendance,
    MonthlyAttendanceSummary,
)

# Payroll Models
from .payroll import (
    DataSource,
    PayrollPeriod,
    CalculatedSalary,
    SalaryAdjustment,
)

# Salary Models
from .salary import (
    SalaryData,
)

# Ledger Models
from .ledger import (
    AdvanceLedger,
    Payment,
)

# Chart Data Models
from .chart_data import (
    ChartAggregatedData,
)

# Define all models to be imported via 'from excel_data.models import *'
__all__ = [
    # Tenant Models
    'Tenant',
    'TenantAwareManager',
    'TenantAwareModel',
    
    # Auth Models
    'UserPermissions',
    'CustomUser',
    'CustomUserManager',
    'InvitationToken',
    'PasswordResetOTP',
    'ActiveSession',
    
    # Email Verification Models
    'EmailVerification',
    
    # Employee Models
    'EmployeeProfile',
    
    # Attendance Models
    'Attendance',
    'DailyAttendance',
    'MonthlyAttendanceSummary',
    
    # Payroll Models
    'DataSource',
    'PayrollPeriod',
    'CalculatedSalary',
    'SalaryAdjustment',
    
    # Salary Models
    'SalaryData',
    
    # Ledger Models
    'AdvanceLedger',
    'Payment',
    
    # Chart Data Models
    'ChartAggregatedData',
]
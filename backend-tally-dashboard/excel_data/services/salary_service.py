"""Autonomous Salary Calculator Service

This service handles salary calculations for both uploaded data and frontend-tracked data,
providing a unified calculation engine with admin controls for advance deductions.
"""

from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Q
from django.conf import settings
from ..models import (
    EmployeeProfile, Attendance, SalaryData, AdvanceLedger, PayrollPeriod, CalculatedSalary, SalaryAdjustment, DataSource,
    MonthlyAttendanceSummary, DailyAttendance, Holiday,
)
import logging

logger = logging.getLogger(__name__)

class SalaryCalculationService:
    """
    Service class for autonomous salary calculations
    """
    
    @staticmethod
    def _get_paid_holidays_count(tenant, year: int, month: str, department: str = None) -> int:
        """
        Get count of paid holidays for a specific month/year
        
        Args:
            tenant: Tenant instance
            year: Year (e.g., 2025)
            month: Month name (e.g., "JUNE" or "JUN")
            department: Optional department name to check department-specific holidays
            
        Returns:
            int: Count of holidays that apply (all active holidays are treated as paid)
        """
        import calendar
        
        month_num = SalaryCalculationService._get_month_number(month)
        total_days = calendar.monthrange(year, month_num)[1]
        month_start = date(year, month_num, 1)
        month_end = date(year, month_num, total_days)
        
        # Get all active holidays in this month
        holidays = Holiday.objects.filter(
            tenant=tenant,
            date__gte=month_start,
            date__lte=month_end,
            is_active=True
        )
        
        # Filter by department if specified
        if department:
            # Count holidays that apply to this department
            count = 0
            for holiday in holidays:
                if holiday.applies_to_all:
                    count += 1
                elif holiday.specific_departments:
                    departments = [d.strip() for d in holiday.specific_departments.split(',')]
                    if department in departments:
                        count += 1
            return count
        else:
            # Return count of holidays that apply to all
            return holidays.filter(applies_to_all=True).count()
    
    @staticmethod
    def _get_employee_holidays_in_period(tenant, employee, year: int, month: str, start_date=None, end_date=None) -> list:
        """
        Get list of holiday dates that apply to a specific employee in a period
        
        Args:
            tenant: Tenant instance
            employee: Employee instance or dict with department info
            year: Year
            month: Month name
            start_date: Optional start date (for partial month calculations)
            end_date: Optional end date (for partial month calculations)
            
        Returns:
            list: List of date objects representing holidays (only after employee's joining date)
        """
        import calendar
        
        month_num = SalaryCalculationService._get_month_number(month)
        
        if not start_date:
            start_date = date(year, month_num, 1)
        if not end_date:
            total_days = calendar.monthrange(year, month_num)[1]
            end_date = date(year, month_num, total_days)
        
        # Get employee department and joining date
        department = SalaryCalculationService._get_value(employee, 'department')
        date_of_joining = SalaryCalculationService._get_value(employee, 'date_of_joining')
        
        # Adjust start_date if employee joined mid-month/mid-period
        if date_of_joining and date_of_joining > start_date:
            start_date = date_of_joining
        
        # If joining date is after the period end, no holidays apply
        if date_of_joining and date_of_joining > end_date:
            return []
        
        # Get all active holidays in this period (after joining date)
        holidays = Holiday.objects.filter(
            tenant=tenant,
            date__gte=start_date,
            date__lte=end_date,
            is_active=True
        )
        
        # Filter holidays that apply to this employee
        applicable_dates = []
        for holiday in holidays:
            if holiday.applies_to_all:
                applicable_dates.append(holiday.date)
            elif holiday.specific_departments and department:
                departments = [d.strip() for d in holiday.specific_departments.split(',')]
                if department in departments:
                    applicable_dates.append(holiday.date)
        
        return applicable_dates
    
    @staticmethod
    def get_or_create_payroll_period(tenant, year: int, month: str, data_source: str = DataSource.FRONTEND):
        """Get or create a payroll period"""
        # FIXED: Normalize month to short format (JAN, FEB, etc.) to match SalaryData format
        month_normalized = SalaryCalculationService._normalize_month_to_short(month)
        
        # Calculate working days based on the month and typical off days
        working_days = SalaryCalculationService._calculate_working_days_for_month(year, month)
        
        period, created = PayrollPeriod.objects.get_or_create(
            tenant=tenant,
            year=year,
            month=month_normalized,  # Use normalized short format
            defaults={
                'data_source': data_source,
                'working_days_in_month': working_days,  # Dynamic calculation
                'tds_rate': Decimal('5.00')   # Default 5% TDS
            }
        )
        return period
    
    @staticmethod
    def _calculate_working_days_for_month(year: int, month: str) -> int:
        """
        Calculate working days for a given month considering standard off days
        Default: 0 off days means all days are working days except weekends
        """
        import calendar
        from datetime import date, timedelta
        
        month_num = SalaryCalculationService._get_month_number(month)
        
        # Get total days in month
        total_days = calendar.monthrange(year, month_num)[1]
        
        # Count weekends (Saturdays and Sundays by default)
        working_days = 0
        for day in range(1, total_days + 1):
            current_date = date(year, month_num, day)
            # Monday = 0, Sunday = 6
            if current_date.weekday() < 6:  # Monday to Saturday (0-5)
                working_days += 1
        
        return working_days
    
    # Helper to read from object or dict
    @staticmethod
    def _get_value(obj, field):
        try:
            return getattr(obj, field)
        except Exception:
            try:
                return obj.get(field)
            except Exception:
                return None

    @staticmethod
    def _calculate_employee_working_days(employee: 'EmployeeProfile', year: int, month: str, tenant=None) -> int:
        """
        Calculate working days for a specific employee for the full month
        
        DOJ-aware, weekly-off-aware, and HOLIDAY-aware:
        - Excludes employee's weekly off days
        - Excludes paid holidays that apply to the employee
        - If DOJ is after this month: 0
        - If DOJ is within this month: count from DOJ to month end, excluding weekly offs and holidays
        - If DOJ is before this month: count full month, excluding weekly offs and holidays
        Supports both model instances and plain dicts.
        """
        import calendar
        from datetime import date, timedelta
        
        month_num = SalaryCalculationService._get_month_number(month)
        total_days = calendar.monthrange(year, month_num)[1]
        month_start = date(year, month_num, 1)
        month_end = date(year, month_num, total_days)
        
        # Build off-day set based on employee profile (obj or dict)
        off_days = set()
        if bool(SalaryCalculationService._get_value(employee, 'off_monday')): off_days.add(0)
        if bool(SalaryCalculationService._get_value(employee, 'off_tuesday')): off_days.add(1)
        if bool(SalaryCalculationService._get_value(employee, 'off_wednesday')): off_days.add(2)
        if bool(SalaryCalculationService._get_value(employee, 'off_thursday')): off_days.add(3)
        if bool(SalaryCalculationService._get_value(employee, 'off_friday')): off_days.add(4)
        if bool(SalaryCalculationService._get_value(employee, 'off_saturday')): off_days.add(5)
        if bool(SalaryCalculationService._get_value(employee, 'off_sunday')): off_days.add(6)
        
        doj = SalaryCalculationService._get_value(employee, 'date_of_joining')
        
        # If DOJ is a string, try to parse
        if isinstance(doj, str):
            try:
                from datetime import datetime as _dt
                doj = _dt.fromisoformat(doj).date()
            except Exception:
                doj = None
        
        if not doj:
            start_date = month_start
        else:
            if doj > month_end:
                return 0
            start_date = doj if (doj.year == year and doj.month == month_num and doj > month_start) else month_start
        
        # Get tenant - try from employee object or passed parameter
        if not tenant:
            tenant = SalaryCalculationService._get_value(employee, 'tenant')
        
        # Get paid holidays that apply to this employee in this period
        holiday_dates = set()
        if tenant:
            holiday_dates = set(SalaryCalculationService._get_employee_holidays_in_period(
                tenant, employee, year, month, start_date, month_end
            ))
        
        # Count working days excluding off days AND holidays
        working_days = 0
        current_date = start_date
        while current_date <= month_end:
            # Skip if it's a weekly off day OR a holiday
            if current_date.weekday() not in off_days and current_date not in holiday_dates:
                working_days += 1
            current_date += timedelta(days=1)
        
        return working_days
    
    @staticmethod
    def calculate_salary_for_period(tenant, year: int, month: str, force_recalculate: bool = False):
        """
        Calculate salaries for all active employees for a given period
        
        Args:
            tenant: Tenant instance
            year: Year (e.g., 2025)
            month: Month name (e.g., "JUNE")
            force_recalculate: Whether to recalculate existing records
        
        Returns:
            dict: Summary of calculation results
        """
        with transaction.atomic():
            # Determine data source based on existing data
            data_source = SalaryCalculationService._determine_data_source(tenant, year, month)
            
            # Get or create payroll period
            payroll_period = SalaryCalculationService.get_or_create_payroll_period(
                tenant, year, month, data_source
            )
            
            if payroll_period.is_locked and not force_recalculate:
                return {
                    'status': 'locked',
                    'message': f'Payroll for {month} {year} is locked',
                    'period_id': payroll_period.id
                }
            
            month_num = SalaryCalculationService._get_month_number(month)
            
            # FIXED: Only get employees who have attendance data for this period
            # Normalize month to short format for comparison with SalaryData
            month_normalized = SalaryCalculationService._normalize_month_to_short(month)
            
            # Check for uploaded salary data first (from Excel uploads)
            from django.db.models import Q
            employees_with_salary_data = EmployeeProfile.objects.filter(
                tenant=tenant,
                is_active=True,
                employee_id__in=SalaryData.objects.filter(
                    tenant=tenant,
                    year=year
                ).filter(
                    Q(month__iexact=month_normalized) | Q(month__iexact=month)
                ).values_list('employee_id', flat=True)
            )
            
            # Check for attendance data (from Attendance model or DailyAttendance)
            from ..models import Attendance, DailyAttendance
            employees_with_attendance = EmployeeProfile.objects.filter(
                tenant=tenant,
                is_active=True
            ).filter(
                Q(employee_id__in=Attendance.objects.filter(
                    tenant=tenant,
                    date__year=year,
                    date__month=month_num
                ).values_list('employee_id', flat=True).distinct())
                |
                Q(employee_id__in=DailyAttendance.objects.filter(
                    tenant=tenant,
                    date__year=year,
                    date__month=month_num
                ).values_list('employee_id', flat=True).distinct())
            )
            
            # Combine both (employees with either salary data or attendance data)
            active_employees = (employees_with_salary_data | employees_with_attendance).distinct()
            
            if not active_employees.exists():
                logger.info(f"No employees with attendance data for {month} {year}")
                return {
                    'calculated': 0,
                    'updated': 0,
                    'errors': [],
                    'period_id': payroll_period.id,
                    'data_source': data_source,
                    'message': f'No employees with attendance data for {month} {year}'
                }
            
            results = {
                'calculated': 0,
                'updated': 0,
                'errors': [],
                'period_id': payroll_period.id,
                'data_source': data_source
            }
            
            for employee in active_employees:
                try:
                    # Additional check: Skip if employee has no attendance data at all
                    attendance_data = SalaryCalculationService._get_attendance_data(
                        employee, year, month, force_recalculate
                    )
                    
                    # Skip employees with no attendance (present_days = 0 and absent_days = 0)
                    # and no uploaded salary data
                    month_normalized = SalaryCalculationService._normalize_month_to_short(month)
                    from django.db.models import Q
                    has_uploaded_salary = SalaryData.objects.filter(
                        tenant=tenant,
                        employee_id=employee.employee_id,
                        year=year
                    ).filter(
                        Q(month__iexact=month_normalized) | Q(month__iexact=month)
                    ).exists()
                    
                    if not has_uploaded_salary and attendance_data['present_days'] == 0 and attendance_data['absent_days'] == 0:
                        logger.debug(f"Skipping employee {employee.employee_id} - no attendance data")
                        continue
                    
                    calculated_salary = SalaryCalculationService._calculate_employee_salary(
                        payroll_period, employee, force_recalculate
                    )
                    
                    if calculated_salary:
                        if calculated_salary._state.adding:
                            results['calculated'] += 1
                        else:
                            results['updated'] += 1
                except Exception as e:
                    logger.error(f"Error calculating salary for {employee.employee_id}: {str(e)}")
                    results['errors'].append(f"{employee.employee_id}: {str(e)}")
            
            return results
    
    @staticmethod
    def _determine_data_source(tenant, year: int, month: str) -> str:
        """Determine if period should use uploaded data or frontend calculations"""
        
        # FIXED: Normalize month to short format for comparison with SalaryData
        month_normalized = SalaryCalculationService._normalize_month_to_short(month)
        
        # Check if we have uploaded salary data for this period
        from django.db.models import Q
        has_uploaded_salary = SalaryData.objects.filter(
            tenant=tenant,
            year=year
        ).filter(
            Q(month__iexact=month_normalized) | Q(month__iexact=month)
        ).exists()
        
        # Check if we have frontend attendance data
        month_start = date(year, SalaryCalculationService._get_month_number(month), 1)
        has_frontend_attendance = Attendance.objects.filter(
            tenant=tenant,
            date__year=year,
            date__month=month_start.month,
            calendar_days=1,  # Indicates daily tracking
            total_working_days=1
        ).exists()
        
        if has_uploaded_salary and has_frontend_attendance:
            return DataSource.HYBRID
        elif has_uploaded_salary:
            return DataSource.UPLOADED
        else:
            return DataSource.FRONTEND
    
    @staticmethod
    def _calculate_employee_salary(payroll_period: PayrollPeriod, employee: EmployeeProfile, force_recalculate: bool = False):
        """Calculate salary for a specific employee"""
        
        # Ensure employee has an employee_id
        if not employee.employee_id:
            logger.error(f"Employee {employee.full_name} (ID: {employee.id}) has no employee_id")
            return None
        
        # Check if calculation already exists
        existing = CalculatedSalary.objects.filter(
            tenant=employee.tenant,
            payroll_period=payroll_period,
            employee_id=employee.employee_id
        ).first()
        
        if existing and not force_recalculate:
            # Ensure uploaded periods are reflected as paid in existing records
            if payroll_period.data_source == DataSource.UPLOADED and not existing.is_paid:
                existing.is_paid = True
                existing.payment_date = date.today()
                existing._skip_auto_calc = True  # Skip calculation when updating
                existing.save()
            return existing
        
        # Check if we have uploaded salary data for this employee/period
        uploaded_salary = SalaryData.objects.filter(
            tenant=employee.tenant,
            employee_id=employee.employee_id,
            year=payroll_period.year,
            month=payroll_period.month
        ).first()
        
        if uploaded_salary and payroll_period.data_source == DataSource.UPLOADED:
            # Skip calculation entirely for uploaded data - use Excel values directly
            # Set _skip_auto_calc flag to prevent any calculation in CalculatedSalary.save()
            
            # Get paid holidays count even for uploaded data
            import calendar
            month_num_calc = SalaryCalculationService._get_month_number(payroll_period.month)
            total_days = calendar.monthrange(payroll_period.year, month_num_calc)[1]
            month_start = date(payroll_period.year, month_num_calc, 1)
            month_end = date(payroll_period.year, month_num_calc, total_days)
            holiday_dates = SalaryCalculationService._get_employee_holidays_in_period(
                employee.tenant, employee, payroll_period.year, payroll_period.month, month_start, month_end
            )
            holiday_count = len(holiday_dates)
            
            salary_data = {
                'payroll_period': payroll_period,
                'employee_id': employee.employee_id,
                'employee_name': uploaded_salary.name,
                'department': uploaded_salary.department or 'General',
                'basic_salary': uploaded_salary.salary or Decimal('0'),
                'basic_salary_per_hour': uploaded_salary.hour_rs or Decimal('0'),
                'employee_ot_rate': uploaded_salary.hour_rs or Decimal('0'),
                'employee_tds_rate': uploaded_salary.tds or Decimal('0'),
                'total_working_days': int((uploaded_salary.days or 0) + (uploaded_salary.absent or 0)),
                'present_days': Decimal(str(uploaded_salary.days or 0)),
                'absent_days': Decimal(str(uploaded_salary.absent or 0)),
                'holiday_days': holiday_count,  # Include holiday count
                'ot_hours': uploaded_salary.ot or Decimal('0'),
                'late_minutes': int(uploaded_salary.late or 0),
                'salary_for_present_days': uploaded_salary.sl_wo_ot or Decimal('0'),
                'ot_charges': uploaded_salary.charges or Decimal('0'),
                'late_deduction': uploaded_salary.amt or Decimal('0'),
                'incentive': uploaded_salary.incentive or Decimal('0'),
                'gross_salary': uploaded_salary.sal_ot or Decimal('0'),
                'tds_amount': uploaded_salary.tds or Decimal('0'),
                'salary_after_tds': uploaded_salary.sal_tds or Decimal('0'),
                'total_advance_balance': uploaded_salary.total_old_adv or Decimal('0'),
                'advance_deduction_amount': uploaded_salary.advance or Decimal('0'),
                'advance_deduction_editable': True,
                'remaining_advance_balance': uploaded_salary.balnce_adv or Decimal('0'),
                'net_payable': uploaded_salary.nett_payable or Decimal('0'),
                'data_source': DataSource.UPLOADED,
                'is_paid': True,
                'payment_date': date.today(),
            }
        else:
            # Use normal calculation logic for FRONTEND data
            # Get attendance data (with force calculation support)
            attendance_data = SalaryCalculationService._get_attendance_data(
                employee, payroll_period.year, payroll_period.month, force_recalculate
            )
            
            # Get advance balance
            advance_balance = SalaryCalculationService._get_advance_balance(employee.employee_id)
            
            # Calculate per-hour and per-minute rates
            basic_salary = employee.basic_salary or Decimal('0')
            # Use employee-specific working days instead of period working days
            working_days = SalaryCalculationService._calculate_employee_working_days(
                employee, payroll_period.year, payroll_period.month, employee.tenant
            )
            
            # Calculate shift hours from shift_start_time and shift_end_time
            from datetime import datetime, timedelta
            raw_shift_hours_per_day = Decimal('0')
            if hasattr(employee, 'shift_start_time') and hasattr(employee, 'shift_end_time') and \
               employee.shift_start_time and employee.shift_end_time:
                start_dt = datetime.combine(datetime.today().date(), employee.shift_start_time)
                end_dt = datetime.combine(datetime.today().date(), employee.shift_end_time)
                # Handle overnight shifts
                if end_dt <= start_dt:
                    end_dt += timedelta(days=1)
                delta = end_dt - start_dt
                raw_shift_hours_per_day = Decimal(str(delta.total_seconds() / 3600))
            else:
                # Fallback to 8 hours if shift times not set
                raw_shift_hours_per_day = Decimal('8')
            
            # Subtract break time from shift hours
            from ..utils.utils import get_break_time
            break_time = Decimal(str(get_break_time(employee.tenant)))
            shift_hours_per_day = max(Decimal('0'), raw_shift_hours_per_day - break_time)
            
            minutes_per_day = shift_hours_per_day * Decimal('60')
            
            basic_salary_per_hour = basic_salary / (working_days * shift_hours_per_day) if working_days > 0 and shift_hours_per_day > 0 else Decimal('0')
            
            # STATIC OT rate calculation: basic_salary / ((shift_hours - break_time) × AVERAGE_DAYS_PER_MONTH)
            # Using tenant-specific AVERAGE_DAYS_PER_MONTH for consistent OT rates across all months
            # Formula: OT Charge per Hour = basic_salary / ((shift_end_time - shift_start_time - break_time) × AVERAGE_DAYS_PER_MONTH)
            if shift_hours_per_day > 0 and basic_salary > 0:
                from ..utils.utils import get_average_days_per_month
                average_days = Decimal(str(get_average_days_per_month(employee.tenant)))
                ot_rate_per_hour = basic_salary / (shift_hours_per_day * average_days)
            else:
                ot_rate_per_hour = Decimal('0')
            
            # Use employee's TDS percentage if available, otherwise use period default
            employee_tds_rate = employee.tds_percentage if employee.tds_percentage is not None else payroll_period.tds_rate
            
            # Prepare salary calculation data
            salary_data = {
                'payroll_period': payroll_period,
                'employee_id': employee.employee_id,
                'employee_name': f"{employee.first_name} {employee.last_name}",
                'department': employee.department or 'General',
                'basic_salary': basic_salary,
                'basic_salary_per_hour': basic_salary_per_hour,
                'employee_ot_rate': ot_rate_per_hour,
                'employee_tds_rate': employee_tds_rate,
                'total_working_days': attendance_data['total_working_days'],
                'present_days': attendance_data['present_days'],
                'absent_days': attendance_data['absent_days'],
                'holiday_days': attendance_data.get('holiday_days', 0),
                'weekly_penalty_days': attendance_data.get('weekly_penalty_days', Decimal('0')),
                'ot_hours': attendance_data['ot_hours'],
                'late_minutes': attendance_data['late_minutes'],
                'total_advance_balance': advance_balance,
                'data_source': payroll_period.data_source,
            }
        
        # Create or update calculated salary
        if existing:
            for key, value in salary_data.items():
                setattr(existing, key, value)
            # Skip auto-calculation for uploaded data
            if payroll_period.data_source == DataSource.UPLOADED:
                existing._skip_auto_calc = True
            existing.save()
            return existing
        else:
            calculated_salary = CalculatedSalary(tenant=employee.tenant, **salary_data)
            # Skip auto-calculation for uploaded data
            if payroll_period.data_source == DataSource.UPLOADED:
                calculated_salary._skip_auto_calc = True
            calculated_salary.save()
            return calculated_salary
    
    @staticmethod
    def _compute_weekly_penalty_and_bonus(employee: 'EmployeeProfile', year: int, month: str) -> dict:
        """
        Compute weekly absent penalty days for a month using DailyAttendance.
        
        Rules (tenant specific):
        - If an employee in a week is ABSENT more than N days (default 4), add 1 penalty day.
        
        Note: Sunday bonus is handled separately by marking Sunday as PRESENT in DailyAttendance.
        This function ONLY aggregates penalty counts for payroll; it does NOT modify DailyAttendance.
        """
        from datetime import date, timedelta
        import calendar
        from ..models import DailyAttendance
        
        tenant = getattr(employee, 'tenant', None)
        if not tenant:
            return {
                'weekly_penalty_days': Decimal('0'),
            }
        
        # Read tenant-level config with sane fallbacks
        tenant_absent_enabled = getattr(tenant, 'weekly_absent_penalty_enabled', False)
        absent_threshold = getattr(tenant, 'weekly_absent_threshold', 4) or 4
        
        # Check employee-level override - only apply if tenant weekly rules are enabled
        employee_weekly_rules_enabled = getattr(employee, 'weekly_rules_enabled', True)
        
        # Weekly rules apply only if BOTH tenant and employee have it enabled
        absent_enabled = tenant_absent_enabled and employee_weekly_rules_enabled
        
        if not absent_enabled:
            return {
                'weekly_penalty_days': Decimal('0'),
            }
        
        month_num = SalaryCalculationService._get_month_number(month)
        total_days = calendar.monthrange(year, month_num)[1]
        month_start = date(year, month_num, 1)
        month_end = date(year, month_num, total_days)
        
        # Fetch all DailyAttendance rows for this employee/month once
        daily_qs = DailyAttendance.objects.filter(
            tenant=tenant,
            employee_id=employee.employee_id,
            date__gte=month_start,
            date__lte=month_end,
        ).only('date', 'attendance_status', 'penalty_ignored')
        
        if not daily_qs.exists():
            return {
                'weekly_penalty_days': Decimal('0'),
            }
        
        # Build map date -> (status, penalty_ignored) for quick lookup
        status_by_date = {rec.date: (rec.attendance_status, bool(getattr(rec, 'penalty_ignored', False))) for rec in daily_qs}
        
        weekly_penalty_days = 0
        
        # Iterate over calendar weeks in the month using monthcalendar
        month_calendar = calendar.monthcalendar(year, month_num)
        for week in month_calendar:
            # week is [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
            # Build list of actual dates for this week within the month
            week_dates = []
            for idx, day in enumerate(week):
                if day == 0:
                    continue  # day from previous/next month
                week_dates.append(date(year, month_num, day))
            
            if not week_dates:
                continue
            
            # Count ABSENT days in this week for penalty calculation, excluding penalty_ignored days
            absent_count = 0
            for d in week_dates:
                status, ignored = status_by_date.get(d, (None, False))
                if status == 'ABSENT' and not ignored:
                    absent_count += 1
            
            # Apply absent penalty rule: if absent meets or exceeds threshold, add penalty
            # Threshold 4 means: 4+ absences = penalty (so use >=)
            if absent_enabled and absent_count >= absent_threshold:
                weekly_penalty_days += 1
            
            # Note: Sunday bonus is handled separately by mark_sunday_bonus_background
            # which marks Sunday as PRESENT when threshold is met
        
        return {
            'weekly_penalty_days': Decimal(str(weekly_penalty_days)),
        }
    
    @staticmethod
    def _get_attendance_data(employee: EmployeeProfile, year: int, month: str, force_calculate_partial: bool = False) -> dict:
        """
        Get attendance data from either uploaded or frontend sources
        Enhanced to support force calculation for partial months
        """
        from datetime import date, datetime
        
        month_num = SalaryCalculationService._get_month_number(month)
        
        # First, try to get from uploaded SalaryData
        salary_record = SalaryData.objects.filter(
            tenant=employee.tenant,
            employee_id=employee.employee_id,
            year=year,
            month=month
        ).first()
        
        if salary_record and not force_calculate_partial:
            # Use uploaded data for full month calculation
            # Get paid holidays count even for uploaded data
            import calendar
            month_num_calc = SalaryCalculationService._get_month_number(month)
            total_days = calendar.monthrange(year, month_num_calc)[1]
            month_start = date(year, month_num_calc, 1)
            month_end = date(year, month_num_calc, total_days)
            holiday_dates = SalaryCalculationService._get_employee_holidays_in_period(
                employee.tenant, employee, year, month, month_start, month_end
            )
            holiday_count = len(holiday_dates)
            
            return {
                'total_working_days': salary_record.days + salary_record.absent,
                'present_days': Decimal(str(salary_record.days)) + Decimal(str(holiday_count)),  # Add holidays
                'absent_days': Decimal(str(salary_record.absent)),
                'ot_hours': salary_record.ot,
                'late_minutes': salary_record.late,
                'holiday_days': holiday_count,  # Track holiday count separately
                # Weekly rules are not applied for uploaded salary data
                'weekly_penalty_days': Decimal('0'),
            }
        
        # Next try the pre-aggregated MonthlyAttendanceSummary (fast path)
        summary = MonthlyAttendanceSummary.objects.filter(
            tenant=employee.tenant,
            employee_id=employee.employee_id,
            year=year,
            month=month_num,
        ).first()

        if summary and not force_calculate_partial:
            employee_working_days = SalaryCalculationService._calculate_employee_working_days(
                employee, year, month, employee.tenant
            )

            # Only count explicitly logged absences, not assumed ones based on missing attendance
            # If an employee has some attendance records, absent_days should only count explicit ABSENT entries
            # For employees with no records at all, both present and absent should be 0
            
            # Get count of explicit ABSENT entries for this employee/month
            explicit_absent_count = DailyAttendance.objects.filter(
                tenant=employee.tenant,
                employee_id=employee.employee_id,
                date__year=year,
                date__month=SalaryCalculationService._get_month_number(month),
                attendance_status='ABSENT'
            ).count()
            
            # Get paid holidays count for this employee
            import calendar
            month_num = SalaryCalculationService._get_month_number(month)
            total_days = calendar.monthrange(year, month_num)[1]
            month_start = date(year, month_num, 1)
            month_end = date(year, month_num, total_days)
            holiday_dates = SalaryCalculationService._get_employee_holidays_in_period(
                employee.tenant, employee, year, month, month_start, month_end
            )
            holiday_count = len(holiday_dates)

            weekly_stats = SalaryCalculationService._compute_weekly_penalty_and_bonus(
                employee, year, month
            )
            
            present_days = Decimal(str(summary.present_days)) + Decimal(str(holiday_count))
            absent_days = Decimal(str(explicit_absent_count))
            
            # Apply weekly absent penalty to present/absent days if enabled
            penalty_days = weekly_stats['weekly_penalty_days']
            if penalty_days > 0:
                present_days = max(Decimal('0'), present_days - penalty_days)
                absent_days = absent_days + penalty_days

            return {
                'total_working_days': employee_working_days,
                'present_days': present_days,   # Includes holidays minus any penalty_days
                'absent_days': absent_days,    # Explicit absences + penalty_days
                'ot_hours': summary.ot_hours,
                'late_minutes': summary.late_minutes,
                'holiday_days': holiday_count,  # Track holiday count separately
                'weekly_penalty_days': weekly_stats['weekly_penalty_days'],
            }
        
        # If MonthlyAttendanceSummary doesn't have data, try the Attendance model (monthly summary format)
        attendance_record = Attendance.objects.filter(
            tenant=employee.tenant,
            employee_id=employee.employee_id,
            date__year=year,
            date__month=month_num,
        ).first()

        if attendance_record and not force_calculate_partial:
            # TRUST UPLOADED WORKING DAYS: Use uploaded value if available, otherwise calculate
            if attendance_record.total_working_days and attendance_record.total_working_days > 0:
                employee_working_days = attendance_record.total_working_days
            else:
                # Fallback to calculation if no uploaded value
                employee_working_days = SalaryCalculationService._calculate_employee_working_days(
                    employee, year, month, employee.tenant
                )
            
            # Get paid holidays count for this employee
            import calendar
            month_num = SalaryCalculationService._get_month_number(month)
            total_days = calendar.monthrange(year, month_num)[1]
            month_start = date(year, month_num, 1)
            month_end = date(year, month_num, total_days)
            holiday_dates = SalaryCalculationService._get_employee_holidays_in_period(
                employee.tenant, employee, year, month, month_start, month_end
            )
            holiday_count = len(holiday_dates)

            weekly_stats = SalaryCalculationService._compute_weekly_penalty_and_bonus(
                employee, year, month
            )
            
            present_days = Decimal(str(attendance_record.present_days)) + Decimal(str(holiday_count))
            absent_days = Decimal(str(attendance_record.absent_days))
            
            penalty_days = weekly_stats['weekly_penalty_days']
            if penalty_days > 0:
                present_days = max(Decimal('0'), present_days - penalty_days)
                absent_days = absent_days + penalty_days

            return {
                'total_working_days': employee_working_days,
                'present_days': present_days,  # Includes holidays minus any penalty_days
                'absent_days': absent_days,    # Uploaded absent + penalty_days
                'ot_hours': attendance_record.ot_hours,
                'late_minutes': attendance_record.late_minutes,
                'holiday_days': holiday_count,  # Track holiday count separately
                'weekly_penalty_days': weekly_stats['weekly_penalty_days'],
            }
        
        # Otherwise, fall back to on-the-fly aggregation of DailyAttendance
        from django.db.models import Sum

        # Determine start & end dates for the period (supports partial month when force_calculate_partial=True)
        if force_calculate_partial:
            current_date = date.today()
            start_date = employee.date_of_joining if (
                employee.date_of_joining
                and employee.date_of_joining.year == year
                and employee.date_of_joining.month == month_num
            ) else date(year, month_num, 1)

            end_date = current_date if (year == current_date.year and month_num == current_date.month) else date(
                year, month_num, (date(year, month_num, 1).replace(day=28) + timedelta(days=4)).day
            )

            employee_working_days = SalaryCalculationService._calculate_employee_working_days_for_period(
                employee, start_date, end_date
            )
        else:
            employee_working_days = SalaryCalculationService._calculate_employee_working_days(
                employee, year, month, employee.tenant
            )

        daily_qs = DailyAttendance.objects.filter(
            tenant=employee.tenant,
            employee_id=employee.employee_id,
            date__year=year,
            date__month=month_num,
        )

        if force_calculate_partial:
            daily_qs = daily_qs.filter(date__range=[start_date, end_date])

        if daily_qs.exists():
            present_full = daily_qs.filter(attendance_status__in=["PRESENT", "PAID_LEAVE"]).count()
            half_count = daily_qs.filter(attendance_status="HALF_DAY").count()
            total_present = present_full + (half_count * 0.5)
            
            # Count only explicit ABSENT entries, not missing days
            explicit_absent = daily_qs.filter(attendance_status="ABSENT").count()
            # Add half day absences
            explicit_absent += half_count * 0.5

            aggregates = daily_qs.aggregate(total_ot=Sum("ot_hours"), total_late=Sum("late_minutes"))
            
            # Get paid holidays count for this employee
            import calendar
            month_num_calc = SalaryCalculationService._get_month_number(month)
            total_days = calendar.monthrange(year, month_num_calc)[1]
            month_start = date(year, month_num_calc, 1)
            month_end = date(year, month_num_calc, total_days)
            
            if force_calculate_partial:
                month_start = start_date
                month_end = end_date
            
            holiday_dates = SalaryCalculationService._get_employee_holidays_in_period(
                employee.tenant, employee, year, month, month_start, month_end
            )
            holiday_count = len(holiday_dates)

            weekly_stats = SalaryCalculationService._compute_weekly_penalty_and_bonus(
                employee, year, month
            )
            
            present_days = Decimal(str(total_present)) + Decimal(str(holiday_count))
            absent_days = Decimal(str(explicit_absent))
            
            penalty_days = weekly_stats['weekly_penalty_days']
            if penalty_days > 0:
                present_days = max(Decimal('0'), present_days - penalty_days)
                absent_days = absent_days + penalty_days
            
            return {
                'total_working_days': employee_working_days,
                'present_days': present_days,      # Includes holidays minus any penalty_days
                'absent_days': absent_days,        # Explicit absences + penalty_days
                'ot_hours': aggregates["total_ot"] or Decimal('0'),
                'late_minutes': aggregates["total_late"] or 0,
                'holiday_days': holiday_count,     # Track holiday count separately
                'weekly_penalty_days': weekly_stats['weekly_penalty_days'],
            }
        
        # Default values if no data found - assume no attendance logged
        # For new employees with no records: present=0 + holidays, absent=0 (not assumed absent)
        # Get paid holidays count even if no attendance logged
        import calendar
        month_num_calc = SalaryCalculationService._get_month_number(month)
        total_days = calendar.monthrange(year, month_num_calc)[1]
        month_start = date(year, month_num_calc, 1)
        month_end = date(year, month_num_calc, total_days)
        
        holiday_dates = SalaryCalculationService._get_employee_holidays_in_period(
            employee.tenant, employee, year, month, month_start, month_end
        )
        holiday_count = len(holiday_dates)
        
        return {
            'total_working_days': employee_working_days,
            'present_days': Decimal(str(holiday_count)),  # Only holidays count as present by default
            'absent_days': Decimal('0'),  # No default absent - only count explicitly logged absences
            'ot_hours': Decimal('0'),
            'late_minutes': 0,
            'holiday_days': holiday_count,  # Track holiday count separately
            # No weekly rules when there is no detailed attendance
            'weekly_penalty_days': Decimal('0'),
        }
    
    @staticmethod
    def _calculate_employee_working_days_for_period(employee: 'EmployeeProfile', start_date, end_date) -> int:
        """
        Calculate working days for a specific employee for a date range considering their off days
        Supports both model instances and plain dicts.
        """
        from datetime import timedelta
        
        # Build off-day set
        off_days = set()
        if bool(SalaryCalculationService._get_value(employee, 'off_monday')): off_days.add(0)
        if bool(SalaryCalculationService._get_value(employee, 'off_tuesday')): off_days.add(1)
        if bool(SalaryCalculationService._get_value(employee, 'off_wednesday')): off_days.add(2)
        if bool(SalaryCalculationService._get_value(employee, 'off_thursday')): off_days.add(3)
        if bool(SalaryCalculationService._get_value(employee, 'off_friday')): off_days.add(4)
        if bool(SalaryCalculationService._get_value(employee, 'off_saturday')): off_days.add(5)
        if bool(SalaryCalculationService._get_value(employee, 'off_sunday')): off_days.add(6)
        
        # DOJ adjust for range start
        doj = SalaryCalculationService._get_value(employee, 'date_of_joining')
        if isinstance(doj, str):
            try:
                from datetime import datetime as _dt
                doj = _dt.fromisoformat(doj).date()
            except Exception:
                doj = None
        effective_start = start_date
        if doj and doj > start_date:
            if doj > end_date:
                return 0
            effective_start = doj
        
        working_days = 0
        current_date = effective_start
        while current_date <= end_date:
            if current_date.weekday() not in off_days:
                working_days += 1
            current_date += timedelta(days=1)
        return working_days
    
    @staticmethod
    def _get_advance_balance(employee_id: str) -> Decimal:
        """Calculate current advance balance for an employee"""
        
        # Sum all advances with PENDING or PARTIALLY_PAID status using remaining_balance
        total_advances = AdvanceLedger.objects.filter(
            employee_id=employee_id,
            status__in=['PENDING', 'PARTIALLY_PAID']
        ).aggregate(total=Sum('remaining_balance'))['total'] or Decimal('0')
        
        return total_advances
    
    @staticmethod
    def update_advance_deduction(tenant, payroll_period_id: int, employee_id: str, new_amount: Decimal, admin_user: str):
        """
        Update advance deduction amount for a specific employee and period
        
        Args:
            tenant: Tenant instance
            payroll_period_id: PayrollPeriod ID
            employee_id: Employee ID
            new_amount: New deduction amount
            admin_user: Admin user making the change
        """
        
        calculated_salary = CalculatedSalary.objects.get(
            tenant=tenant,
            payroll_period_id=payroll_period_id,
            employee_id=employee_id
        )
        
        old_amount = calculated_salary.advance_deduction_amount
        calculated_salary.advance_deduction_amount = new_amount
        calculated_salary.advance_deduction_editable = True
        calculated_salary.save()  # This will trigger recalculation
        
        # Log the adjustment
        SalaryAdjustment.objects.create(
            tenant=tenant,
            calculated_salary=calculated_salary,
            adjustment_type='ADVANCE_OVERRIDE',
            amount=new_amount - old_amount,
            reason=f"Admin override: Changed advance deduction from {old_amount} to {new_amount}",
            created_by=admin_user
        )
        
        return calculated_salary
    
    @staticmethod
    def lock_payroll_period(tenant, payroll_period_id: int):
        """Lock a payroll period to prevent further modifications"""
        payroll_period = PayrollPeriod.objects.get(tenant=tenant, id=payroll_period_id)
        payroll_period.is_locked = True
        payroll_period.save()
        return payroll_period
    
    @staticmethod
    def mark_salary_as_paid(tenant, calculated_salary_id: int, payment_date: date = None):
        """Mark a calculated salary as paid and update advance ledger status"""
        from ..models import AdvanceLedger
        
        calculated_salary = CalculatedSalary.objects.get(tenant=tenant, id=calculated_salary_id)
        calculated_salary.is_paid = True
        calculated_salary.payment_date = payment_date or date.today()
        calculated_salary.save()
        
        # Update advance ledger status based on advance deduction
        if calculated_salary.advance_deduction_amount > 0:
            # Get all pending advances for this employee
            pending_advances = AdvanceLedger.objects.filter(
                tenant=tenant,
                employee_id=calculated_salary.employee_id,
                status__in=['PENDING','PARTIALLY_PAID']
            ).order_by('advance_date')  # Process oldest advances first
            
            remaining_deduction = calculated_salary.advance_deduction_amount
            
            for advance in pending_advances:
                if remaining_deduction <= 0:
                    break
                    
                current_balance = advance.remaining_balance
                if current_balance <= remaining_deduction:
                    # This advance is fully paid
                    advance.status = 'REPAID'
                    advance.remaining_balance = Decimal('0')
                    advance.save()
                    remaining_deduction -= current_balance
                else:
                    # This advance is partially paid - reduce the remaining_balance
                    advance.remaining_balance -= remaining_deduction
                    advance.status = 'PARTIALLY_PAID'
                    advance.save()
                    remaining_deduction = 0
        
        return calculated_salary
    
    @staticmethod
    def _normalize_month_to_short(month_name: str) -> str:
        """Normalize month name to short format (JAN, FEB, etc.) for consistency with SalaryData"""
        MONTH_MAPPING = {
            'JANUARY': 'JAN', 'FEBRUARY': 'FEB', 'MARCH': 'MAR', 'APRIL': 'APR',
            'MAY': 'MAY', 'JUNE': 'JUN', 'JULY': 'JUL', 'AUGUST': 'AUG',
            'SEPTEMBER': 'SEP', 'OCTOBER': 'OCT', 'NOVEMBER': 'NOV', 'DECEMBER': 'DEC',
            'JAN': 'JAN', 'FEB': 'FEB', 'MAR': 'MAR', 'APR': 'APR',
            'JUN': 'JUN', 'JUL': 'JUL', 'AUG': 'AUG', 'SEP': 'SEP',
            'OCT': 'OCT', 'NOV': 'NOV', 'DEC': 'DEC'
        }
        return MONTH_MAPPING.get(month_name.upper(), 'JAN')
    
    @staticmethod
    def _get_month_number(month_name: str) -> int:
        """Convert month name to number"""
        month_mapping = {
            'JANUARY': 1, 'FEBRUARY': 2, 'MARCH': 3, 'APRIL': 4,
            'MAY': 5, 'JUNE': 6, 'JULY': 7, 'AUGUST': 8,
            'SEPTEMBER': 9, 'OCTOBER': 10, 'NOVEMBER': 11, 'DECEMBER': 12,
            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4,
            'JUN': 6, 'JUL': 7, 'AUG': 8, 'SEP': 9,
            'OCT': 10, 'NOV': 11, 'DEC': 12
        }
        return month_mapping.get(month_name.upper(), 1)
    
    @staticmethod
    def get_salary_summary(tenant, payroll_period_id: int):
        """Get summary of calculated salaries for a period"""
        
        calculated_salaries = CalculatedSalary.objects.filter(
            tenant=tenant,
            payroll_period_id=payroll_period_id
        )
        
        summary = {
            'total_employees': calculated_salaries.count(),
            'total_gross_salary': sum(cs.gross_salary for cs in calculated_salaries),
            'total_tds': sum(cs.tds_amount for cs in calculated_salaries),
            'total_advance_deductions': sum(cs.advance_deduction_amount for cs in calculated_salaries),
            'total_net_payable': sum(cs.net_payable for cs in calculated_salaries),
            'paid_count': calculated_salaries.filter(is_paid=True).count(),
            'pending_count': calculated_salaries.filter(is_paid=False).count(),
        }
        
        return summary 

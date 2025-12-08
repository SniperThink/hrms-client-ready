import threading
import pandas as pd
import numpy as np

# Thread local storage for current tenant
_thread_local = threading.local()

def set_current_tenant(tenant):
    """Set the current tenant in thread local storage"""
    _thread_local.tenant = tenant

def get_current_tenant():
    """Get the current tenant from thread local storage"""
    return getattr(_thread_local, 'tenant', None)

def clear_current_tenant():
    """Clear the current tenant from thread local storage"""
    if hasattr(_thread_local, 'tenant'):
        delattr(_thread_local, 'tenant')

def get_average_days_per_month(tenant=None):
    """
    Get tenant-specific average days per month, with fallback to default 30.4
    If tenant is not provided, tries to get from thread local storage
    """
    if tenant is None:
        tenant = get_current_tenant()
    
    if tenant and hasattr(tenant, 'average_days_per_month') and tenant.average_days_per_month:
        return float(tenant.average_days_per_month)
    
    # Fallback to default
    return 30.4

def get_break_time(tenant=None):
    """
    Get tenant-specific break time in hours, with fallback to default 0.5 (30 minutes)
    If tenant is not provided, tries to get from thread local storage
    """
    if tenant is None:
        tenant = get_current_tenant()
    
    if tenant and hasattr(tenant, 'break_time') and tenant.break_time is not None:
        return float(tenant.break_time)
    
    # Fallback to default (30 minutes = 0.5 hours)
    return 0.5

def generate_employee_id(name: str, tenant_id: int, department: str = None) -> str:
    """
    Generate employee ID using format: First three letters-Department first two letters-Tenant id
    Example: Siddhant Marketing Analysis tenant_id 025 -> SID-MA-025
    
    In case of collision with same name, add postfix A, B, C
    Example: SID-MA-025-A, SID-MA-025-B, SID-MA-025-C
    """
    from ..models import EmployeeProfile
    import uuid
    
    if not name or str(name).strip() in ['', '0', 'nan', 'NaN', '-']:
        return str(uuid.uuid4())[:8]  # Random ID for empty names
    
    # Extract first three letters from name (uppercase)
    name_clean = ''.join(char for char in name.strip().upper() if char.isalpha())
    name_prefix = name_clean[:3].ljust(3, 'X')  # Pad with X if less than 3 letters
    
    # Extract first two letters from department (uppercase)
    if department and str(department).strip():
        dept_clean = ''.join(char for char in str(department).strip().upper() if char.isalpha())
        dept_prefix = dept_clean[:2].ljust(2, 'X')  # Pad with X if less than 2 letters
    else:
        dept_prefix = 'XX'  # Default if no department
    
    # Format tenant ID with leading zeros (3 digits)
    tenant_str = str(tenant_id).zfill(3)
    
    # Generate base employee ID
    base_id = f"{name_prefix}-{dept_prefix}-{tenant_str}"
    
    # Check for collisions and add postfix if needed
    collision_suffixes = ['', '-A', '-B', '-C', '-D', '-E', '-F', '-G', '-H', '-I', '-J']
    
    for suffix in collision_suffixes:
        candidate_id = f"{base_id}{suffix}"
        
        # Check if this ID already exists in the database for this tenant
        if not EmployeeProfile.objects.filter(tenant_id=tenant_id, employee_id=candidate_id).exists():
            return candidate_id
    
def generate_employee_id_bulk_optimized(employees_data: list, tenant_id: int) -> dict:
    """
    ULTRA-FAST bulk employee ID generation for large datasets
    
    Process all employees in memory first, then generate unique IDs in batch
    This avoids N database queries during ID generation
    
    Args:
        employees_data: List of dicts with 'name', 'department' keys
        tenant_id: Tenant ID
    
    Returns:
        Dict mapping array index to generated employee_id
    """
    from ..models import EmployeeProfile
    import uuid
    from collections import defaultdict
    
    # Get all existing employee IDs for this tenant in one query
    existing_ids = set(
        EmployeeProfile.objects.filter(tenant_id=tenant_id)
        .values_list('employee_id', flat=True)
    )
    
    # Track generated IDs to avoid duplicates within this batch
    generated_ids = set()
    id_collision_counters = defaultdict(int)  # Track collision counts per base ID
    result_mapping = {}
    
    for index, emp_data in enumerate(employees_data):
        name = emp_data.get('name', '')
        department = emp_data.get('department', '')
        
        # Handle empty names
        if not name or str(name).strip() in ['', '0', 'nan', 'NaN', '-']:
            unique_id = str(uuid.uuid4())[:8]
            result_mapping[index] = unique_id
            generated_ids.add(unique_id)
            continue
        
        # Extract first three letters from name (uppercase)
        name_clean = ''.join(char for char in name.strip().upper() if char.isalpha())
        name_prefix = name_clean[:3].ljust(3, 'X')
        
        # Extract first two letters from department (uppercase)
        if department and str(department).strip():
            dept_clean = ''.join(char for char in str(department).strip().upper() if char.isalpha())
            dept_prefix = dept_clean[:2].ljust(2, 'X')
        else:
            dept_prefix = 'XX'
        
        # Format tenant ID with leading zeros (3 digits)
        tenant_str = str(tenant_id).zfill(3)
        
        # Generate base employee ID
        base_id = f"{name_prefix}-{dept_prefix}-{tenant_str}"
        
        # Check for collisions in existing DB + already generated IDs
        collision_suffixes = ['', '-A', '-B', '-C', '-D', '-E', '-F', '-G', '-H', '-I', '-J']
        
        candidate_id = None
        for suffix in collision_suffixes:
            test_id = f"{base_id}{suffix}"
            
            # Check if this ID exists in DB or already generated in this batch
            if test_id not in existing_ids and test_id not in generated_ids:
                candidate_id = test_id
                break
        
        # If all suffixes exhausted, use UUID fallback
        if not candidate_id:
            candidate_id = str(uuid.uuid4())[:8]
        
        result_mapping[index] = candidate_id
        generated_ids.add(candidate_id)
    
    return result_mapping

def validate_excel_columns(df_columns, required_columns, optional_columns=None):
    """
    Validate that all required columns are present in the Excel file
    Optional columns are not required but will be used if present
    """
    if optional_columns is None:
        optional_columns = []
    
    # Check required columns
    missing_columns = set(required_columns) - set(df_columns)
    if missing_columns:
        return False, f"Missing required columns: {', '.join(missing_columns)}"
    
    # Check for unknown columns (not in required or optional)
    all_valid_columns = set(required_columns) | set(optional_columns)
    unknown_columns = set(df_columns) - all_valid_columns
    if unknown_columns:
        return False, f"Unknown columns found: {', '.join(unknown_columns)}. Valid columns are: {', '.join(sorted(all_valid_columns))}"
    
    return True, "All required columns present"

def clean_decimal_value(value):
    """
    Clean and convert value to decimal - optimized for pandas data
    """
    from decimal import Decimal
    try:
        # Handle pandas NaN values first
        if pd.isna(value) or pd.isnull(value):
            return Decimal('0.00')
        
        # Handle numpy NaN
        if isinstance(value, (np.floating, np.integer)) and np.isnan(value):
            return Decimal('0.00')
            
        # Handle common null/empty values
        if value in [None, '', 'NaN', 'nan', 'NULL', 'null']:
            return Decimal('0.00')
            
        # Remove any commas and convert to string
        clean_value = str(value).replace(',', '').strip()
        
        # Handle empty string after cleaning
        if not clean_value or clean_value.lower() in ['nan', 'none', 'null']:
            return Decimal('0.00')
            
        return Decimal(clean_value)
    except (ValueError, TypeError, OverflowError):
        return Decimal('0.00')

def clean_int_value(value):
    """
    Clean and convert value to integer - optimized for pandas data
    """
    try:
        # Handle pandas NaN values first
        if pd.isna(value) or pd.isnull(value):
            return 0
        
        # Handle numpy NaN
        if isinstance(value, (np.floating, np.integer)) and np.isnan(value):
            return 0
            
        # Handle common null/empty values
        if value in [None, '', 'NaN', 'nan', 'NULL', 'null']:
            return 0
            
        # Remove any commas and convert to string
        clean_value = str(value).replace(',', '').strip()
        
        # Handle empty string after cleaning
        if not clean_value or clean_value.lower() in ['nan', 'none', 'null']:
            return 0
            
        return int(float(clean_value))
    except (ValueError, TypeError, OverflowError):
        return 0

def is_valid_name(name):
    """
    Check if a name is valid (not empty, not just '-', not '0', etc.)
    Enhanced to handle pandas NaN values
    """
    # Handle pandas NaN first
    if pd.isna(name) or pd.isnull(name):
        return False
        
    # Handle numpy NaN
    if isinstance(name, (np.floating, np.integer)) and np.isnan(name):
        return False
    
    if not name:
        return False
        
    name_str = str(name).strip()
    invalid_names = ['', '-', '0', 'nan', 'NaN', 'None', 'none', 'NULL', 'null']
    
    # Check if name is just one of the invalid values
    if name_str.lower() in [x.lower() for x in invalid_names]:
        return False
        
    # Check if name is only made up of special characters
    if all(c in '- _.,#@!$%^&*()' for c in name_str):
        return False
        
    return True 


def run_bulk_aggregation(tenant, attendance_date):
    """
    Background aggregation function that processes monthly attendance summaries.
    
    This function runs in a background thread to avoid blocking the API response.
    It aggregates DailyAttendance records into monthly Attendance summaries.
    
    Args:
        tenant: Tenant instance
        attendance_date: Date object for the month to aggregate
        
    Returns:
        dict: Aggregation results with timing and statistics
    """
    import logging
    import time
    from datetime import date
    from django.db import transaction, connection
    from ..models import DailyAttendance, Attendance, EmployeeProfile
    
    logger = logging.getLogger(__name__)
    start_time = time.time()
    
    try:
        logger.info(f"🔄 BACKGROUND AGGREGATION: Starting for tenant {tenant.id}, month {attendance_date.year}-{attendance_date.month:02d}")
        
        # Get all DailyAttendance records for this tenant and month
        daily_records = DailyAttendance.objects.filter(
            tenant=tenant,
            date__year=attendance_date.year,
            date__month=attendance_date.month
        ).select_related().only(
            'employee_id', 'employee_name', 'department', 'attendance_status', 
            'ot_hours', 'late_minutes'
        )
        
        if not daily_records.exists():
            logger.info(f"⚠️ BACKGROUND AGGREGATION: No daily records found for {attendance_date.year}-{attendance_date.month:02d}")
            return {
                'status': 'no_data',
                'message': 'No daily attendance records found for this month',
                'processing_time': f"{time.time() - start_time:.3f}s"
            }
        
        # Aggregate data by employee
        aggregated_data = {}
        records_processed = 0
        
        for record in daily_records:
            emp_id = record.employee_id
            
            if emp_id not in aggregated_data:
                aggregated_data[emp_id] = {
                    'employee_name': record.employee_name,
                    'department': record.department,
                    'present_days': 0.0,
                    'absent_days': 0.0,
                    'half_days': 0,
                    'off_days_marked': 0,
                    'paid_leave_days': 0,
                    'ot_hours': 0.0,
                    'late_minutes': 0,
                    'records_count': 0
                }
            
            # Aggregate present days (PRESENT and PAID_LEAVE count as 1, HALF_DAY as 0.5)
            if record.attendance_status in ['PRESENT', 'PAID_LEAVE']:
                aggregated_data[emp_id]['present_days'] += 1.0
            elif record.attendance_status == 'HALF_DAY':
                aggregated_data[emp_id]['present_days'] += 0.5
                aggregated_data[emp_id]['half_days'] += 1
            
            # ✅ FIX: Only count explicit ABSENT status - don't count unmarked days
            if record.attendance_status == 'ABSENT':
                aggregated_data[emp_id]['absent_days'] += 1.0
            
            # Count OFF days (explicitly marked)
            if record.attendance_status == 'OFF':
                aggregated_data[emp_id]['off_days_marked'] += 1
            
            # Count PAID_LEAVE separately
            if record.attendance_status == 'PAID_LEAVE':
                aggregated_data[emp_id]['paid_leave_days'] += 1
            
            # Aggregate OT hours and late minutes
            aggregated_data[emp_id]['ot_hours'] += float(record.ot_hours or 0)
            aggregated_data[emp_id]['late_minutes'] += int(record.late_minutes or 0)
            aggregated_data[emp_id]['records_count'] += 1
            records_processed += 1
        
        logger.info(f"📊 BACKGROUND AGGREGATION: Processed {records_processed} daily records for {len(aggregated_data)} employees")
        
        # OPTIMIZATION: Pre-calculate common values once (outside loop)
        aggregation_start_time = time.time()
        import calendar
        from ..services.salary_service import SalaryCalculationService
        
        # Pre-calculate calendar days and month start date (same for all employees)
        year = attendance_date.year
        month_num = attendance_date.month
        days_in_month = calendar.monthrange(year, month_num)[1]
        attendance_date_month = date(year, month_num, 1)
        month_names = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
        month_name = month_names[month_num - 1]
        
        # OPTIMIZATION: Bulk fetch all employees in ONE query instead of N queries
        employee_ids_list = list(aggregated_data.keys())
        employees_dict = {}
        if employee_ids_list:
            employees_qs = EmployeeProfile.objects.filter(
                tenant=tenant,
                employee_id__in=employee_ids_list,
                is_active=True
            ).only(
                'employee_id', 'date_of_joining', 'off_monday', 'off_tuesday', 
                'off_wednesday', 'off_thursday', 'off_friday', 'off_saturday', 'off_sunday'
            )
            employees_dict = {emp.employee_id: emp for emp in employees_qs}
        
        logger.info(f"🚀 OPTIMIZED: Fetched {len(employees_dict)} employees in bulk (vs {len(employee_ids_list)} individual queries)")
        
        # OPTIMIZATION: Pre-calculate month boundaries once (used by working days calculation)
        from datetime import timedelta
        month_end = date(year, month_num, days_in_month)
        
        # Process each employee with pre-fetched data
        attendance_records = []
        errors = []
        
        for emp_id, data in aggregated_data.items():
            try:
                # Get employee from pre-fetched dictionary (no DB query)
                employee = employees_dict.get(emp_id)
                
                if employee:
                    # OPTIMIZED: Calculate working days with pre-computed values
                    try:
                        # Fast-path: Build off-day set once
                        off_days = set()
                        if bool(employee.off_monday): off_days.add(0)
                        if bool(employee.off_tuesday): off_days.add(1)
                        if bool(employee.off_wednesday): off_days.add(2)
                        if bool(employee.off_thursday): off_days.add(3)
                        if bool(employee.off_friday): off_days.add(4)
                        if bool(employee.off_saturday): off_days.add(5)
                        if bool(employee.off_sunday): off_days.add(6)
                        
                        # Determine start date based on DOJ
                        doj = employee.date_of_joining
                        if isinstance(doj, str):
                            try:
                                from datetime import datetime as _dt
                                doj = _dt.fromisoformat(doj).date()
                            except Exception:
                                doj = None
                        
                        # Determine start date based on DOJ
                        if not doj:
                            start_date = attendance_date_month
                        elif doj > month_end:
                            total_working_days = 0
                            start_date = None  # Skip calculation
                        else:
                            # DOJ is in or before the month
                            if doj.year == year and doj.month == month_num and doj > attendance_date_month:
                                start_date = doj
                            else:
                                start_date = attendance_date_month
                        
                        # Calculate working days if we have a valid start date
                        if start_date is not None:
                            working_days = 0
                            current_date = start_date
                            while current_date <= month_end:
                                if current_date.weekday() not in off_days:
                                    working_days += 1
                                current_date += timedelta(days=1)
                            total_working_days = working_days
                        # else: total_working_days already set to 0 above
                            
                    except Exception as e:
                        # Fallback: use calendar days if calculation fails
                        total_working_days = days_in_month
                        logger.warning(f"⚠️ Could not calculate working days for employee {emp_id}: {str(e)}")
                else:
                    # Fallback: use calendar days if employee not found
                    total_working_days = days_in_month
                    logger.warning(f"⚠️ Employee {emp_id} not found, using calendar days for working days calculation")
                
                # ✅ FIX: Use the explicit absent_days count from aggregation
                # Don't calculate based on unmarked days
                absent_days = data.get('absent_days', 0.0)
                
                # Calculate off_days (days that are employee's weekly offs)
                # This is calendar_days - total_working_days (excluding holidays)
                off_days_count = max(0, days_in_month - total_working_days)
                
                # Calculate unmarked days: days with no attendance record at all
                # records_count tells us how many days have DailyAttendance records
                # unmarked_days = days without any DailyAttendance record (excluding off days)
                records_count = data.get('records_count', 0)
                unmarked_days = max(0, days_in_month - records_count - off_days_count)
                
                logger.info(f"Employee {emp_id}: days_in_month={days_in_month}, records_count={records_count}, present={data.get('present_days', 0)}, absent={data.get('absent_days', 0)}, off={data.get('off_days_marked', 0)}, off_days_count={off_days_count}, unmarked={unmarked_days}")
                
                # Create monthly attendance record
                attendance_record = Attendance(
                    tenant=tenant,
                    employee_id=emp_id,
                    name=data['employee_name'],
                    department=data['department'],
                    date=attendance_date_month,
                    calendar_days=days_in_month,
                    total_working_days=total_working_days,
                    present_days=data['present_days'],
                    absent_days=absent_days,
                    unmarked_days=unmarked_days,
                    ot_hours=data['ot_hours'],
                    late_minutes=data['late_minutes']
                )
                attendance_records.append(attendance_record)
                
            except Exception as e:
                error_msg = f"Error processing employee {emp_id}: {str(e)}"
                errors.append(error_msg)
                logger.error(f"❌ {error_msg}")
        
        # Bulk create/update attendance records using atomic transaction
        db_start_time = time.time()
        created_count = 0
        updated_count = 0
        
        with transaction.atomic():
            if attendance_records:
                # Get existing records to determine updates vs creates
                existing_records = Attendance.objects.filter(
                    tenant=tenant,
                    employee_id__in=[r.employee_id for r in attendance_records],
                    date=attendance_date_month
                )
                
                existing_records_dict = {rec.employee_id: rec for rec in existing_records}
                
                # Separate records for create and update
                records_to_create = []
                records_to_update = []
                
                for record in attendance_records:
                    if record.employee_id in existing_records_dict:
                        # Update existing record with primary key
                        existing_record = existing_records_dict[record.employee_id]
                        existing_record.name = record.name
                        existing_record.department = record.department
                        existing_record.calendar_days = record.calendar_days
                        existing_record.total_working_days = record.total_working_days
                        existing_record.present_days = record.present_days
                        existing_record.absent_days = record.absent_days
                        existing_record.unmarked_days = record.unmarked_days
                        existing_record.ot_hours = record.ot_hours
                        existing_record.late_minutes = record.late_minutes
                        records_to_update.append(existing_record)
                    else:
                        # Create new record
                        records_to_create.append(record)
                
                # Bulk create new records
                if records_to_create:
                    # Use raw SQL to handle legacy penalty_days and bonus_sundays columns
                    try:
                        from django.db import connection
                        from django.utils import timezone
                        with connection.cursor() as cursor:
                            # Build parameterized query - 17 fields including penalty_days and bonus_sundays
                            placeholders = ', '.join(['%s'] * 17)
                            value_placeholders = ', '.join([f'({placeholders})'] * len(records_to_create))
                            
                            sql = f"""
                                INSERT INTO excel_data_attendance 
                                (tenant_id, employee_id, name, department, date, calendar_days, total_working_days, 
                                 present_days, absent_days, unmarked_days, holiday_days, ot_hours, late_minutes, 
                                 created_at, updated_at, penalty_days, bonus_sundays)
                                VALUES {value_placeholders}
                                ON CONFLICT (tenant_id, employee_id, date) DO NOTHING
                            """
                            
                            params = []
                            now = timezone.now()
                            for record in records_to_create:
                                params.extend([
                                    record.tenant.id, record.employee_id, record.name, record.department,
                                    record.date, record.calendar_days, record.total_working_days,
                                    record.present_days, record.absent_days, record.unmarked_days,
                                    0, float(record.ot_hours), record.late_minutes, now, now, 
                                    0, 0  # penalty_days=0, bonus_sundays=0
                                ])
                            
                            cursor.execute(sql, params)
                            created_count = cursor.rowcount
                            logger.info(f"✅ BACKGROUND AGGREGATION: Created {created_count} new attendance records (with legacy fields)")
                    except Exception as e:
                        # Fallback to regular bulk_create if raw SQL fails
                        logger.warning(f"Raw SQL insert failed, using bulk_create: {e}")
                        try:
                            Attendance.objects.bulk_create(records_to_create, batch_size=100)
                            created_count = len(records_to_create)
                            logger.info(f"✅ BACKGROUND AGGREGATION: Created {created_count} new attendance records (fallback)")
                        except Exception as e2:
                            logger.error(f"❌ Both raw SQL and bulk_create failed: {e2}")
                            created_count = 0
                
                # Bulk update existing records (now with primary keys)
                if records_to_update:
                    Attendance.objects.bulk_update(
                        records_to_update,
                        ['name', 'department', 'calendar_days', 'total_working_days', 
                         'present_days', 'absent_days', 'ot_hours', 'late_minutes'],
                        batch_size=100
                    )
                    updated_count = len(records_to_update)
                    logger.info(f"✅ BACKGROUND AGGREGATION: Updated {updated_count} existing attendance records")
        
        db_time = time.time() - db_start_time
        
        # Clear relevant caches - OPTIMIZED CACHE INVALIDATION
        cache_start_time = time.time()
        from django.core.cache import cache
        
        tenant_id = tenant.id if tenant else 'default'
        date_str = attendance_date.strftime('%Y-%m-%d')
        
        # OPTIMIZATION: Only clear critical cache keys immediately
        # Less critical caches will be cleared on-demand when accessed
        critical_cache_keys = [
            f"payroll_overview_{tenant_id}",
            f"months_with_attendance_{tenant_id}",
            f"attendance_all_records_{tenant_id}",
            f"monthly_attendance_summary_{tenant_id}_{attendance_date.year}_{attendance_date.month}",
            f"dashboard_stats_{tenant_id}",
        ]
        
        # OPTIMIZATION: Use pattern deletion for attendance_all_records (clears all variations at once)
        try:
            cache.delete_pattern(f"attendance_all_records_{tenant_id}_*")
            logger.debug(f"✅ Cleared attendance_all_records pattern for tenant {tenant_id}")
        except (AttributeError, NotImplementedError):
            # Fallback: Clear base key
            cache.delete(f"attendance_all_records_{tenant_id}")
        
        # OPTIMIZATION: Use pattern deletion for eligible_employees (much faster than 30+ individual deletes)
        try:
            cache.delete_pattern(f"eligible_employees_{tenant_id}_*")
            cache.delete_pattern(f"eligible_employees_progressive_{tenant_id}_*")
            cache.delete_pattern(f"total_eligible_count_{tenant_id}_*")
            logger.debug(f"✅ Cleared eligible_employees patterns for tenant {tenant_id}")
        except (AttributeError, NotImplementedError):
            # Fallback: Only clear critical date caches (not all days)
            # Clear first day of month (most commonly accessed)
            month_start_str = date(attendance_date.year, attendance_date.month, 1).strftime('%Y-%m-%d')
            critical_cache_keys.extend([
                f"eligible_employees_{tenant_id}_{month_start_str}",
                f"eligible_employees_progressive_{tenant_id}_{month_start_str}_initial",
            ])
        
        # OPTIMIZATION: Use pattern deletion for frontend charts
        try:
            cache.delete_pattern(f"frontend_charts_{tenant_id}_*")
            logger.debug(f"✅ Cleared frontend_charts pattern for tenant {tenant_id}")
        except (AttributeError, NotImplementedError):
            # Fallback: Clear common chart cache keys
            chart_keys = [
                f"frontend_charts_{tenant_id}_this_month_All_",
                f"frontend_charts_{tenant_id}_last_6_months_All_",
            ]
            critical_cache_keys.extend(chart_keys)
        
        # Clear critical cache keys
        for cache_key in critical_cache_keys:
            cache.delete(cache_key)
        
        # OPTIMIZATION: Directory data caches are less critical, clear them lazily
        # They will be refreshed on next access
        
        cache_time = time.time() - cache_start_time
        logger.info(f"🗑️ OPTIMIZED CACHE CLEAR: Cleared {len(critical_cache_keys)} critical keys + patterns in {cache_time:.3f}s")
        
        total_time = time.time() - start_time
        
        result = {
            'status': 'success',
            'message': f'Successfully aggregated {len(aggregated_data)} employees',
            'statistics': {
                'employees_processed': len(aggregated_data),
                'daily_records_processed': records_processed,
                'attendance_records_created': created_count,
                'attendance_records_updated': updated_count,
                'errors_count': len(errors)
            },
            'performance': {
                'total_time': f"{total_time:.3f}s",
                'aggregation_time': f"{time.time() - aggregation_start_time:.3f}s",
                'database_time': f"{db_time:.3f}s",
                'cache_clear_time': f"{cache_time:.3f}s"
            },
            'errors': errors[:5] if errors else []  # Show first 5 errors
        }
        
        logger.info(f"✅ BACKGROUND AGGREGATION: Completed in {total_time:.3f}s - {created_count} created, {updated_count} updated")
        
        return result
        
    except Exception as e:
        error_msg = f"Background aggregation failed: {str(e)}"
        logger.error(f"❌ {error_msg}")
        
        return {
            'status': 'error',
            'message': error_msg,
            'processing_time': f"{time.time() - start_time:.3f}s"
        }
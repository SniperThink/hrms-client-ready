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
                    'ot_hours': 0.0,
                    'late_minutes': 0,
                    'records_count': 0
                }
            
            # Aggregate present days (PRESENT and PAID_LEAVE count as 1, HALF_DAY as 0.5)
            if record.attendance_status in ['PRESENT', 'PAID_LEAVE']:
                aggregated_data[emp_id]['present_days'] += 1.0
            elif record.attendance_status == 'HALF_DAY':
                aggregated_data[emp_id]['present_days'] += 0.5
            
            # Aggregate OT hours and late minutes
            aggregated_data[emp_id]['ot_hours'] += float(record.ot_hours or 0)
            aggregated_data[emp_id]['late_minutes'] += int(record.late_minutes or 0)
            aggregated_data[emp_id]['records_count'] += 1
            records_processed += 1
        
        logger.info(f"📊 BACKGROUND AGGREGATION: Processed {records_processed} daily records for {len(aggregated_data)} employees")
        
        # Calculate working days for each employee
        aggregation_start_time = time.time()
        attendance_records = []
        errors = []
        
        for emp_id, data in aggregated_data.items():
            try:
                # Get employee details for working days calculation
                try:
                    employee = EmployeeProfile.objects.get(
                        tenant=tenant, 
                        employee_id=emp_id, 
                        is_active=True
                    )
                    
                    # Calculate working days based on DOJ
                    from ..services.salary_service import SalaryCalculationService
                    month_names = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                                 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
                    total_working_days = SalaryCalculationService._calculate_employee_working_days(
                        employee, attendance_date.year, month_names[attendance_date.month - 1]
                    )
                except EmployeeProfile.DoesNotExist:
                    # Fallback: use calendar days if employee not found
                    import calendar
                    total_working_days = calendar.monthrange(attendance_date.year, attendance_date.month)[1]
                    logger.warning(f"⚠️ Employee {emp_id} not found, using calendar days for working days calculation")
                except Exception as e:
                    # Fallback: use standard 30 days if calculation fails
                    total_working_days = 30
                    logger.warning(f"⚠️ Could not calculate working days for employee {emp_id}: {str(e)}")
                
                # Calculate absent days
                absent_days = max(0, total_working_days - data['present_days'])
                
                # Create monthly attendance record
                attendance_date_month = date(attendance_date.year, attendance_date.month, 1)
                
                # Get calendar days for the month
                import calendar
                days_in_month = calendar.monthrange(attendance_date.year, attendance_date.month)[1]
                
                attendance_records.append(Attendance(
                    tenant=tenant,
                    employee_id=emp_id,
                    name=data['employee_name'],
                    department=data['department'],
                    date=attendance_date_month,
                    calendar_days=days_in_month,
                    total_working_days=total_working_days,
                    present_days=data['present_days'],
                    absent_days=absent_days,
                    ot_hours=data['ot_hours'],
                    late_minutes=data['late_minutes']
                ))
                
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
                        existing_record.ot_hours = record.ot_hours
                        existing_record.late_minutes = record.late_minutes
                        records_to_update.append(existing_record)
                    else:
                        # Create new record
                        records_to_create.append(record)
                
                # Bulk create new records
                if records_to_create:
                    Attendance.objects.bulk_create(records_to_create, batch_size=100)
                    created_count = len(records_to_create)
                    logger.info(f"✅ BACKGROUND AGGREGATION: Created {created_count} new attendance records")
                
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
        
        # Clear relevant caches - COMPREHENSIVE CACHE INVALIDATION
        cache_start_time = time.time()
        from django.core.cache import cache
        
        tenant_id = tenant.id if tenant else 'default'
        date_str = attendance_date.strftime('%Y-%m-%d')
        
        # Clear all attendance-related caches
        cache_keys_to_clear = [
            f"payroll_overview_{tenant_id}",
            f"months_with_attendance_{tenant_id}",
            f"attendance_all_records_{tenant_id}",
            f"monthly_attendance_summary_{tenant_id}_{attendance_date.year}_{attendance_date.month}",
            f"dashboard_stats_{tenant_id}",
            f"directory_data_{tenant_id}",
            f"directory_data_full_{tenant_id}",
        ]
        
        # Clear eligible employees caches for all dates in the month
        import calendar
        from datetime import date as _date
        days_in_month = calendar.monthrange(attendance_date.year, attendance_date.month)[1]
        for day in range(1, days_in_month + 1):
            day_date = _date(attendance_date.year, attendance_date.month, day)
            day_str = day_date.strftime('%Y-%m-%d')
            cache_keys_to_clear.extend([
                f"eligible_employees_{tenant_id}_{day_str}",
                f"eligible_employees_progressive_{tenant_id}_{day_str}_initial",
                f"eligible_employees_progressive_{tenant_id}_{day_str}_remaining",
                f"total_eligible_count_{tenant_id}_{day_str}",
            ])
        
        # Clear all cache keys
        for cache_key in cache_keys_to_clear:
            cache.delete(cache_key)
        
        # Clear frontend charts cache (pattern matching)
        try:
            cache.delete_pattern(f"frontend_charts_{tenant_id}_*")
        except AttributeError:
            # Fallback: Clear common chart cache keys
            chart_keys = [
                f"frontend_charts_{tenant_id}_this_month_All_",
                f"frontend_charts_{tenant_id}_last_6_months_All_",
                f"frontend_charts_{tenant_id}_last_12_months_All_",
                f"frontend_charts_{tenant_id}_last_5_years_All_"
            ]
            for key in chart_keys:
                cache.delete(key)
        
        cache_time = time.time() - cache_start_time
        logger.info(f"🗑️ BULK AGGREGATION: Cleared {len(cache_keys_to_clear)} cache keys in {cache_time:.3f}s")
        
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
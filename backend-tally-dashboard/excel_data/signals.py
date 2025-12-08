from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from .models import DailyAttendance, Attendance, AdvanceLedger, Payment, SalaryData, MonthlyAttendanceSummary, EmployeeProfile, ChartAggregatedData, CalculatedSalary
from django.db.models import Sum
from datetime import date
from decimal import Decimal


def clean_null_bytes_from_instance(instance):
    """Clean null bytes from all CharField and TextField values in a model instance"""
    from django.db import models
    
    for field in instance._meta.fields:
        if isinstance(field, (models.CharField, models.TextField)):
            value = getattr(instance, field.name)
            if isinstance(value, str) and '\x00' in value:
                setattr(instance, field.name, value.replace('\x00', ''))


@receiver(pre_save, sender=CalculatedSalary)
def clean_calculated_salary_before_save(sender, instance, **kwargs):
    """Clean null bytes from CalculatedSalary string fields before saving"""
    clean_null_bytes_from_instance(instance)


@receiver(pre_save, sender=ChartAggregatedData)
def clean_chart_data_before_save(sender, instance, **kwargs):
    """Clean null bytes from ChartAggregatedData string fields before saving"""
    clean_null_bytes_from_instance(instance)

@receiver([post_save, post_delete], sender=DailyAttendance)
def sync_attendance_from_daily(sender, instance, **kwargs):
    """
    Automatically aggregate DailyAttendance into monthly Attendance records.
    This ensures that when daily attendance is recorded, monthly attendance is automatically updated.
    Only processes attendance for active employees.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Get basic info first
    tenant = instance.tenant
    employee_id = instance.employee_id
    
    if not tenant or not employee_id:
        return
    
    # Early exit: Skip processing for deactivated or non-existent employees
    try:
        employee = EmployeeProfile.objects.get(tenant=tenant, employee_id=employee_id, is_active=True)
        employee_name = f"{employee.first_name} {employee.last_name}".strip()
        department = employee.department or 'General'
    except EmployeeProfile.DoesNotExist:
        # Employee doesn't exist or is deactivated - skip processing silently
        return
    except Exception:
        # Any other error - skip processing
        return
    
    try:
        year = instance.date.year
        month = instance.date.month

        logger.info(f"🔄 SIGNAL TRIGGERED: {instance.employee_id} - {instance.date} - {instance.attendance_status}")

        # Get all daily attendance records for this employee for this month
        daily_records = DailyAttendance.objects.filter(
            tenant=tenant,
            employee_id=employee_id,
            date__year=year,
            date__month=month,
        )

        # Calculate aggregated values
        from django.db.models import Sum, Case, When, FloatField, Value, Count
        import calendar

        # Aggregate present days (PRESENT and PAID_LEAVE count as 1, HALF_DAY as 0.5)
        present_aggregate = daily_records.aggregate(
            present_days=Sum(
                Case(
                    When(attendance_status__in=['PRESENT', 'PAID_LEAVE'], then=Value(1.0)),
                    When(attendance_status='HALF_DAY', then=Value(0.5)),
                    default=Value(0.0),
                    output_field=FloatField()
                )
            ),
            ot_hours=Sum('ot_hours'),
            late_minutes=Sum('late_minutes')
        )

        present_days = float(present_aggregate['present_days'] or 0)
        ot_hours = float(present_aggregate['ot_hours'] or 0)
        late_minutes = int(present_aggregate['late_minutes'] or 0)

        # Calculate working days for the month based on employee's joining date and off days
        days_in_month = calendar.monthrange(year, month)[1]
        
        try:
            from excel_data.services.salary_service import SalaryCalculationService
            month_names = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
            total_working_days = SalaryCalculationService._calculate_employee_working_days(
                employee, year, month_names[month - 1]
            )
        except Exception as e:
            # Fallback: use calendar days if calculation fails
            total_working_days = days_in_month
            logger.debug(f'Could not calculate working days for employee {employee_id} in signal: {str(e)}')
        
        # ✅ FIX: Only count EXPLICIT "ABSENT" status - don't count unmarked days
        explicit_absent_count = daily_records.filter(attendance_status='ABSENT').count()
        absent_days = float(explicit_absent_count)

        # Create or update monthly Attendance record
        attendance_date = date(year, month, 1)  # First day of the month
        
        # Create or update monthly Attendance record
        # Handle legacy penalty_days and bonus_sundays fields that may exist in DB but not in model
        attendance_obj, created = Attendance.objects.update_or_create(
            tenant=tenant,
            employee_id=employee_id,
            date=attendance_date,
            defaults={
                'name': employee_name,
                'department': department,
                'calendar_days': days_in_month,
                'total_working_days': total_working_days,
                'present_days': present_days,
                'absent_days': absent_days,
                'ot_hours': ot_hours,
                'late_minutes': late_minutes,
            }
        )
        
        # Set penalty_days and bonus_sundays if the columns exist in DB (legacy fields)
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE excel_data_attendance 
                    SET penalty_days = COALESCE(penalty_days, 0),
                        bonus_sundays = COALESCE(bonus_sundays, 0)
                    WHERE id = %s AND (penalty_days IS NULL OR bonus_sundays IS NULL)
                """, [attendance_obj.id])
        except Exception:
            # Columns don't exist or update failed - ignore
            pass

        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"✅ SIGNAL COMPLETED: Updated monthly Attendance for {employee_id} - {year}-{month:02d}: {present_days} present days")
        
        # BACKGROUND THREAD: Check and mark Sunday bonus if threshold is met
        try:
            from excel_data.tasks import mark_sunday_bonus_background
            logger.info(f"🔄 [Signal] Triggering Sunday bonus check for {employee_id} on {instance.date}")
            mark_sunday_bonus_background(tenant.id, employee_id, instance.date)
        except Exception as e:
            logger.error(f"❌ [Signal] Failed to trigger Sunday bonus background task: {e}", exc_info=True)
        
        # CACHE INVALIDATION: Clear relevant caches to prevent stale data
        from django.core.cache import cache
        tenant_id = tenant.id if tenant else 'default'
        
        # Clear attendance-related caches (pattern matching for all variations)
        cache_keys_to_clear = [
            f"attendance_all_records_{tenant_id}",
            f"payroll_overview_{tenant_id}",
            f"months_with_attendance_{tenant_id}",
            f"directory_data_{tenant_id}",
            f"directory_data_full_{tenant_id}",
        ]
        
        # Clear specific date/month caches
        from datetime import date as _date, timedelta
        month_start = _date(year, month, 1)
        date_str = month_start.strftime('%Y-%m-%d')
        cache_keys_to_clear.extend([
            f"eligible_employees_{tenant_id}_{date_str}",
            f"eligible_employees_progressive_{tenant_id}_{date_str}_initial",
            f"eligible_employees_progressive_{tenant_id}_{date_str}_remaining",
            f"total_eligible_count_{tenant_id}_{date_str}",
        ])
        
        # Clear weekly attendance cache for the specific date and all days in that week
        # Weekly attendance shows a week's data, so we need to invalidate cache for all 7 days
        attendance_date = instance.date
        start_of_week = attendance_date - timedelta(days=attendance_date.weekday())  # Monday
        for day_offset in range(7):  # Clear cache for all 7 days of the week
            week_date = start_of_week + timedelta(days=day_offset)
            week_cache_key = f"weekly_attendance_{tenant_id}_{week_date.isoformat()}"
            cache_keys_to_clear.append(week_cache_key)
        
        # Clear caches
        cleared_count = 0
        for key in cache_keys_to_clear:
            if cache.delete(key):
                cleared_count += 1
                logger.debug(f"✅ SIGNAL: Cleared cache key: {key}")
        
        logger.info(f"🗑️ SIGNAL: Cleared {cleared_count}/{len(cache_keys_to_clear)} cache keys for tenant {tenant_id}")
        
        # CRITICAL: Clear all attendance_all_records cache variations (pattern-based)
        # Cache keys follow pattern: attendance_all_records_{tenant_id}_{param_signature}
        try:
            cache.delete_pattern(f"attendance_all_records_{tenant_id}_*")
            logger.debug(f"✅ SIGNAL: Cleared all attendance_all_records cache variations (pattern)")
        except (AttributeError, NotImplementedError):
            # Fallback: Clear common variations manually
            common_time_periods = ['last_6_months', 'last_12_months', 'last_5_years', 'this_month', 'custom', 'custom_month', 'custom_range', 'one_day']
            for period in common_time_periods:
                variations = [
                    f"attendance_all_records_{tenant_id}_{period}_None_None_None_None_rt_1",
                    f"attendance_all_records_{tenant_id}_{period}_None_None_None_None_rt_0",
                ]
                # For one_day and custom_range, also clear with date
                if period in ['one_day', 'custom_range']:
                    instance_date_str = instance.date.strftime('%Y-%m-%d')
                    variations.append(f"attendance_all_records_{tenant_id}_{period}_None_None_{instance_date_str}_{instance_date_str}_rt_1")
                    variations.append(f"attendance_all_records_{tenant_id}_{period}_None_None_{instance_date_str}_{instance_date_str}_rt_0")
                
                for var_key in variations:
                    cache.delete(var_key)
            logger.debug(f"✅ SIGNAL: Cleared attendance_all_records cache variations (manual)")
        
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
        
        logger.debug(f"🗑️ SIGNAL: Cleared cache keys for tenant {tenant_id}")

    except Exception as exc:
        # Soft-fail – we don't want attendance updates to break
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"❌ SIGNAL FAILED: Failed to sync Attendance from DailyAttendance: {exc}")

# DISABLED: These signals are trying to update a non-existent 'total_advance' field in SalaryData
# The CalculatedSalary model is now used for advance calculations instead
"""
@receiver([post_save, post_delete], sender=AdvanceLedger)
def update_total_advance_on_advance_change(sender, instance, **kwargs):
    employee_id = instance.employee_id
    # Sum all advances for this employee
    total_advance = AdvanceLedger.objects.filter(employee_id=employee_id).aggregate(
        total=Sum('amount')
    )['total'] or Decimal('0.00')
    # Subtract all advance deductions from payments
    total_deduction = Payment.objects.filter(employee_id=employee_id).aggregate(
        total=Sum('advance_deduction')
    )['total'] or Decimal('0.00')
    # Update all SalaryData records for this employee
    SalaryData.objects.filter(employee_id=employee_id).update(total_advance=total_advance - total_deduction)

@receiver([post_save, post_delete], sender=Payment)
def update_total_advance_on_payment(sender, instance, **kwargs):
    employee_id = instance.employee_id
    # Sum all advances
    total_advance = AdvanceLedger.objects.filter(employee_id=employee_id).aggregate(
        total=Sum('amount')
    )['total'] or Decimal('0.00')
    # Subtract all advance deductions
    total_deduction = Payment.objects.filter(employee_id=employee_id).aggregate(
        total=Sum('advance_deduction')
    )['total'] or Decimal('0.00')
    # Update all SalaryData records for this employee
    SalaryData.objects.filter(employee_id=employee_id).update(total_advance=total_advance - total_deduction)
"""

@receiver([post_save, post_delete], sender=DailyAttendance)
def update_monthly_attendance_summary(sender, instance, **kwargs):
    """Maintain per-employee MonthlyAttendanceSummary aggregates. Only for active employees."""
    try:
        tenant = instance.tenant
        employee_id = instance.employee_id
        
        if not tenant or not employee_id:
            return
        
        # Early exit: Skip processing for deactivated or non-existent employees
        try:
            EmployeeProfile.objects.get(tenant=tenant, employee_id=employee_id, is_active=True)
        except EmployeeProfile.DoesNotExist:
            # Employee doesn't exist or is deactivated - skip processing
            return
        
        year = instance.date.year
        month = instance.date.month

        # Pull all daily attendance rows for the employee for the same month
        qs = DailyAttendance.objects.filter(
            tenant=tenant,
            employee_id=employee_id,
            date__year=year,
            date__month=month,
        )

        # Present counts: PRESENT and PAID_LEAVE count as 1, HALF_DAY as 0.5
        present_full = qs.filter(attendance_status__in=["PRESENT", "PAID_LEAVE"]).count()
        half_days = qs.filter(attendance_status="HALF_DAY").count()
        total_present = present_full + (half_days * 0.5)

        # Aggregate OT & late minutes
        aggregate_vals = qs.aggregate(
            ot_sum=Sum("ot_hours"),
            late_sum=Sum("late_minutes"),
        )
        ot_hours = aggregate_vals["ot_sum"] or Decimal("0")
        late_minutes = aggregate_vals["late_sum"] or 0

        # Calculate weekly penalty and Sunday bonus days
        weekly_penalty_days = Decimal("0")
        # Sunday bonus handled separately by marking Sunday as PRESENT (not tracked here)
        try:
            from excel_data.services.salary_service import SalaryCalculationService
            # Convert month number (1-12) to month name (JAN, FEB, etc.)
            month_names = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
            month_name = month_names[month - 1] if 1 <= month <= 12 else 'JAN'
            
            # Get employee object
            employee = EmployeeProfile.objects.get(tenant=tenant, employee_id=employee_id, is_active=True)
            
            # Check if penalty feature is enabled
            absent_enabled = getattr(tenant, 'weekly_absent_penalty_enabled', False)
            
            if absent_enabled:
                weekly_stats = SalaryCalculationService._compute_weekly_penalty_and_bonus(
                    employee, year, month_name
                )
                weekly_penalty_days = weekly_stats.get('weekly_penalty_days', Decimal("0"))
                
                import logging
                logger = logging.getLogger(__name__)
                if weekly_penalty_days > 0:
                    logger.info(f"📊 Calculated penalty for {employee_id} ({year}-{month:02d}): penalty={weekly_penalty_days}")
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"❌ Failed to calculate weekly penalty for {employee_id} ({year}-{month:02d}): {e}", exc_info=True)

        # Upsert summary
        MonthlyAttendanceSummary.objects.update_or_create(
            tenant=tenant,
            employee_id=employee_id,
            year=year,
            month=month,
            defaults={
                "present_days": Decimal(str(total_present)),
                "ot_hours": ot_hours,
                "late_minutes": late_minutes,
                "weekly_penalty_days": weekly_penalty_days,
                # Sunday bonus handled separately by marking Sunday as PRESENT
            },
        )
    except Exception as exc:
        # Soft-fail – we don't want attendance updates to break
        import logging
        logging.getLogger(__name__).error(f"Failed to update MonthlyAttendanceSummary: {exc}")


# ==================== Chart Aggregation Signals ====================
# Real-time sync to ChartAggregatedData for dashboard performance

@receiver(post_save, sender=SalaryData)
def sync_chart_data_from_salary(sender, instance, created, **kwargs):
    """
    Auto-sync ChartAggregatedData when SalaryData (Excel upload) is created/updated.
    
    NOTE: This processes individual records. For bulk uploads, use 
    sync_chart_data_batch() to avoid N+1 signal calls.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Skip if this is part of a bulk operation (will be handled by batch sync)
    if kwargs.get('raw', False):
        return
    
    try:
        chart_data, was_created = ChartAggregatedData.aggregate_from_salary_data(instance)
        action = "Created" if was_created else "Updated"
        logger.info(f"📊 Chart Data {action}: {instance.name} - {instance.month} {instance.year} (Excel)")
        
        # Clear cache for this period
        from django.core.cache import cache
        tenant_id = instance.tenant.id if instance.tenant else 'default'
        cache_pattern = f"frontend_charts_{tenant_id}_*"
        try:
            cache.delete_pattern(cache_pattern)
        except AttributeError:
            # Fallback if delete_pattern not available
            cache.delete(f"frontend_charts_{tenant_id}")
        
    except Exception as e:
        # Soft fail - don't break Excel upload if aggregation fails
        logger.warning(f"Failed to sync ChartAggregatedData from SalaryData: {e}")


@receiver(post_save, sender=CalculatedSalary)
def sync_chart_data_from_calculated(sender, instance, created, **kwargs):
    """
    Auto-sync ChartAggregatedData when CalculatedSalary (Frontend form) is created/updated.
    This ensures dashboard charts show frontend-calculated data immediately.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        chart_data, was_created = ChartAggregatedData.aggregate_from_calculated_salary(instance)
        action = "Created" if was_created else "Updated"
        # Clean null bytes from strings before logging
        clean_employee_name = instance.employee_name.replace('\x00', '') if instance.employee_name else ''
        clean_payroll_period = str(instance.payroll_period).replace('\x00', '') if instance.payroll_period else ''
        logger.info(f"📊 Chart Data {action}: {clean_employee_name} - {clean_payroll_period} (Frontend)")
        
        # Clear cache for this period
        from django.core.cache import cache
        tenant_id = instance.tenant.id if instance.tenant else 'default'
        cache_pattern = f"frontend_charts_{tenant_id}_*"
        try:
            cache.delete_pattern(cache_pattern)
        except AttributeError:
            # Fallback if delete_pattern not available
            cache.delete(f"frontend_charts_{tenant_id}")
        
    except Exception as e:
        # Soft fail - don't break salary calculation if aggregation fails
        logger.warning(f"Failed to sync ChartAggregatedData from CalculatedSalary: {e}")


@receiver(post_delete, sender=SalaryData)
def delete_chart_data_from_salary(sender, instance, **kwargs):
    """
    Remove ChartAggregatedData when SalaryData is deleted.
    Keeps data in sync.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Standardize month name
        MONTH_MAPPING = {
            'JANUARY': 'JAN', 'FEBRUARY': 'FEB', 'MARCH': 'MAR', 'APRIL': 'APR',
            'MAY': 'MAY', 'JUNE': 'JUN', 'JULY': 'JUL', 'AUGUST': 'AUG',
            'SEPTEMBER': 'SEP', 'OCTOBER': 'OCT', 'NOVEMBER': 'NOV', 'DECEMBER': 'DEC',
            'JAN': 'JAN', 'FEB': 'FEB', 'MAR': 'MAR', 'APR': 'APR',
            'JUN': 'JUN', 'JUL': 'JUL', 'AUG': 'AUG', 'SEP': 'SEP',
            'OCT': 'OCT', 'NOV': 'NOV', 'DEC': 'DEC'
        }
        month_short = MONTH_MAPPING.get(instance.month.upper(), 'JAN') if instance.month else 'JAN'
        
        deleted_count = ChartAggregatedData.objects.filter(
            tenant=instance.tenant,
            employee_id=instance.employee_id,
            year=instance.year,
            month=month_short
        ).delete()
        
        if deleted_count[0] > 0:
            logger.info(f"🗑️ Deleted {deleted_count[0]} chart data records for {instance.name}")
            
            # Clear cache
            from django.core.cache import cache
            tenant_id = instance.tenant.id if instance.tenant else 'default'
            try:
                cache.delete_pattern(f"frontend_charts_{tenant_id}_*")
            except AttributeError:
                cache.delete(f"frontend_charts_{tenant_id}")
                
    except Exception as e:
        logger.warning(f"Failed to delete ChartAggregatedData: {e}")


@receiver(post_delete, sender=CalculatedSalary)
def delete_chart_data_from_calculated(sender, instance, **kwargs):
    """
    Remove ChartAggregatedData when CalculatedSalary is deleted.
    Keeps data in sync.
    
    NOTE: This signal is optimized - for bulk deletions (e.g., payroll period deletion),
    ChartAggregatedData is deleted in bulk beforehand, so this signal becomes a no-op
    for those records. This prevents N+1 query issues and dramatically speeds up bulk deletes.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Skip if payroll_period is already deleted (bulk deletion case)
        # This prevents errors during bulk payroll period deletions
        try:
            payroll_period = instance.payroll_period
            month_name = payroll_period.month
            year = payroll_period.year
        except Exception:
            # Payroll period already deleted (bulk deletion case)
            return
        
        # Standardize month name
        MONTH_MAPPING = {
            'JANUARY': 'JAN', 'FEBRUARY': 'FEB', 'MARCH': 'MAR', 'APRIL': 'APR',
            'MAY': 'MAY', 'JUNE': 'JUN', 'JULY': 'JUL', 'AUGUST': 'AUG',
            'SEPTEMBER': 'SEP', 'OCTOBER': 'OCT', 'NOVEMBER': 'NOV', 'DECEMBER': 'DEC',
            'JAN': 'JAN', 'FEB': 'FEB', 'MAR': 'MAR', 'APR': 'APR',
            'JUN': 'JUN', 'JUL': 'JUL', 'AUG': 'AUG', 'SEP': 'SEP',
            'OCT': 'OCT', 'NOV': 'NOV', 'DEC': 'DEC'
        }
        month_short = MONTH_MAPPING.get(month_name.upper(), 'JAN')
        
        # Check if chart data already deleted (bulk deletion case)
        # Only delete if record still exists (optimization for bulk deletes)
        chart_data_exists = ChartAggregatedData.objects.filter(
            tenant=instance.tenant,
            employee_id=instance.employee_id,
            year=year,
            month=month_short
        ).exists()
        
        if chart_data_exists:
            deleted_count = ChartAggregatedData.objects.filter(
                tenant=instance.tenant,
                employee_id=instance.employee_id,
                year=year,
                month=month_short
            ).delete()
            
            if deleted_count[0] > 0:
                logger.info(f"🗑️ Deleted {deleted_count[0]} chart data records for {instance.employee_name}")
                
                # Clear cache (only once per employee, not per record)
                from django.core.cache import cache
                tenant_id = instance.tenant.id if instance.tenant else 'default'
                try:
                    cache.delete_pattern(f"frontend_charts_{tenant_id}_*")
                except AttributeError:
                    cache.delete(f"frontend_charts_{tenant_id}")
                
    except Exception as e:
        logger.warning(f"Failed to delete ChartAggregatedData: {e}")


@receiver(post_save, sender=EmployeeProfile)
def invalidate_cache_on_employee_update(sender, instance, created, **kwargs):
    """
    Automatically invalidate relevant caches when employee details are created or updated.
    This ensures that directory data, payroll overview, attendance records, and charts
    reflect the latest employee information immediately.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        from django.core.cache import cache
        
        tenant = instance.tenant
        tenant_id = tenant.id if tenant else 'default'
        employee_id = instance.employee_id
        
        # Comprehensive list of cache keys to invalidate
        cache_keys_to_clear = [
            # Directory data caches
            f"directory_data_{tenant_id}",
            f"directory_data_full_{tenant_id}",
            
            # Payroll overview cache
            f"payroll_overview_{tenant_id}",
            
            # Departments cache (in case department changed)
            f"all_departments_{tenant_id}",
            
            # Employee-specific attendance cache
            f"employee_attendance_{tenant_id}_{employee_id}" if employee_id else None,
        ]
        
        # Remove None values
        cache_keys_to_clear = [key for key in cache_keys_to_clear if key]
        
        # Clear all cache keys
        for key in cache_keys_to_clear:
            cache.delete(key)
        
        # CRITICAL: Clear all attendance_all_records cache variations (pattern-based)
        # Cache keys follow pattern: attendance_all_records_{tenant_id}_{param_signature}
        # This ensures attendance log cache is cleared when employee profile changes
        try:
            cache.delete_pattern(f"attendance_all_records_{tenant_id}_*")
            logger.debug(f"✅ SIGNAL: Cleared all attendance_all_records cache variations (pattern) for tenant {tenant_id}")
        except (AttributeError, NotImplementedError):
            # Fallback: Clear common variations manually (for database cache)
            common_time_periods = ['last_6_months', 'last_12_months', 'last_5_years', 'this_month', 'custom', 'custom_month', 'custom_range', 'one_day']
            for period in common_time_periods:
                variations = [
                    f"attendance_all_records_{tenant_id}_{period}_None_None_None_None_rt_1",
                    f"attendance_all_records_{tenant_id}_{period}_None_None_None_None_rt_0",
                ]
                for var_key in variations:
                    cache.delete(var_key)
            # Also clear base key
            cache.delete(f"attendance_all_records_{tenant_id}")
            logger.debug(f"✅ SIGNAL: Cleared attendance_all_records cache variations (manual fallback) for tenant {tenant_id}")
        
        # CRITICAL: Clear eligible_employees cache patterns (for attendance log)
        # This ensures that when employee active/inactive status changes, attendance log shows correct employees
        try:
            cache.delete_pattern(f"eligible_employees_{tenant_id}_*")
            cache.delete_pattern(f"eligible_employees_progressive_{tenant_id}_*")
            cache.delete_pattern(f"total_eligible_count_{tenant_id}_*")
            logger.debug(f"✅ SIGNAL: Cleared all eligible_employees cache patterns for tenant {tenant_id}")
        except (AttributeError, NotImplementedError):
            # Fallback: Clear base keys (less optimal but works)
            cache.delete(f"eligible_employees_{tenant_id}")
            cache.delete(f"total_eligible_count_{tenant_id}")
            logger.debug(f"✅ SIGNAL: Cleared eligible_employees base cache (fallback) for tenant {tenant_id}")
        
        # Clear frontend charts cache (pattern matching)
        try:
            cache.delete_pattern(f"frontend_charts_{tenant_id}_*")
        except AttributeError:
            # Fallback if delete_pattern not available (database cache doesn't support it)
            chart_keys = [
                f"frontend_charts_{tenant_id}_this_month_All_",
                f"frontend_charts_{tenant_id}_last_6_months_All_",
                f"frontend_charts_{tenant_id}_last_12_months_All_",
                f"frontend_charts_{tenant_id}_last_5_years_All_"
            ]
            for key in chart_keys:
                cache.delete(key)
        
        action = "Created" if created else "Updated"
        logger.info(f"🔄 Employee {action}: Cleared cache for employee {employee_id} (tenant {tenant_id}) - {len(cache_keys_to_clear)} cache keys invalidated")
        
    except Exception as e:
        # Soft fail - don't break employee updates if cache clearing fails
        logger.warning(f"Failed to invalidate cache on employee update: {e}") 
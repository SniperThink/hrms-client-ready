"""
Celery tasks for background processing
"""
import logging
from celery import shared_task
from django.db import transaction

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_chart_data_batch_task(self, tenant_id, year, month, source='excel'):
    """
    Celery task to sync ChartAggregatedData from SalaryData or CalculatedSalary
    
    Args:
        tenant_id: Tenant ID (int)
        year: Year (int)
        month: Month name (str, e.g. 'JUNE', 'JAN')
        source: 'excel' or 'frontend'
    
    Features:
        - Automatic retries on failure (max 3 attempts)
        - Survives server restarts
        - Task monitoring via Celery Flower
        - Proper error handling and logging
    """
    from excel_data.models import Tenant, SalaryData, CalculatedSalary, ChartAggregatedData
    
    try:
        # Re-fetch tenant
        tenant = Tenant.objects.get(id=tenant_id)
        logger.info(f"🔄 [Celery] Starting chart sync for {tenant.subdomain} - {month} {year} ({source})")
        
        if source == 'excel':
            synced_count = _sync_from_salary_data(tenant, year, month)
            logger.info(f"✅ [Celery] Synced {synced_count} records from SalaryData")
        elif source == 'frontend':
            synced_count = _sync_from_calculated_salary(tenant, year, month)
            logger.info(f"✅ [Celery] Synced {synced_count} records from CalculatedSalary")
        else:
            raise ValueError(f"Invalid source: {source}")
        
        # Clear cache after sync
        from django.core.cache import cache
        cache_pattern = f"frontend_charts_{tenant_id}_*"
        try:
            cache.delete_pattern(cache_pattern)
        except AttributeError:
            cache.delete(f"frontend_charts_{tenant_id}")
        
        return {
            'status': 'success',
            'tenant': tenant.subdomain,
            'year': year,
            'month': month,
            'source': source,
            'synced_count': synced_count
        }
        
    except Tenant.DoesNotExist:
        logger.error(f"❌ [Celery] Tenant {tenant_id} not found")
        raise
    except Exception as exc:
        logger.error(f"❌ [Celery] Chart sync failed: {exc}")
        # Retry the task
        raise self.retry(exc=exc)


def _sync_from_salary_data(tenant, year, month):
    """
    Sync ChartAggregatedData from SalaryData (Excel uploads)
    """
    from excel_data.models import SalaryData
    
    salary_records = SalaryData.objects.filter(
        tenant=tenant,
        year=year,
        month=month
    ).select_related('tenant')
    
    if not salary_records.exists():
        logger.warning(f"No SalaryData found for {month} {year}")
        return 0
    
    synced_count = 0
    with transaction.atomic():
        for salary_record in salary_records:
            try:
                from excel_data.models import ChartAggregatedData
                ChartAggregatedData.aggregate_from_salary_data(salary_record)
                synced_count += 1
            except Exception as e:
                logger.warning(f"Failed to sync {salary_record.name}: {e}")
    
    return synced_count


def _sync_from_calculated_salary(tenant, year, month):
    """
    Sync ChartAggregatedData from CalculatedSalary (Frontend forms)
    """
    from excel_data.models import CalculatedSalary
    
    calc_records = CalculatedSalary.objects.filter(
        tenant=tenant,
        payroll_period__year=year,
        payroll_period__month=month
    ).select_related('tenant', 'payroll_period')
    
    if not calc_records.exists():
        logger.warning(f"No CalculatedSalary found for {month} {year}")
        return 0
    
    synced_count = 0
    with transaction.atomic():
        for calc_record in calc_records:
            try:
                from excel_data.models import ChartAggregatedData
                ChartAggregatedData.aggregate_from_calculated_salary(calc_record)
                synced_count += 1
            except Exception as e:
                logger.warning(f"Failed to sync {calc_record.employee_name}: {e}")
    
    return synced_count


@shared_task
def cleanup_old_chart_data(days=90):
    """
    Clean up old ChartAggregatedData records
    
    Args:
        days: Delete records older than this many days (default: 90)
    """
    from datetime import timedelta
    from django.utils import timezone
    from excel_data.models import ChartAggregatedData
    
    cutoff_date = timezone.now() - timedelta(days=days)
    deleted_count, _ = ChartAggregatedData.objects.filter(
        created_at__lt=cutoff_date
    ).delete()
    
    logger.info(f"🗑️ [Celery] Cleaned up {deleted_count} old chart records")
    return {'deleted_count': deleted_count}


def mark_sunday_bonus_background(tenant_id, employee_id, attendance_date):
    """
    Background thread function to automatically mark upcoming Sunday as present
    if employee meets weekly present threshold.
    
    This runs in a separate thread so it doesn't block the main request.
    """
    import threading
    from datetime import date, timedelta
    from django.db import connections
    
    def _mark_sunday_bonus():
        # Close any existing database connections before starting thread
        # This ensures we get a fresh connection in the thread
        connections.close_all()
        
        try:
            from excel_data.models import Tenant, EmployeeProfile, DailyAttendance
            from django.db import transaction
            from django.db import connection
            
            logger.info(f"🔄 [Background] Starting Sunday bonus check for {employee_id} on {attendance_date}")
            
            tenant = Tenant.objects.get(id=tenant_id)
            
            # Check if Sunday bonus is enabled
            sunday_bonus_enabled = getattr(tenant, 'sunday_bonus_enabled', False)
            if not sunday_bonus_enabled:
                logger.debug(f"⏭️ [Background] Sunday bonus disabled for tenant {tenant_id}")
                return
            
            # Get absent threshold and calculate present threshold (complement)
            weekly_absent_threshold = getattr(tenant, 'weekly_absent_threshold', 4) or 4
            present_threshold = 7 - weekly_absent_threshold
            logger.debug(f"📊 [Background] Present threshold: {present_threshold} (absent threshold: {weekly_absent_threshold})")
            
            # Get employee
            try:
                employee = EmployeeProfile.objects.get(
                    tenant=tenant,
                    employee_id=employee_id,
                    is_active=True
                )
            except EmployeeProfile.DoesNotExist:
                logger.warning(f"⚠️ [Background] Employee {employee_id} not found or inactive")
                return
            
            # Find the week containing the attendance_date
            # Week starts on Monday (weekday 0) and ends on Sunday (weekday 6)
            day_of_week = attendance_date.weekday()  # 0=Monday, 6=Sunday
            days_since_monday = day_of_week
            week_start = attendance_date - timedelta(days=days_since_monday)  # Monday of this week
            week_end = week_start + timedelta(days=6)  # Sunday of this week
            
            logger.debug(f"📅 [Background] Week: {week_start} to {week_end} (attendance_date: {attendance_date}, day_of_week: {day_of_week})")
            
            # Count present days in this week (Mon-Sat, excluding Sunday)
            # Use date__lt to exclude Sunday (week_end)
            week_attendance = DailyAttendance.objects.filter(
                tenant=tenant,
                employee_id=employee_id,
                date__gte=week_start,
                date__lt=week_end  # Up to Saturday only (exclude Sunday)
            )
            
            present_count = 0
            for rec in week_attendance:
                if rec.attendance_status in ['PRESENT', 'PAID_LEAVE']:
                    present_count += 1
                    logger.debug(f"  ✓ {rec.date}: {rec.attendance_status}")
            
            logger.info(f"📊 [Background] Employee {employee_id}: {present_count} present days in week Mon-Sat (threshold: {present_threshold})")
            
            # If present count meets or exceeds threshold, mark upcoming Sunday as present
            if present_count >= present_threshold:
                upcoming_sunday = week_end  # Sunday of this week
                
                # Check if Sunday is in the future or today
                today = date.today()
                if upcoming_sunday >= today:
                    # Always mark Sunday as PRESENT when threshold is met, regardless of:
                    # - Whether it's an off day or not
                    # - What the existing status is (will override ABSENT, OFF, UNMARKED, etc.)
                    # - Only skip if already marked as PRESENT
                    existing = DailyAttendance.objects.filter(
                        tenant=tenant,
                        employee_id=employee_id,
                        date=upcoming_sunday
                    ).first()
                    
                    # Only skip if already marked as PRESENT, otherwise always mark as PRESENT
                    if not existing or existing.attendance_status != 'PRESENT':
                        with transaction.atomic():
                            DailyAttendance.objects.update_or_create(
                                tenant=tenant,
                                employee_id=employee_id,
                                date=upcoming_sunday,
                                defaults={
                                    'employee_name': f"{employee.first_name} {employee.last_name}".strip(),
                                    'department': employee.department or 'General',
                                    'designation': employee.designation or '',
                                    'employment_type': employee.employment_type or 'FULL_TIME',
                                    'attendance_status': 'PRESENT',  # Always mark as PRESENT for Sunday bonus
                                    'ot_hours': 0,
                                    'late_minutes': 0,
                                }
                            )
                        logger.info(
                            f"✅ [Background] Marked Sunday {upcoming_sunday} as PRESENT (bonus) "
                            f"for {employee_id} - {present_count} present days in week (threshold: {present_threshold})"
                            f" - Overriding existing status: {existing.attendance_status if existing else 'None'}"
                        )
                    else:
                        logger.debug(f"⏭️ [Background] Sunday {upcoming_sunday} already marked as PRESENT, skipping")
                else:
                    logger.debug(f"⏭️ [Background] Sunday {upcoming_sunday} is in the past, skipping")
            else:
                logger.debug(f"⏭️ [Background] Present count ({present_count}) < threshold ({present_threshold}), no bonus")
            
        except Exception as e:
            logger.error(f"❌ [Background] Failed to mark Sunday bonus for {employee_id}: {e}", exc_info=True)
        finally:
            # Close database connection when thread finishes
            connection.close()
    
    # Run in background thread
    thread = threading.Thread(target=_mark_sunday_bonus, daemon=True)
    thread.start()
    logger.debug(f"🚀 [Background] Started thread for Sunday bonus check: {employee_id}")


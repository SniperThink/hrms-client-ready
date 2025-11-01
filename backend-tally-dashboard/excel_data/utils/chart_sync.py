"""
Utilities for syncing ChartAggregatedData in batch (background processing)

Now uses Celery for robust background task processing with:
- Automatic retries on failure
- Task monitoring via Celery Flower
- Survives server restarts
- Better error handling and logging
"""

import logging

logger = logging.getLogger(__name__)


def sync_chart_data_batch_async(tenant, year, month, source='excel'):
    """
    Trigger batch sync of ChartAggregatedData using Celery.
    
    This is now a wrapper around the Celery task for backward compatibility.
    
    Args:
        tenant: Tenant instance
        year: Year (int)
        month: Month name (str, e.g. 'JUNE')
        source: 'excel' or 'frontend'
    
    Returns:
        Celery AsyncResult object (can be used to check task status)
    """
    # Optional settings-based Celery toggle for development
    use_celery = True
    try:
        from django.conf import settings
        use_celery = getattr(settings, 'CELERY_ENABLED', True)
    except Exception:
        # If settings not available, default to Celery enabled
        use_celery = True

    if not use_celery:
        logger.info("⚙️ CELERY_ENABLED=False -> using thread-based chart sync")
        return _sync_chart_data_batch_thread(tenant, year, month, source)

    try:
        from excel_data.tasks import sync_chart_data_batch_task
        
        # Dispatch Celery task
        task = sync_chart_data_batch_task.delay(tenant.id, year, month, source)
        logger.info(
            f"🔄 [Celery] Queued chart sync task {task.id} for "
            f"{tenant.subdomain} - {month} {year} ({source})"
        )
        return task
        
    except Exception as e:
        logger.error(f"❌ Failed to queue Celery task: {e}")
        logger.warning("⚠️ Falling back to thread-based sync")
        
        # Fallback to thread-based sync if Celery is not available
        return _sync_chart_data_batch_thread(tenant, year, month, source)


def _sync_chart_data_batch_thread(tenant, year, month, source='excel'):
    """
    Fallback: Thread-based sync if Celery is unavailable
    
    This provides backward compatibility when Celery/Redis is not running.
    """
    from threading import Thread
    
    thread = Thread(
        target=_sync_chart_data_batch_worker,
        args=(tenant.id, year, month, source)
    )
    thread.daemon = True
    thread.start()
    logger.info(
        f"🔄 [Thread] Started background sync for "
        f"{tenant.subdomain} - {month} {year} ({source})"
    )
    return thread


def _sync_chart_data_batch_worker(tenant_id, year, month, source='excel'):
    """
    Background worker function for thread-based sync.
    Used as fallback when Celery is not available.
    """
    from django.db import connection
    from excel_data.models import Tenant
    
    try:
        # Re-fetch tenant in this thread's database connection
        tenant = Tenant.objects.get(id=tenant_id)
        
        if source == 'excel':
            synced_count = _sync_from_salary_data(tenant, year, month)
        elif source == 'frontend':
            synced_count = _sync_from_calculated_salary(tenant, year, month)
        else:
            raise ValueError(f"Invalid source: {source}")
        
        # Clear cache after sync
        from django.core.cache import cache
        cache_pattern = f"frontend_charts_{tenant_id}_*"
        try:
            cache.delete_pattern(cache_pattern)
        except AttributeError:
            cache.delete(f"frontend_charts_{tenant_id}")
        
        logger.info(
            f"✅ [Thread] Background sync completed: {synced_count} records for "
            f"tenant {tenant_id} - {month} {year}"
        )
        
    except Exception as e:
        logger.error(f"❌ [Thread] Background sync failed for tenant {tenant_id}: {e}")
    finally:
        # Close database connection in this thread
        connection.close()


def _sync_from_salary_data(tenant, year, month):
    """
    Sync ChartAggregatedData from SalaryData (Excel uploads)
    Uses bulk operations for performance.
    """
    from django.db import transaction
    from excel_data.models import SalaryData, ChartAggregatedData
    
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
                ChartAggregatedData.aggregate_from_salary_data(salary_record)
                synced_count += 1
            except Exception as e:
                logger.warning(f"Failed to sync {salary_record.name}: {e}")
    
    logger.info(f"📊 Synced {synced_count}/{len(salary_records)} chart records from Excel")
    return synced_count


def _sync_from_calculated_salary(tenant, year, month):
    """
    Sync ChartAggregatedData from CalculatedSalary (Frontend forms)
    Uses bulk operations for performance.
    """
    from django.db import transaction
    from excel_data.models import CalculatedSalary, ChartAggregatedData
    
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
                ChartAggregatedData.aggregate_from_calculated_salary(calc_record)
                synced_count += 1
            except Exception as e:
                logger.warning(f"Failed to sync {calc_record.employee_name}: {e}")
    
    logger.info(f"📊 Synced {synced_count}/{len(calc_records)} chart records from Frontend")
    return synced_count


def sync_chart_data_batch_sync(tenant, year, month, source='excel'):
    """
    Synchronous version of batch sync (blocks until complete).
    
    Use this for:
    - Management commands
    - When you need to wait for completion
    - Testing
    """
    if source == 'excel':
        return _sync_from_salary_data(tenant, year, month)
    elif source == 'frontend':
        return _sync_from_calculated_salary(tenant, year, month)
    else:
        raise ValueError(f"Invalid source: {source}")

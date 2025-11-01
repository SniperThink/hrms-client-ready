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


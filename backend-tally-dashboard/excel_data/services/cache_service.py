#!/usr/bin/env python

"""
Cache invalidation utilities for HRMS payroll system
"""

import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)

def invalidate_payroll_overview_cache(tenant, reason="data_change"):
    """
    Centralized function to invalidate payroll overview cache
    """
    try:
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id} - Reason: {reason}")
        return True
    except Exception as e:
        logger.error(f"Failed to clear payroll overview cache for tenant {tenant.id}: {str(e)}")
        return False

def invalidate_payroll_caches_comprehensive(tenant, reason="payment_status_change"):
    """
    Comprehensive cache invalidation for payroll-related operations
    Invalidates all payroll, charts, and related caches
    """
    try:
        cleared_keys = []
        
        # Core payroll caches
        payroll_cache_keys = [
            f"payroll_overview_{tenant.id}",
            f"payroll_periods_{tenant.id}",
            f"payroll_summary_{tenant.id}",
        ]
        
        for cache_key in payroll_cache_keys:
            if cache.delete(cache_key):
                cleared_keys.append(cache_key)
        
        # Frontend charts cache (with pattern matching)
        try:
            # Try pattern-based clearing for frontend charts
            cleared_count = cache.delete_pattern(f"frontend_charts_{tenant.id}_*")
            if cleared_count > 0:
                cleared_keys.append(f"frontend_charts_{tenant.id}_* (pattern)")
                logger.info(f"Cleared {cleared_count} frontend charts cache keys using pattern matching")
        except AttributeError:
            # Fallback: Clear common frontend charts cache combinations
            common_chart_keys = [
                f"frontend_charts_{tenant.id}_this_month_All",
                f"frontend_charts_{tenant.id}_last_6_months_All",
                f"frontend_charts_{tenant.id}_last_12_months_All",
                f"frontend_charts_{tenant.id}_last_5_years_All",
                f"frontend_charts_{tenant.id}",
            ]
            
            for cache_key in common_chart_keys:
                if cache.delete(cache_key):
                    cleared_keys.append(cache_key)
        
        # Dashboard and KPI caches
        dashboard_cache_keys = [
            f"dashboard_stats_{tenant.id}",
            f"monthly_attendance_summary_{tenant.id}",
            f"attendance_all_records_{tenant.id}",
        ]
        
        for cache_key in dashboard_cache_keys:
            if cache.delete(cache_key):
                cleared_keys.append(cache_key)
        
        # Clear any period-specific caches
        try:
            # Clear any payroll period detail caches
            cache.delete_pattern(f"payroll_period_detail_{tenant.id}_*".replace('\x00', '[NUL]'))
            cache.delete_pattern(f"payroll_summary_{tenant.id}_*".replace('\x00', '[NUL]'))
        except AttributeError:
            pass
        
        logger.info(f"Comprehensive cache invalidation completed for tenant {tenant.id} - Reason: {reason}")
        # Clean null bytes from cache keys before logging
        clean_cleared_keys = [key.replace('\x00', '[NUL]') for key in cleared_keys]
        logger.info(f"Cleared {len(clean_cleared_keys)} cache keys: {clean_cleared_keys}")
        
        return {
            'success': True,
            'cleared_keys': cleared_keys,
            'cleared_count': len(cleared_keys),
            'reason': reason
        }
        
    except Exception as e:
        logger.error(f"Failed to perform comprehensive cache invalidation for tenant {tenant.id}: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'reason': reason
        }

def invalidate_payroll_payment_caches(tenant, period_id=None, reason="payment_marked"):
    """
    Specific cache invalidation for payroll payment operations
    """
    try:
        cleared_keys = []
        
        # Always clear payroll overview
        if invalidate_payroll_overview_cache(tenant, reason):
            cleared_keys.append(f"payroll_overview_{tenant.id}")
        
        # Clear period-specific caches if period_id provided
        if period_id:
            period_cache_keys = [
                f"payroll_period_detail_{period_id}",
                f"payroll_summary_{period_id}",
                f"calculated_salaries_{period_id}",
            ]
            
            for cache_key in period_cache_keys:
                if cache.delete(cache_key):
                    cleared_keys.append(cache_key)
        
        # Clear frontend charts for immediate dashboard refresh
        try:
            cleared_count = cache.delete_pattern(f"frontend_charts_{tenant.id}_*")
            if cleared_count > 0:
                cleared_keys.append(f"frontend_charts_{tenant.id}_* (pattern)")
        except AttributeError:
            # Fallback to common chart keys
            chart_keys = [
                f"frontend_charts_{tenant.id}_this_month_All",
                f"frontend_charts_{tenant.id}_last_6_months_All",
                f"frontend_charts_{tenant.id}_last_12_months_All",
            ]
            
            for cache_key in chart_keys:
                if cache.delete(cache_key):
                    cleared_keys.append(cache_key)
        
        logger.info(f"Payment cache invalidation completed for tenant {tenant.id} - Reason: {reason}")
        # Clean null bytes from cache keys before logging
        clean_cleared_keys = [key.replace('\x00', '[NUL]') for key in cleared_keys]
        logger.info(f"Cleared {len(clean_cleared_keys)} cache keys: {clean_cleared_keys}")
        
        return {
            'success': True,
            'cleared_keys': cleared_keys,
            'cleared_count': len(cleared_keys),
            'reason': reason
        }
        
    except Exception as e:
        logger.error(f"Failed to invalidate payment caches for tenant {tenant.id}: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'reason': reason
        }
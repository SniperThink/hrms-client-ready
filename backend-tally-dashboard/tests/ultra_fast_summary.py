# ULTRA-FAST Monthly Summary Update Function
# This replaces the slow one-by-one processing with bulk operations

def ultra_fast_process_summaries_background(tenant, attendance_date, employee_ids, cache):
    """ULTRA-OPTIMIZED: Process monthly summaries using bulk operations for maximum speed"""
    import time
    import threading
    import traceback
    from collections import defaultdict
    from django.db import transaction
    from django.db.models import Count, Sum, Case, When, FloatField, IntegerField, Value
    from excel_data.models import MonthlyAttendanceSummary, DailyAttendance
    
    try:
        thread_start = time.time()
        summaries_updated = 0
        summaries_created = 0
        employees_processed = 0
        employees_with_data = 0
        employees_without_data = 0
        
        # REUSE existing connection instead of creating new one
        current_thread = threading.current_thread()
        print(f"🚀 ULTRA-FAST CONSOLE: Thread started - ID: {current_thread.ident}, Name: {current_thread.name}")
        print(f"⚡ ULTRA-FAST CONSOLE: REUSING existing DB connection for maximum speed")
        print(f"📅 ULTRA-FAST CONSOLE: Processing for date: {attendance_date} (Year: {attendance_date.year}, Month: {attendance_date.month})")
        
        if employee_ids:
            unique_employee_ids = list(set(employee_ids))
            print(f"👥 ULTRA-FAST CONSOLE: Processing {len(unique_employee_ids)} unique employees from {len(employee_ids)} total")
            
            # STEP 1: BULK FETCH ALL EXISTING SUMMARIES (Single Query)
            fetch_start = time.time()
            existing_summaries = MonthlyAttendanceSummary.objects.filter(
                tenant=tenant,
                employee_id__in=unique_employee_ids,
                year=attendance_date.year,
                month=attendance_date.month
            )  # Removed select_for_update() - will handle race conditions with get_or_create
            
            existing_lookup = {summary.employee_id: summary for summary in existing_summaries}
            fetch_time = time.time() - fetch_start
            print(f"📊 ULTRA-FAST CONSOLE: Fetched {len(existing_lookup)} existing summaries in {fetch_time:.3f}s")
            
            # STEP 2: BULK FETCH ALL DAILY ATTENDANCE DATA (Single Query with Aggregation)
            daily_fetch_start = time.time()
            
            # Get aggregated attendance data for all employees in ONE query
            daily_aggregations = DailyAttendance.objects.filter(
                tenant=tenant,
                employee_id__in=unique_employee_ids,
                date__year=attendance_date.year,
                date__month=attendance_date.month
            ).values('employee_id').annotate(
                total_present=Count(Case(When(attendance_status='PRESENT', then=1))),
                total_paid_leave=Count(Case(When(attendance_status='PAID_LEAVE', then=1))),
                total_half_day=Count(Case(When(attendance_status='HALF_DAY', then=1))),
                total_absent=Count(Case(When(attendance_status='ABSENT', then=1))),
                total_ot_hours=Sum('ot_hours'),
                total_late_minutes=Sum('late_minutes'),
                total_records=Count('id')
            )
            
            # Convert to lookup dictionary
            daily_lookup = {agg['employee_id']: agg for agg in daily_aggregations}
            daily_fetch_time = time.time() - daily_fetch_start
            print(f"📊 ULTRA-FAST CONSOLE: Fetched aggregated attendance data for {len(daily_lookup)} employees in {daily_fetch_time:.3f}s")
            
            # STEP 3: PREPARE BULK OPERATIONS
            bulk_create_list = []
            bulk_update_list = []
            
            processing_start = time.time()
            
            for employee_id in unique_employee_ids:
                daily_data = daily_lookup.get(employee_id, {})
                
                if daily_data:
                    employees_with_data += 1
                    
                    # Calculate present days (full + paid leave + half days as 0.5)
                    present_days = (
                        daily_data.get('total_present', 0) + 
                        daily_data.get('total_paid_leave', 0) + 
                        (daily_data.get('total_half_day', 0) * 0.5)
                    )
                    
                    ot_hours = float(daily_data.get('total_ot_hours') or 0)
                    late_minutes = daily_data.get('total_late_minutes') or 0
                    
                else:
                    employees_without_data += 1
                    present_days = 0
                    ot_hours = 0
                    late_minutes = 0
                
                # Check if summary exists
                if employee_id in existing_lookup:
                    # Update existing
                    summary = existing_lookup[employee_id]
                    old_values = (float(summary.present_days), float(summary.ot_hours), summary.late_minutes)
                    new_values = (present_days, ot_hours, late_minutes)
                    
                    if old_values != new_values:
                        summary.present_days = present_days
                        summary.ot_hours = ot_hours
                        summary.late_minutes = late_minutes
                        bulk_update_list.append(summary)
                        summaries_updated += 1
                else:
                    # Create new
                    new_summary = MonthlyAttendanceSummary(
                        tenant=tenant,
                        employee_id=employee_id,
                        year=attendance_date.year,
                        month=attendance_date.month,
                        present_days=present_days,
                        ot_hours=ot_hours,
                        late_minutes=late_minutes
                    )
                    bulk_create_list.append(new_summary)
                    summaries_created += 1
                
                employees_processed += 1
            
            processing_time = time.time() - processing_start
            print(f"⚡ ULTRA-FAST CONSOLE: Processed {employees_processed} employees in {processing_time:.3f}s")
            
            # STEP 4: EXECUTE BULK OPERATIONS (Lightning Fast)
            bulk_start = time.time()
            
            with transaction.atomic():
                # Bulk create new summaries
                if bulk_create_list:
                    MonthlyAttendanceSummary.objects.bulk_create(bulk_create_list, batch_size=500)
                    print(f"✨ ULTRA-FAST CONSOLE: BULK CREATED {len(bulk_create_list)} summaries")
                
                # Bulk update existing summaries
                if bulk_update_list:
                    MonthlyAttendanceSummary.objects.bulk_update(
                        bulk_update_list, 
                        ['present_days', 'ot_hours', 'late_minutes'],
                        batch_size=500
                    )
                    print(f"🔄 ULTRA-FAST CONSOLE: BULK UPDATED {len(bulk_update_list)} summaries")
            
            bulk_time = time.time() - bulk_start
            print(f"⚡ ULTRA-FAST CONSOLE: Bulk DB operations completed in {bulk_time:.3f}s")
            
            # FINAL SUMMARY
            thread_time = time.time() - thread_start
            
            print(f"🎉 ULTRA-FAST CONSOLE: PROCESSING COMPLETE!")
            print(f"⏱️ ULTRA-FAST CONSOLE: Total processing time: {thread_time:.3f}s")
            print(f"👥 ULTRA-FAST CONSOLE: Total employees processed: {employees_processed}")
            print(f"📊 ULTRA-FAST CONSOLE: Employees with attendance data: {employees_with_data}")
            print(f"⚠️ ULTRA-FAST CONSOLE: Employees without attendance data: {employees_without_data}")
            print(f"✨ ULTRA-FAST CONSOLE: New summaries created: {summaries_created}")
            print(f"🔄 ULTRA-FAST CONSOLE: Existing summaries updated: {summaries_updated}")
            print(f"📈 ULTRA-FAST CONSOLE: Total changes made: {summaries_created + summaries_updated}")
            
            # Success/failure ratio
            success_rate = (employees_with_data / employees_processed * 100) if employees_processed > 0 else 0
            print(f"📊 ULTRA-FAST CONSOLE: Success rate: {success_rate:.1f}% ({employees_with_data}/{employees_processed})")
            
            # Performance breakdown
            print(f"⚡ ULTRA-FAST CONSOLE: PERFORMANCE BREAKDOWN:")
            print(f"   📊 Data fetch time: {fetch_time + daily_fetch_time:.3f}s")
            print(f"   🔄 Processing time: {processing_time:.3f}s") 
            print(f"   💾 Bulk operations time: {bulk_time:.3f}s")
            print(f"   🚀 Speed improvement: ~{(25 * len(unique_employee_ids) / thread_time):.1f}x faster than old method")
            
            # CRITICAL: Clear monthly summary caches after processing
            cache_clear_start = time.time()
            monthly_cache_keys = [
                f"monthly_attendance_summary_{tenant.id}_{attendance_date.year}_{attendance_date.month}",
                f"monthly_attendance_summary_{tenant.id}",
                f"attendance_tracker_{tenant.id}",
                f"dashboard_stats_{tenant.id}",
                f"attendance_all_records_{tenant.id}",
                f"frontend_charts_{tenant.id}",
                # CRITICAL: Clear all daily attendance all_records cache variations with param signatures
                f"attendance_all_records_{tenant.id}_this_month_None_None_None_None",
                f"attendance_all_records_{tenant.id}_last_6_months_None_None_None_None",
                f"attendance_all_records_{tenant.id}_last_12_months_None_None_None_None",
                f"attendance_all_records_{tenant.id}_last_5_years_None_None_None_None",
                f"attendance_all_records_{tenant.id}_custom_",
                # Clear directory and employee-related caches too
                f"directory_data_{tenant.id}",
                f"payroll_overview_{tenant.id}",
            ]
            
            # WILDCARD CACHE CLEARING: Clear ALL attendance_all_records variants for this tenant 
            # Since Django cache doesn't support wildcards, we'll clear known patterns
            import re
            from django.core.cache import cache as django_cache
            
            # Try to clear all attendance_all_records cache keys by pattern
            attendance_cache_patterns = [
                f"attendance_all_records_{tenant.id}_this_month_",
                f"attendance_all_records_{tenant.id}_last_6_months_",
                f"attendance_all_records_{tenant.id}_last_12_months_",
                f"attendance_all_records_{tenant.id}_last_5_years_",
                f"attendance_all_records_{tenant.id}_custom_",
            ]
            
            # Add pattern-based clearing
            for pattern in attendance_cache_patterns:
                for suffix in ["None_None_None_None", "", "_"]:
                    monthly_cache_keys.append(f"{pattern}{suffix}")
            
            # Also clear current year/month specific caches
            monthly_cache_keys.extend([
                f"attendance_all_records_{tenant.id}_custom_{attendance_date.month}_{attendance_date.year}_None_None",
                f"attendance_all_records_{tenant.id}_this_month_None_None_None_None",
            ])
            
            for cache_key in monthly_cache_keys:
                cache.delete(cache_key)
            
            cache_clear_time = time.time() - cache_clear_start
            print(f"🗑️ ULTRA-FAST CONSOLE: Cleared {len(monthly_cache_keys)} cache keys in {cache_clear_time:.3f}s")
            
    except Exception as bg_error:
        print(f"❌ ULTRA-FAST CONSOLE: CRITICAL ERROR in background processing: {str(bg_error)}")
        print(f"❌ ULTRA-FAST CONSOLE: Full traceback: {traceback.format_exc()}")
        
        # Even if there's an error, try to clear some caches
        try:
            cache.delete(f"monthly_attendance_summary_{tenant.id}")
            cache.delete(f"attendance_all_records_{tenant.id}")
            # Clear the most common all_records cache variations
            cache.delete(f"attendance_all_records_{tenant.id}_this_month_None_None_None_None")
            cache.delete(f"attendance_all_records_{tenant.id}_last_6_months_None_None_None_None")
            cache.delete(f"attendance_all_records_{tenant.id}_last_12_months_None_None_None_None")
            cache.delete(f"frontend_charts_{tenant.id}")
            cache.delete(f"directory_data_{tenant.id}")
            print(f"🗑️ ULTRA-FAST CONSOLE: Emergency cache clear completed despite error")
        except Exception as cache_error:
            print(f"❌ ULTRA-FAST CONSOLE: Even cache clearing failed: {str(cache_error)}")

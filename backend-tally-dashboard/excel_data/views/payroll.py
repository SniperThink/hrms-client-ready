# payroll.py
# Contains all payroll-related views:
# - PayrollPeriodViewSet
# - CalculatedSalaryViewSet
# - calculate_payroll
# - update_advance_deduction
# - lock_payroll_period
# - mark_salary_paid
# - payroll_summary
# - payroll_periods_list
# - available_calculation_periods
# - get_months_with_attendance
# - calculate_simple_payroll
# - calculate_simple_payroll_ultra_fast
# - update_payroll_entry
# - mark_payroll_paid
# - payroll_overview
# - create_current_month_payroll
# - payroll_period_detail
# - add_employee_advance
# - AdvancePaymentViewSet
# - auto_payroll_settings
# - manual_calculate_payroll
# - save_payroll_period_direct
# - bulk_update_payroll_period


from rest_framework.response import Response
from rest_framework import status, viewsets, filters
from rest_framework.decorators import api_view, permission_classes
from ..models import EmployeeProfile
from decimal import Decimal, InvalidOperation
from datetime import datetime
import time
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from django.db import transaction, connection, models
import logging

# Initialize logger
logger = logging.getLogger(__name__)

from ..models import (
    EmployeeProfile,
    AdvanceLedger,
    PayrollPeriod,
    CalculatedSalary,
    DataSource,
)

from ..serializers import (
    AdvanceLedgerSerializer,
)
from rest_framework import serializers

# Email verification views will be defined in this file
from ..services.salary_service import SalaryCalculationService



class PayrollPeriodViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing payroll periods
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return PayrollPeriod.objects.none()
        return PayrollPeriod.objects.filter(tenant=tenant)
    
    def get_serializer_class(self):
        class PayrollPeriodSerializer(serializers.ModelSerializer):
            class Meta:
                model = PayrollPeriod
                fields = [
                    'id', 'year', 'month', 'data_source', 'is_locked',
                    'calculation_date', 'working_days_in_month', 'tds_rate'
                ]
                read_only_fields = ['calculation_date']
        return PayrollPeriodSerializer
    
    def destroy(self, request, *args, **kwargs):
        """
        Delete a payroll period and its associated calculated salaries
        """
        try:
            period = self.get_object()
            
            # Check if period can be deleted (not locked and no payments)
            if period.is_locked:
                return Response({
                    'error': 'Cannot delete locked payroll period'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if there are any paid salaries
            paid_salaries_count = CalculatedSalary.objects.filter(
                payroll_period=period,
                is_paid=True
            ).count()
            
            if paid_salaries_count > 0:
                return Response({
                    'error': f'Cannot delete payroll period with {paid_salaries_count} paid salaries'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # OPTIMIZATION: Bulk delete ChartAggregatedData first to avoid signal overhead
            # Get employee IDs and month info before deleting salaries
            from excel_data.models import ChartAggregatedData
            MONTH_MAPPING = {
                'JANUARY': 'JAN', 'FEBRUARY': 'FEB', 'MARCH': 'MAR', 'APRIL': 'APR',
                'MAY': 'MAY', 'JUNE': 'JUN', 'JULY': 'JUL', 'AUGUST': 'AUG',
                'SEPTEMBER': 'SEP', 'OCTOBER': 'OCT', 'NOVEMBER': 'NOV', 'DECEMBER': 'DEC',
                'JAN': 'JAN', 'FEB': 'FEB', 'MAR': 'MAR', 'APR': 'APR',
                'JUN': 'JUN', 'JUL': 'JUL', 'AUG': 'AUG', 'SEP': 'SEP',
                'OCT': 'OCT', 'NOV': 'NOV', 'DEC': 'DEC'
            }
            month_name = period.month.upper()
            month_short = MONTH_MAPPING.get(month_name, 'JAN')
            
            # ULTRA-FAST: Use raw SQL to delete all related data in a single transaction
            from django.db import connection, transaction
            from excel_data.models import ChartAggregatedData
            
            # Get count before deletion for response
            salary_count = CalculatedSalary.objects.filter(payroll_period=period).count()
            
            # Get actual table names from Django models (safer than hardcoding)
            calculated_salary_table = CalculatedSalary._meta.db_table
            chart_data_table = ChartAggregatedData._meta.db_table
            
            # Use raw SQL DELETE to bypass Django signals and ORM overhead
            # This is 10-100x faster for large deletions (bypasses N+1 signal queries)
            with transaction.atomic():
                with connection.cursor() as cursor:
                    # 1. Delete ChartAggregatedData first (bulk delete)
                    cursor.execute(f"""
                        DELETE FROM {chart_data_table}
                        WHERE tenant_id = %s 
                        AND year = %s 
                        AND month = %s
                    """, [period.tenant.id, period.year, month_short])
                    chart_deleted_count = cursor.rowcount
                    
                    # 2. Delete CalculatedSalary records (bypasses signals, much faster)
                    # Raw SQL bypasses Django ORM and post_delete signals completely
                    cursor.execute(f"""
                        DELETE FROM {calculated_salary_table}
                        WHERE payroll_period_id = %s
                    """, [period.id])
                    deleted_salaries_count = cursor.rowcount
                    
                    logger.info(f"⚡ Ultra-fast deletion: {chart_deleted_count} ChartAggregatedData, {deleted_salaries_count} CalculatedSalary records")
                
                # Delete the payroll period (single record, fast)
                period_name = f"{period.month} {period.year}"
                tenant_id = period.tenant.id
                period.delete()
            
            # CLEAR CACHE: Invalidate payroll overview cache when payroll period is deleted
            from django.core.cache import cache
            cache_key = f"payroll_overview_{tenant_id}"
            cache.delete(cache_key)
            
            # Clear frontend charts cache to refresh dashboard immediately
            try:
                # Try to clear all frontend charts cache variations
                cache.delete_pattern(f"frontend_charts_{tenant_id}_*")
            except AttributeError:
                # Fallback: Clear specific common cache keys
                cache.delete(f"frontend_charts_{tenant_id}")
            
            logger.info(f"Cleared payroll overview and frontend charts cache for tenant {tenant_id} after deleting period {period_name}")
            
            return Response({
                'success': True,
                'message': f'Payroll period {period_name} deleted successfully',
                'deleted_salaries': deleted_salaries_count,
                'deleted_chart_data': chart_deleted_count,
                'cache_cleared': True
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error deleting payroll period: {str(e)}")
            return Response({
                'error': f'Failed to delete payroll period: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CalculatedSalaryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing calculated salaries
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return CalculatedSalary.objects.none()
        
        queryset = CalculatedSalary.objects.filter(tenant=tenant)
        
        # Filter by payroll period if specified
        period_id = self.request.query_params.get('period_id')
        if period_id:
            queryset = queryset.filter(payroll_period_id=period_id)
        
        return queryset.select_related('payroll_period')
    
    def get_serializer_class(self):
        from rest_framework import serializers
        
        class CalculatedSalarySerializer(serializers.ModelSerializer):
            payroll_period_display = serializers.CharField(source='payroll_period.__str__', read_only=True)
            
            class Meta:
                model = CalculatedSalary
                fields = [
                    'id', 'payroll_period', 'payroll_period_display', 'employee_id', 'employee_name',
                    'department', 'basic_salary', 'basic_salary_per_hour', 'basic_salary_per_minute',
                    'employee_ot_rate', 'employee_tds_rate', 'total_working_days', 'present_days', 
                    'absent_days', 'ot_hours', 'late_minutes', 'salary_for_present_days', 'ot_charges', 
                    'late_deduction', 'incentive', 'gross_salary', 'tds_amount', 'salary_after_tds', 
                    'total_advance_balance', 'advance_deduction_amount', 'advance_deduction_editable', 
                    'remaining_advance_balance', 'net_payable', 'data_source', 'calculation_timestamp', 
                    'is_paid', 'payment_date'
                ]
                read_only_fields = [
                    'salary_for_present_days', 'ot_charges', 'late_deduction', 'gross_salary',
                    'tds_amount', 'salary_after_tds', 'remaining_advance_balance', 'net_payable',
                    'calculation_timestamp'
                ]
        return CalculatedSalarySerializer

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_payroll(request):
    """
    Calculate payroll for a specific period with different modes
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        data = request.data
        period_id = data.get('period_id')
        force_recalculate = data.get('force_recalculate', False)
        mode = data.get('mode', 'calculate')  # 'tentative', 'calculate', 'save'
        
        if not period_id:
            # Legacy support - try to get year and month
            year = data.get('year')
            month = data.get('month')
            
            if not year or not month:
                return Response({"error": "period_id or (year and month) are required"}, status=400)
            
            # Validate year and month
            try:
                year = int(year)
                month = str(month).upper()
            except (ValueError, TypeError):
                return Response({"error": "Invalid year or month format"}, status=400)
            
            # Calculate payroll using legacy method
            results = SalaryCalculationService.calculate_salary_for_period(
                tenant, year, month, force_recalculate
            )
            
            # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
            from excel_data.services.cache_service import invalidate_payroll_caches_comprehensive
            
            cache_result = invalidate_payroll_caches_comprehensive(
                tenant=tenant, 
                reason="payroll_calculation_completed"
            )
            
            if cache_result['success']:
                logger.info(f"Cache invalidation successful: {cache_result['cleared_count']} keys cleared")
            else:
                logger.warning(f"Cache invalidation failed: {cache_result.get('error', 'Unknown error')}")
        
        return Response({
            'success': True,
            'results': results,
            'message': f'Payroll calculation completed for {month} {year}',
            'cache_invalidation': cache_result
        })
        
        # New method using period_id
        try:
            payroll_period = PayrollPeriod.objects.get(id=period_id, tenant=tenant)
        except PayrollPeriod.DoesNotExist:
            return Response({"error": "Payroll period not found"}, status=404)
        
        # Calculate payroll for the period
        results = SalaryCalculationService.calculate_salary_for_period(
            tenant, payroll_period.year, payroll_period.month, force_recalculate
        )
        
        # Handle different modes
        if mode == 'save':
            # Lock the period after calculation
            payroll_period.is_locked = True
            payroll_period.calculation_date = timezone.now()
            payroll_period.save()
            message = f'Payroll calculated and saved for {payroll_period.month} {payroll_period.year}'
        elif mode == 'tentative':
            message = f'Tentative payroll calculation completed for {payroll_period.month} {payroll_period.year}'
        else:
            message = f'Payroll calculation completed for {payroll_period.month} {payroll_period.year}'
        
        # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
        from excel_data.services.cache_service import invalidate_payroll_caches_comprehensive
        
        cache_result = invalidate_payroll_caches_comprehensive(
            tenant=tenant, 
            reason="payroll_calculation_completed"
        )
        
        if cache_result['success']:
            logger.info(f"Cache invalidation successful: {cache_result['cleared_count']} keys cleared")
        else:
            logger.warning(f"Cache invalidation failed: {cache_result.get('error', 'Unknown error')}")
        
        return Response({
            'success': True,
            'results': results,
            'message': message,
            'mode': mode,
            'cache_cleared': cache_result['success'],
            'cache_invalidation': cache_result
        })
        
    except Exception as e:
        logger.error(f"Error in calculate_payroll: {str(e)}")
        return Response({"error": f"Calculation failed: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_advance_deduction(request):
    """
    Update advance deduction amount for a specific employee and period
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        data = request.data
        payroll_period_id = data.get('payroll_period_id')
        employee_id = data.get('employee_id')
        new_amount = data.get('new_amount')
        
        if not all([payroll_period_id, employee_id, new_amount is not None]):
            return Response({
                "error": "payroll_period_id, employee_id, and new_amount are required"
            }, status=400)
        
        try:
            new_amount = Decimal(str(new_amount))
        except (ValueError, TypeError):
            return Response({"error": "Invalid amount format"}, status=400)
        
        # Get admin user (you might want to get this from JWT token)
        admin_user = getattr(request.user, 'username', 'system')
        
        # Update advance deduction
        calculated_salary = SalaryCalculationService.update_advance_deduction(
            tenant, payroll_period_id, employee_id, new_amount, admin_user
        )
        
        # CLEAR CACHE: Invalidate payroll overview cache when advance deduction changes
        from excel_data.services.cache_service import invalidate_payroll_payment_caches
        
        cache_result = invalidate_payroll_payment_caches(
            tenant=tenant, 
            period_id=payroll_period_id,
            reason="advance_deduction_updated"
        )
        
        if cache_result['success']:
            logger.info(f"Cache invalidation successful: {cache_result['cleared_count']} keys cleared")
        else:
            logger.warning(f"Cache invalidation failed: {cache_result.get('error', 'Unknown error')}")
        
        return Response({
            'success': True,
            'message': 'Advance deduction updated successfully',
            'calculated_salary_id': calculated_salary.id,
            'new_net_payable': str(calculated_salary.net_payable),
            'cache_cleared': cache_result['success'],
            'cache_invalidation': cache_result
        })
        
    except CalculatedSalary.DoesNotExist:
        return Response({"error": "Calculated salary record not found"}, status=404)
    except Exception as e:
        logger.error(f"Error in update_advance_deduction: {str(e)}")
        return Response({"error": f"Update failed: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lock_payroll_period(request, period_id):
    """
    Lock a payroll period to prevent further modifications
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        payroll_period = SalaryCalculationService.lock_payroll_period(tenant, period_id)
        # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
        from django.core.cache import cache
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")
        
        return Response({
            'success': True,
            'message': f'Payroll period {payroll_period} has been locked',
            'period_id': payroll_period.id
        })
        
    except PayrollPeriod.DoesNotExist:
        return Response({"error": "Payroll period not found"}, status=404)
    except Exception as e:
        logger.error(f"Error in lock_payroll_period: {str(e)}")
        return Response({"error": f"Lock failed: {str(e)}"}, status=500)

def mark_salary_paid(request):
    """
    Mark calculated salaries as paid or unpaid - OPTIMIZED with bulk operations
    Supports both marking as paid (mark_as_paid=True) and unpaid (mark_as_paid=False)
    """
    import time
    from django.core.cache import cache
    
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        data = request.data
        salary_ids = data.get('salary_ids', [])
        payment_date = data.get('payment_date')
        mark_as_paid = data.get('mark_as_paid', True)  # Default to marking as paid
        
        if not salary_ids:
            return Response({"error": "salary_ids list is required"}, status=400)
        
        # Parse payment date if provided and marking as paid
        parsed_date = None
        if payment_date and mark_as_paid:
            try:
                parsed_date = datetime.strptime(payment_date, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Invalid payment_date format (use YYYY-MM-DD)"}, status=400)
        
        # Use default payment date if marking as paid and no date provided
        if mark_as_paid and not parsed_date:
            parsed_date = timezone.now().date()
        
        # Use transaction for atomic operations
        with transaction.atomic():
            # OPTIMIZATION: Bulk fetch all calculated salaries in a single query (inside transaction)
            calculated_salaries = CalculatedSalary.objects.filter(
                tenant=tenant,
                id__in=salary_ids
            )  # Removed select_for_update() to avoid transaction issues
            
            if not calculated_salaries.exists():
                return Response({"error": "No valid salary records found"}, status=404)
            
            updated_count = 0
            
            # OPTIMIZATION: Bulk update all calculated salaries at once
            bulk_updates = []
            employee_advance_deductions = {}  # Track advance deductions by employee
            
            for salary in calculated_salaries:
                salary.is_paid = mark_as_paid
                salary.payment_date = parsed_date if mark_as_paid else None
                bulk_updates.append(salary)
                updated_count += 1
                
                # Collect advance deduction info for batch processing ONLY when marking as paid
                if mark_as_paid and salary.advance_deduction_amount > 0:
                    if salary.employee_id not in employee_advance_deductions:
                        employee_advance_deductions[salary.employee_id] = 0
                    employee_advance_deductions[salary.employee_id] += salary.advance_deduction_amount
            
            # Bulk update all calculated salaries
            CalculatedSalary.objects.bulk_update(
                bulk_updates, 
                ['is_paid', 'payment_date'], 
                batch_size=100
            )
            
            # OPTIMIZATION: Bulk process advance ledger updates ONLY when marking as paid
            if mark_as_paid and employee_advance_deductions:
                logger.info(f"Processing advance deductions for {len(employee_advance_deductions)} employees: {employee_advance_deductions}")
                from ..models import AdvanceLedger
                
                # Get all relevant advance records in one query
                all_employee_ids = list(employee_advance_deductions.keys())
                all_advances = AdvanceLedger.objects.filter(
                    tenant=tenant,
                    employee_id__in=all_employee_ids,
                    status__in=['PENDING','PARTIALLY_PAID']
                ).order_by('employee_id', 'advance_date')
                
                logger.info(f"Found {all_advances.count()} pending advances for employees: {all_employee_ids}")
                
                # Group advances by employee for efficient processing
                advances_by_employee = {}
                for advance in all_advances:
                    if advance.employee_id not in advances_by_employee:
                        advances_by_employee[advance.employee_id] = []
                    advances_by_employee[advance.employee_id].append(advance)
                
                # Process advance deductions for each employee
                advances_to_update = []
                advances_to_mark_repaid = []
                
                for employee_id, total_deduction in employee_advance_deductions.items():
                    remaining_deduction = Decimal(str(total_deduction))  # Convert to Decimal
                    employee_advances = advances_by_employee.get(employee_id, [])
                    
                    logger.info(f"Processing employee {employee_id}: deduction={remaining_deduction}, advances={len(employee_advances)}")
                    
                    for advance in employee_advances:
                        if remaining_deduction <= 0:
                            break
                            
                        current_balance = advance.remaining_balance
                        if current_balance <= remaining_deduction:
                            # This advance is fully paid
                            logger.info(f"Fully repaying advance {advance.id}: {current_balance}")
                            advance.status = 'REPAID'
                            advance.remaining_balance = Decimal('0')
                            advances_to_mark_repaid.append(advance)
                            remaining_deduction -= current_balance
                        else:
                            # This advance is partially paid - reduce the remaining_balance
                            logger.info(f"Partially repaying advance {advance.id}: {remaining_deduction} out of {current_balance}")
                            advance.remaining_balance -= remaining_deduction
                            advance.status = 'PARTIALLY_PAID'
                            advances_to_update.append(advance)
                            remaining_deduction = Decimal('0')
                
                # Execute bulk updates and status changes
                if advances_to_update:
                    AdvanceLedger.objects.bulk_update(advances_to_update, ['remaining_balance', 'status'], batch_size=100)
                    logger.info(f"Bulk updated {len(advances_to_update)} advance remaining balances")
                
                if advances_to_mark_repaid:
                    AdvanceLedger.objects.bulk_update(advances_to_mark_repaid, ['status', 'remaining_balance'], batch_size=100)
                    logger.info(f"Bulk marked {len(advances_to_mark_repaid)} advances as REPAID")
                
                logger.info(
                    f"Advance processing completed: {len(advances_to_update)} updated, {len(advances_to_mark_repaid)} marked as REPAID"
                )
            elif not mark_as_paid:
                logger.info("Marked salaries as unpaid - no advance processing needed")
            else:
                logger.info("No advance deductions found to process")
        
        
        # CLEAR CACHE: Invalidate payroll overview cache when payment status changes
        from excel_data.services.cache_service import invalidate_payroll_payment_caches
        
        cache_result = invalidate_payroll_payment_caches(
            tenant=tenant, 
            reason="salary_payment_status_changed"
        )
        
        if cache_result['success']:
            logger.info(f"Cache invalidation successful: {cache_result['cleared_count']} keys cleared")
        else:
            logger.warning(f"Cache invalidation failed: {cache_result.get('error', 'Unknown error')}")
        
        logger.info(f"Bulk marked {updated_count} salaries as paid for tenant {tenant.name}")
        
        response_data = {
            'success': True,
            'message': f'{updated_count} salaries marked as paid',
            'updated_count': updated_count,
            'processed_advance_deductions': len(employee_advance_deductions),
            'cache_cleared': cache_result['success'],
            'cache_invalidation': {
                'success': cache_result['success'],
                'cleared_count': cache_result.get('cleared_count', 0),
                'reason': cache_result.get('reason', 'salary_payment_status_changed')
            }
        }
        
        if mark_as_paid and parsed_date:
            response_data['payment_date'] = parsed_date.isoformat()
            response_data['processed_advance_deductions'] = len(employee_advance_deductions)
        
        return Response(response_data)
        
    except Exception as e:
        logger.error(f"Error in optimized mark_salary_paid: {str(e)}")
        return Response({"error": f"Update failed: {str(e)}"}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_summary(request, period_id):
    """
    Get payroll summary for a specific period
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        summary = SalaryCalculationService.get_salary_summary(tenant, period_id)
        
        return Response({
            'success': True,
            'summary': summary
        })
        
    except Exception as e:
        logger.error(f"Error in payroll_summary: {str(e)}")
        return Response({"error": f"Summary failed: {str(e)}"}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_calculation_periods(request):
    """
    Get list of available months/years for payroll calculation
    This includes both existing periods and new periods that can be calculated
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        from ..models import PayrollPeriod, CalculatedSalary, EmployeeProfile
        from datetime import datetime, timedelta
        import calendar
        
        # Get current date
        current_date = datetime.now()
        
        # Generate available periods (last 6 months + current + next 3 months)
        available_periods = []
        
        # Start from 6 months ago
        start_date = current_date - timedelta(days=180)  # Approximately 6 months
        
        for i in range(12):  # 12 months total
            calc_date = start_date + timedelta(days=30 * i)
            year = calc_date.year
            month_name = calc_date.strftime('%B').upper()
            month_num = calc_date.month
            
            # Check if period already exists
            existing_period = PayrollPeriod.objects.filter(
                tenant=tenant,
                year=year,
                month=month_name
            ).first()
            
            # Get employee count for this tenant
            total_employees = EmployeeProfile.objects.filter(tenant=tenant, is_active=True).count()
            
            if existing_period:
                # Period exists - get calculation status
                calculated_count = CalculatedSalary.objects.filter(
                    tenant=tenant,
                    payroll_period=existing_period
                ).count()
                
                paid_count = CalculatedSalary.objects.filter(
                    tenant=tenant,
                    payroll_period=existing_period,
                    is_paid=True
                ).count()
                
                # Determine status
                if existing_period.is_locked:
                    status = 'LOCKED'
                    status_color = 'red'
                elif calculated_count > 0:
                    if paid_count == calculated_count:
                        status = 'COMPLETED'
                        status_color = 'green'
                    else:
                        status = 'CALCULATED'
                        status_color = 'blue'
                else:
                    status = 'PENDING'
                    status_color = 'orange'
                
                period_data = {
                    'id': existing_period.id,
                    'year': year,
                    'month': month_name,
                    'month_display': month_name.title(),
                    'month_year_display': f"{month_name.title()} {year}",
                    'data_source': existing_period.data_source,
                    'is_locked': existing_period.is_locked,
                    'calculation_date': existing_period.calculation_date.isoformat() if existing_period.calculation_date else None,
                    'working_days_in_month': existing_period.working_days_in_month,
                    'tds_rate': float(existing_period.tds_rate),
                    'exists': True,
                    'can_calculate': not existing_period.is_locked,
                    'status': status,
                    'status_color': status_color,
                    'calculated_count': calculated_count,
                    'paid_count': paid_count,
                    'total_employees': total_employees
                }
            else:
                # Period doesn't exist - can be created and calculated
                # Calculate working days for the month
                working_days = len([d for d in range(1, calendar.monthrange(year, month_num)[1] + 1)
                                  if calendar.weekday(year, month_num, d) < 5])  # Monday=0, Sunday=6
                
                period_data = {
                    'id': None,  # No ID since it doesn't exist yet
                    'year': year,
                    'month': month_name,
                    'month_display': month_name.title(),
                    'month_year_display': f"{month_name.title()} {year}",
                    'data_source': 'FRONTEND',
                    'is_locked': False,
                    'calculation_date': None,
                    'working_days_in_month': working_days,
                    'tds_rate': 5.0,  # Default TDS rate
                    'exists': False,
                    'can_calculate': True,
                    'status': 'AVAILABLE',
                    'status_color': 'gray',
                    'calculated_count': 0,
                    'paid_count': 0,
                    'total_employees': total_employees
                }
            
            available_periods.append(period_data)
        
        # Sort by year and month (newest first)
        available_periods.sort(key=lambda x: (x['year'], x['month']), reverse=True)
        
        return Response({
            'success': True,
            'periods': available_periods,
            'total_periods': len(available_periods)
        })
        
    except Exception as e:
        logger.error(f"Error in available_calculation_periods: {str(e)}")
        return Response({"error": f"Failed to get available periods: {str(e)}"}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_periods_list(request):
    """
    Get list of all payroll periods with basic info
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        # Import models locally to avoid any import issues
        from ..models import PayrollPeriod, CalculatedSalary
        
        periods = PayrollPeriod.objects.filter(tenant=tenant).order_by('-year', '-month')
        
        periods_data = []
        for period in periods:
            try:
                # Get basic summary for each period
                calculated_count = CalculatedSalary.objects.filter(
                    tenant=tenant,
                    payroll_period=period
                ).count()
                
                paid_count = CalculatedSalary.objects.filter(
                    tenant=tenant,
                    payroll_period=period,
                    is_paid=True
                ).count()
                
                periods_data.append({
                    'id': period.id,
                    'year': period.year,
                    'month': period.month,
                    'data_source': period.data_source,
                    'is_locked': period.is_locked,
                    'calculation_date': period.calculation_date.isoformat() if period.calculation_date else None,
                    'working_days_in_month': period.working_days_in_month,
                    'tds_rate': float(period.tds_rate),
                    'calculated_count': calculated_count,
                    'paid_count': paid_count,
                    'pending_count': calculated_count - paid_count
                })
            except Exception as period_error:
                logger.error(f"Error processing period {period.id}: {str(period_error)}")
                continue
        
        return Response({
            'success': True,
            'periods': periods_data
        })
        
    except Exception as e:
        logger.error(f"Error in payroll_periods_list: {str(e)}")
        return Response({"error": f"Failed to get periods: {str(e)}"}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_overview(request):
    """
    Optimized comprehensive payroll overview with all periods and their status
    """
    import time
    from django.db.models import Count, Sum, Q
    from django.core.cache import cache
    
    start_time = time.time()
    
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        # Check for cache bypass
        no_cache = request.GET.get('no_cache', 'false').lower() == 'true'
        cache_key = f"payroll_overview_{tenant.id}"
        
        # Try to get from cache first (unless bypassed)
        if not no_cache:
            cached_data = cache.get(cache_key)
            if cached_data:
                cached_data['performance']['cached'] = True
                cached_data['performance']['response_time'] = f"{(time.time() - start_time):.3f}s"
                return Response(cached_data)
        
        # Get current month info
        current_date = datetime.now()
        current_month = current_date.strftime('%B').upper()
        current_year = current_date.year
        
        # Get all payroll periods with related salary calculations in single query (ordered by calendar date)
        from django.db.models import Case, When, IntegerField
        
        # Define month ordering for proper calendar sorting (complete mapping)
        month_order = {
            'JANUARY': 1, 'FEBRUARY': 2, 'MARCH': 3, 'APRIL': 4,
            'MAY': 5, 'JUNE': 6, 'JULY': 7, 'AUGUST': 8,
            'SEPTEMBER': 9, 'OCTOBER': 10, 'NOVEMBER': 11, 'DECEMBER': 12,
            # Also handle common abbreviations that might be stored
            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4,
            'JUN': 6, 'JUL': 7, 'AUG': 8, 'SEP': 9,
            'OCT': 10, 'NOV': 11, 'DEC': 12
        }
        
        # Create Case/When conditions with proper string quoting
        when_conditions = []
        for month_name, month_num in month_order.items():
            # Case-insensitive match so variations like "June" or "june" are handled
            when_conditions.append(When(month__iexact=month_name, then=month_num))
        
        periods = PayrollPeriod.objects.filter(tenant=tenant).prefetch_related(
            'calculated_salaries'
        ).annotate(
            month_num=Case(
                *when_conditions,
                default=13,  # Put unknown months at the end
                output_field=IntegerField()
            )
        ).order_by('-year', '-month_num')  # Now properly ordered by calendar date
        
        # FIXED: Check if current month period exists (normalize to short format for comparison)
        from ..services.salary_service import SalaryCalculationService
        current_month_normalized = SalaryCalculationService._normalize_month_to_short(current_month)
        current_period_exists = periods.filter(
            year=current_year
        ).filter(
            Q(month__iexact=current_month_normalized) | Q(month__iexact=current_month)
        ).exists()
        
        # Get aggregated data from both CalculatedSalary and SalaryData models
        from ..models import SalaryData
        
        # Aggregate from CalculatedSalary (frontend-calculated data)
        calculated_aggregates = CalculatedSalary.objects.filter(
            tenant=tenant,
            payroll_period__in=periods
        ).values('payroll_period').annotate(
            total_employees=Count('id'),
            paid_employees=Count('id', filter=Q(is_paid=True)),
            total_gross_salary=Sum('gross_salary'),
            total_net_salary=Sum('net_payable'),
            total_advance_deductions=Sum('advance_deduction_amount'),
            total_tds=Sum('tds_amount')
        )
        
        # Aggregate from SalaryData (uploaded Excel data)
        uploaded_aggregates = SalaryData.objects.filter(
            tenant=tenant,
            year__in=[p.year for p in periods],
            month__in=[p.month for p in periods]
        ).values('year', 'month').annotate(
            total_employees=Count('id'),
            paid_employees=Count('id'),  # SalaryData doesn't have is_paid field, assume all unpaid initially
            total_gross_salary=Sum('sal_ot'),  # Use SAL+OT as gross salary
            total_net_salary=Sum('nett_payable'),
            total_advance_deductions=Sum('advance'),
            total_tds=Sum('tds')
        )
        
        # Create lookup dictionaries for O(1) access
        calculated_lookup = {
            agg['payroll_period']: agg for agg in calculated_aggregates
        }
        
        # Create lookup for uploaded data by matching period
        uploaded_lookup = {}
        for period in periods:
            for agg in uploaded_aggregates:
                if agg['year'] == period.year and agg['month'] == period.month:
                    uploaded_lookup[period.id] = agg
                    break
        
        # Combine both data sources
        salary_lookup = {}
        for period in periods:
            calculated_data = calculated_lookup.get(period.id, {
                'total_employees': 0, 'paid_employees': 0, 'total_gross_salary': 0,
                'total_net_salary': 0, 'total_advance_deductions': 0, 'total_tds': 0
            })
            uploaded_data = uploaded_lookup.get(period.id, {
                'total_employees': 0, 'paid_employees': 0, 'total_gross_salary': 0,
                'total_net_salary': 0, 'total_advance_deductions': 0, 'total_tds': 0
            })
            
            # Use uploaded data if available, otherwise use calculated data
            if uploaded_data['total_employees'] > 0:
                salary_lookup[period.id] = uploaded_data
            else:
                salary_lookup[period.id] = calculated_data
        
        overview_data = []
        for period in periods:
            # Get aggregated data for this period (O(1) lookup)
            agg_data = salary_lookup.get(period.id, {
                'total_employees': 0,
                'paid_employees': 0,
                'total_gross_salary': 0,
                'total_net_salary': 0,
                'total_advance_deductions': 0,
                'total_tds': 0
            })
            
            total_employees = agg_data['total_employees']
            paid_employees = agg_data['paid_employees']
            pending_employees = total_employees - paid_employees
            
            # Determine status
            if period.data_source == DataSource.UPLOADED:
                status = 'UPLOADED'
                status_color = 'purple'
            elif period.is_locked:
                status = 'LOCKED'
                status_color = 'red'
            elif paid_employees == total_employees and total_employees > 0:
                status = 'COMPLETED'
                status_color = 'green'
            elif total_employees > 0:
                status = 'CALCULATED'
                status_color = 'blue'
            else:
                status = 'PENDING'
                status_color = 'orange'
            
            # FIXED: Properly format month_display from short format (JAN -> January, OCT -> October)
            month_display_map = {
                'JAN': 'January', 'FEB': 'February', 'MAR': 'March', 'APR': 'April',
                'MAY': 'May', 'JUN': 'June', 'JUL': 'July', 'AUG': 'August',
                'SEP': 'September', 'OCT': 'October', 'NOV': 'November', 'DEC': 'December',
                # Handle full names if they exist (backward compatibility)
                'JANUARY': 'January', 'FEBRUARY': 'February', 'MARCH': 'March', 'APRIL': 'April',
                'JUNE': 'June', 'JULY': 'July', 'AUGUST': 'August',
                'SEPTEMBER': 'September', 'OCTOBER': 'October', 'NOVEMBER': 'November', 'DECEMBER': 'December'
            }
            month_display = month_display_map.get(period.month.upper(), period.month.title())
            
            overview_data.append({
                'id': period.id,
                'year': period.year,
                'month': period.month,
                'month_display': month_display,
                'data_source': period.data_source,
                'status': status,
                'status_color': status_color,
                'is_locked': period.is_locked,
                'calculation_date': period.calculation_date.isoformat() if period.calculation_date else None,
                'working_days': period.working_days_in_month,
                'tds_rate': float(period.tds_rate),
                'total_employees': total_employees,
                'paid_employees': paid_employees,
                'pending_employees': pending_employees,
                'total_gross_salary': float(agg_data['total_gross_salary'] or 0),
                'total_net_salary': float(agg_data['total_net_salary'] or 0),
                'total_advance_deductions': float(agg_data['total_advance_deductions'] or 0),
                'total_tds': float(agg_data['total_tds'] or 0),
                'can_modify': not period.is_locked and period.data_source != DataSource.UPLOADED
            })
        
        query_time = time.time() - start_time
        
        response_data = {
            'success': True,
            'current_month': current_month,
            'current_year': current_year,
            'current_period_exists': current_period_exists,
            'periods': overview_data,
            'total_periods': len(overview_data),
            'performance': {
                'query_time': f"{query_time:.3f}s",
                'optimization': 'Single aggregated query with prefetch_related',
                'periods_processed': len(periods),
                'cached': False,
                'response_time': f"{query_time:.3f}s"
            }
        }
        
        # Cache the result for 15 minutes (900 seconds)
        cache.set(cache_key, response_data, 900)
        
        return Response(response_data)
        
    except Exception as e:
        logger.error(f"Error in payroll_overview: {str(e)}")
        return Response({"error": f"Failed to get overview: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_current_month_payroll(request):
    """
    Create payroll period for current month
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        current_date = datetime.now()
        current_month = current_date.strftime('%B').upper()
        current_year = current_date.year
        
        # FIXED: Normalize month to short format (JAN, FEB, etc.) to match SalaryData format
        from ..services.salary_service import SalaryCalculationService
        current_month_normalized = SalaryCalculationService._normalize_month_to_short(current_month)
        
        # Check if period already exists (check both formats for backward compatibility)
        from django.db.models import Q
        existing_period = PayrollPeriod.objects.filter(
            tenant=tenant,
            year=current_year
        ).filter(
            Q(month=current_month_normalized) | Q(month=current_month)
        ).first()
        
        if existing_period:
            return Response({
                "error": f"Payroll period for {current_month_normalized} {current_year} already exists"
            }, status=400)
        
        # Create new period
        new_period = PayrollPeriod.objects.create(
            tenant=tenant,
            year=current_year,
            month=current_month_normalized,  # Use normalized short format
            data_source=DataSource.FRONTEND,
            working_days_in_month=request.data.get('working_days', 25),
            tds_rate=request.data.get('tds_rate', 5.0)
        )
        
        return Response({
            'success': True,
            'message': f'Payroll period created for {current_month} {current_year}',
            'period_id': new_period.id,
            'period': {
                'id': new_period.id,
                'year': new_period.year,
                'month': new_period.month,
                'data_source': new_period.data_source,
                'working_days': new_period.working_days_in_month,
                'tds_rate': float(new_period.tds_rate)
            }
        })
        
    except Exception as e:
        logger.error(f"Error in create_current_month_payroll: {str(e)}")
        return Response({"error": f"Failed to create period: {str(e)}"}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_period_detail(request, period_id):
    """
    Get detailed view of a specific payroll period
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        period = PayrollPeriod.objects.filter(tenant=tenant, id=period_id).first()
        if not period:
            return Response({"error": "Payroll period not found"}, status=404)
        
        # Get data based on period data source
        employees_data = []
        
        # FIXED: For UPLOADED periods, prefer CalculatedSalary records if they exist
        # (they have is_paid status), otherwise fall back to SalaryData
        if period.data_source == DataSource.UPLOADED:
            # Check if CalculatedSalary records exist for this period
            calculated_salaries = CalculatedSalary.objects.filter(
                tenant=tenant,
                payroll_period=period
            )
            
            if calculated_salaries.exists():
                # Use CalculatedSalary records (they have is_paid status)
                for calc in calculated_salaries.order_by('employee_name'):
                    employees_data.append({
                        'id': calc.id,
                        'employee_id': calc.employee_id,
                        'employee_name': calc.employee_name,
                        'department': calc.department or '',
                        'basic_salary': float(calc.basic_salary),
                        'working_days': int(calc.total_working_days),
                        'absent_days': float(calc.absent_days),
                        'present_days': float(calc.present_days),
                        'ot_hours': float(calc.ot_hours),
                        'hour_rate': float(calc.basic_salary_per_hour),
                        'ot_charges': float(calc.ot_charges),
                        'late_minutes': calc.late_minutes,
                        'late_deduction': float(calc.late_deduction),
                        'amt': float(calc.late_deduction),  # Map to amt for compatibility
                        'gross_salary': float(calc.gross_salary),
                        'adv_25th': 0.0,  # Not available in CalculatedSalary
                        'old_adv': 0.0,  # Not available in CalculatedSalary
                        'incentive': float(calc.incentive),
                        'tds_amount': float(calc.tds_amount),
                        'salary_after_tds': float(calc.salary_after_tds),
                        'total_advance_balance': float(calc.total_advance_balance),
                        'advance_deduction_amount': float(calc.advance_deduction_amount),
                        'remaining_advance_balance': float(calc.remaining_advance_balance),
                        'net_payable': float(calc.net_payable),
                        'tds_percentage': float(calc.employee_tds_rate),
                        'advance_deduction_editable': calc.advance_deduction_editable,
                        'is_paid': calc.is_paid,  # FIXED: Use actual is_paid from CalculatedSalary
                        'payment_date': calc.payment_date.isoformat() if calc.payment_date else None
                    })
            else:
                # Fallback: Use SalaryData if CalculatedSalary doesn't exist yet
                from ..models import SalaryData
                uploaded_salaries = SalaryData.objects.filter(
                    tenant=tenant,
                    year=period.year,
                    month=period.month
                ).order_by('name')
                
                for salary in uploaded_salaries:
                    # Calculate present_days correctly: working_days - absent_days
                    working_days = int(salary.days)
                    absent_days = float(salary.absent)
                    present_days = max(0, working_days - absent_days)  # Ensure non-negative
                    
                    # Log any potential data issues for debugging
                    if len(employees_data) < 3:  # Log first 3 employees for debugging
                        logger.info(f"Uploaded Payroll - {salary.name}: working_days={working_days}, absent_days={absent_days}, calculated_present_days={present_days}")
                    
                    employees_data.append({
                        'id': salary.id,
                        'employee_id': salary.employee_id,
                        'employee_name': salary.name,
                        'department': salary.department or '',
                        # Excel Template Fields - Calculate present_days correctly
                        'basic_salary': float(salary.salary),  # SALARY
                        'working_days': working_days,  # DAYS
                        'absent_days': absent_days,  # ABSENT
                        'present_days': present_days,  # Calculate: working_days - absent_days
                        'ot_hours': float(salary.ot),  # OT
                        'hour_rate': float(salary.hour_rs),  # HOUR RS
                        'ot_charges': float(salary.charges),  # CHARGES
                        'late_minutes': int(salary.late),  # LATE
                        'late_deduction': float(salary.charge),  # CHARGE
                        'amt': float(salary.amt),  # AMT
                        'gross_salary': float(salary.sal_ot),  # SAL+OT
                        'adv_25th': float(salary.adv_25th),  # 25TH ADV
                        'old_adv': float(salary.old_adv),  # OLD ADV
                        'incentive': float(salary.incentive),  # INCENTIVE
                        'tds_amount': float(salary.tds),  # TDS
                        'salary_after_tds': float(salary.sal_tds),  # SAL-TDS
                        'total_advance_balance': float(salary.total_old_adv),  # Total old ADV
                        'advance_deduction_amount': float(salary.advance),  # ADVANCE
                        'remaining_advance_balance': float(salary.balnce_adv),  # Balnce Adv
                        'net_payable': float(salary.nett_payable),  # NETT PAYABLE - Final amount
                        # System fields
                        'tds_percentage': 0,  # Not calculated for Excel uploads
                        'advance_deduction_editable': False,  # Uploaded data is read-only
                        'is_paid': False,  # SalaryData doesn't track payment status
                        'payment_date': None
                    })
        else:
            # Get calculated salaries for frontend-tracked data
            calculated_salaries = CalculatedSalary.objects.filter(
                tenant=tenant,
                payroll_period=period
            ).order_by('employee_name')
            
            for calc in calculated_salaries:
                # Debug logging for first few employees (removed recalculation logic for performance)
                if len(employees_data) < 3:
                    logger.info(f"Payroll Detail - Employee {calc.employee_name}: gross_salary={calc.gross_salary}, ot_charges={calc.ot_charges}, late_deduction={calc.late_deduction}, basic_salary={calc.basic_salary}, present_days={calc.present_days}, working_days={calc.total_working_days}")
                
                employees_data.append({
                    'id': calc.id,
                    'employee_id': calc.employee_id,
                    'employee_name': calc.employee_name,
                    'department': calc.department,
                    'basic_salary': float(calc.basic_salary),
                    'working_days': int(calc.total_working_days),
                    'present_days': float(calc.present_days),
                    'absent_days': float(calc.absent_days),
                    'ot_hours': float(calc.ot_hours),
                    'ot_charges': float(calc.ot_charges),
                    'late_minutes': calc.late_minutes,
                    'late_deduction': float(calc.late_deduction),
                    'gross_salary': float(calc.gross_salary),
                    'tds_percentage': float(calc.employee_tds_rate),
                    'tds_amount': float(calc.tds_amount),
                    'salary_after_tds': float(calc.salary_after_tds),
                    'total_advance_balance': float(calc.total_advance_balance),
                    'advance_deduction_amount': float(calc.advance_deduction_amount),
                    'advance_deduction_editable': calc.advance_deduction_editable,
                    'remaining_advance_balance': float(calc.remaining_advance_balance),
                    'net_payable': float(calc.net_payable),
                    'is_paid': calc.is_paid,
                    'payment_date': calc.payment_date.isoformat() if calc.payment_date else None
                })
        
        # Calculate summary using database aggregation for better performance
        if period.data_source == DataSource.UPLOADED:
            # For uploaded data, check if CalculatedSalary exists first
            calculated_salaries = CalculatedSalary.objects.filter(
                tenant=tenant,
                payroll_period=period
            )
            
            if calculated_salaries.exists():
                # Use CalculatedSalary aggregation (has is_paid status)
                from django.db.models import Sum, Count, Q
                summary_agg = calculated_salaries.aggregate(
                    total_gross=Sum('gross_salary'),
                    total_net=Sum('net_payable'),
                    total_advances=Sum('advance_deduction_amount'),
                    total_tds=Sum('tds_amount'),
                    total_employees=Count('id'),
                    paid_employees=Count('id', filter=Q(is_paid=True))
                )
                
                total_gross = float(summary_agg['total_gross'] or 0)
                total_net = float(summary_agg['total_net'] or 0)
                total_advances = float(summary_agg['total_advances'] or 0)
                total_tds = float(summary_agg['total_tds'] or 0)
                total_employees = summary_agg['total_employees'] or 0
                paid_employees = summary_agg['paid_employees'] or 0
            else:
                # Fallback: Aggregate from SalaryData
                from django.db.models import Sum, Count
                from ..models import SalaryData
                summary_agg = SalaryData.objects.filter(
                    tenant=tenant,
                    year=period.year,
                    month=period.month
                ).aggregate(
                    total_gross=Sum('sal_ot'),
                    total_net=Sum('nett_payable'),
                    total_advances=Sum('advance'),
                    total_tds=Sum('tds'),
                    total_employees=Count('id')
                )
                
                total_gross = float(summary_agg['total_gross'] or 0)
                total_net = float(summary_agg['total_net'] or 0)
                total_advances = float(summary_agg['total_advances'] or 0)
                total_tds = float(summary_agg['total_tds'] or 0)
                total_employees = summary_agg['total_employees'] or 0
                paid_employees = 0  # SalaryData doesn't track payment status
        else:
            # For calculated data, aggregate from CalculatedSalary
            from django.db.models import Sum, Count, Q
            summary_agg = CalculatedSalary.objects.filter(
                tenant=tenant,
                payroll_period=period
            ).aggregate(
                total_gross=Sum('gross_salary'),
                total_net=Sum('net_payable'),
                total_advances=Sum('advance_deduction_amount'),
                total_tds=Sum('tds_amount'),
                total_employees=Count('id'),
                paid_employees=Count('id', filter=Q(is_paid=True))
            )
            
            total_gross = float(summary_agg['total_gross'] or 0)
            total_net = float(summary_agg['total_net'] or 0)
            total_advances = float(summary_agg['total_advances'] or 0)
            total_tds = float(summary_agg['total_tds'] or 0)
            total_employees = summary_agg['total_employees'] or 0
            paid_employees = summary_agg['paid_employees'] or 0
        
        return Response({
            'success': True,
            'period': {
                'id': period.id,
                'year': period.year,
                'month': period.month,
                'data_source': period.data_source,
                'is_locked': period.is_locked,
                'working_days': period.working_days_in_month,
                'tds_rate': float(period.tds_rate),
                'calculation_date': period.calculation_date.isoformat() if period.calculation_date else None
            },
            'employees': employees_data,
            'summary': {
                'total_employees': len(employees_data),  # Use actual count from data
                'paid_employees': paid_employees if 'paid_employees' in locals() else sum(1 for emp in employees_data if emp['is_paid']),
                'pending_employees': len(employees_data) - (paid_employees if 'paid_employees' in locals() else sum(1 for emp in employees_data if emp['is_paid'])),
                'total_gross_salary': total_gross,
                'total_net_salary': total_net,
                'total_advance_deductions': total_advances,
                'total_tds': total_tds
            }
        })
        
    except Exception as e:
        logger.error(f"Error in payroll_period_detail: {str(e)}")
        return Response({"error": f"Failed to get period detail: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_employee_advance(request):
    """
    Add advance amount for an employee
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        data = request.data
        employee_id = data.get('employee_id')
        amount = data.get('amount')
        for_month = data.get('for_month')
        payment_method = data.get('payment_method', 'CASH')
        remarks = data.get('remarks', '')
        
        if not all([employee_id, amount, for_month]):
            return Response({
                "error": "employee_id, amount, and for_month are required"
            }, status=400)
        
        try:
            amount = Decimal(str(amount))
        except (ValueError, TypeError):
            return Response({"error": "Invalid amount format"}, status=400)
        
        # Get employee details
        employee = EmployeeProfile.objects.filter(
            tenant=tenant,
            employee_id=employee_id
        ).first()
        
        if not employee:
            return Response({"error": "Employee not found"}, status=404)
        
        # Create advance record
        advance = AdvanceLedger.objects.create(
            tenant=tenant,
            employee_id=employee_id,
            employee_name=employee.full_name,
            advance_date=datetime.now().date(),
            amount=amount,
            for_month=for_month,
            payment_method=payment_method,
            status='PENDING',
            remarks=remarks
        )
        
        
        # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
        from django.core.cache import cache
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")
        
        return Response({
            'success': True,
            'message': f'Advance of ₹{amount} added for {employee.full_name}',
            'advance_id': advance.id,
            'advance': {
                'id': advance.id,
                'employee_id': advance.employee_id,
                'employee_name': advance.employee_name,
                'amount': float(advance.amount),
                'for_month': advance.for_month,
                'payment_method': advance.payment_method,
                'status': advance.status,
                'advance_date': advance.advance_date.isoformat(),
                'remarks': advance.remarks
            }
        })
        
    except Exception as e:
        logger.error(f"Error in add_employee_advance: {str(e)}")
        return Response({"error": f"Failed to add advance: {str(e)}"}, status=500)

class AdvancePaymentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing advance payments with full CRUD operations
    """
    serializer_class = AdvanceLedgerSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['employee_id', 'employee_name', 'remarks']
    ordering_fields = ['advance_date', 'amount', 'for_month']
    
    def dispatch(self, request, *args, **kwargs):
        logger.info(f"AdvancePaymentViewSet dispatch: {request.method} {request.path}")
        return super().dispatch(request, *args, **kwargs)
    
    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return AdvanceLedger.objects.none()
        return AdvanceLedger.objects.filter(tenant=tenant).order_by('-advance_date')
    
    def list(self, request, *args, **kwargs):
        """
        Optimized list all advance payments with additional fields
        """
        start_time = time.time()
        
        queryset = self.get_queryset()
        
        # Apply search filters efficiently
        search_query = request.query_params.get('search', '')
        if search_query:
            queryset = queryset.filter(
                Q(employee_name__icontains=search_query) |
                Q(employee_id__icontains=search_query) |
                Q(remarks__icontains=search_query)
            )
        
        # Apply amount filter efficiently
        amount_filter = request.query_params.get('amount', '')
        if amount_filter:
            try:
                amount_value = Decimal(amount_filter)
                queryset = queryset.filter(amount=amount_value)
            except (ValueError, TypeError):
                # If not a valid number, search in remarks or other text fields
                queryset = queryset.filter(
                    Q(remarks__icontains=amount_filter)
                )
        
        # Optimize query with select_related if there are foreign keys in the future
        # For now, ensure we only fetch what we need
        queryset = queryset.only(
            'id', 'employee_id', 'employee_name', 'advance_date', 
            'amount', 'for_month', 'payment_method', 'status', 'remarks',
            'created_at', 'updated_at'
        )
        
        # Apply pagination if needed
        page_size = request.query_params.get('page_size', None)
        if page_size:
            try:
                page_size = int(page_size)
                queryset = queryset[:page_size]
            except ValueError:
                pass
        
        # Get all advances at once (no N+1 queries)
        advances = list(queryset)
        
        # Prepare response data efficiently
        advances_data = []
        for advance in advances:
            advance_data = {
                'id': advance.id,
                'employee_id': advance.employee_id,
                'employee_name': advance.employee_name,
                'advance_date': advance.advance_date.isoformat(),
                'amount': float(advance.amount),
                'for_month': advance.for_month,
                'payment_method': advance.payment_method,
                'status': advance.status,
                'remarks': advance.remarks or '',
                'created_at': advance.created_at.isoformat(),
                'updated_at': advance.updated_at.isoformat(),
                # Add calculated fields without additional queries
                'remaining_balance': float(advance.remaining_balance),
                'is_active': advance.status != 'REPAID',
                'is_fully_repaid': advance.status == 'REPAID',
                'amount_formatted': f"₹{advance.amount:,.2f}",
                'status_display': 'Fully Repaid' if advance.status == 'REPAID' else 'Pending'
            }
            advances_data.append(advance_data)
        
        end_time = time.time()
        response_time = round((end_time - start_time) * 1000, 2)  # Convert to milliseconds
        
        logger.info(f"AdvancePaymentViewSet.list completed in {response_time}ms for {len(advances_data)} records")
        
        return Response({
            'success': True,
            'count': len(advances_data),
            'results': advances_data,
            'performance': {
                'query_time_ms': response_time,
                'record_count': len(advances_data)
            }
        })
    
    def create(self, request, *args, **kwargs):
        """
        Create a new advance payment
        """
        logger.info(f"AdvancePaymentViewSet.create called with data: {request.data}")
        try:
            tenant = getattr(request, 'tenant', None)
            if not tenant:
                return Response({"error": "No tenant found"}, status=400)
            
            # Prepare data with required fields
            data = request.data.copy()
            employee_id = data.get('employee_id')
            
            # Get employee info
            try:
                employee = EmployeeProfile.objects.get(employee_id=employee_id, tenant=tenant)
                data['employee_name'] = f"{employee.first_name} {employee.last_name}".strip()
            except EmployeeProfile.DoesNotExist:
                return Response({"error": "Employee not found"}, status=404)
            
            # Set default values
            data['advance_date'] = timezone.now().date().isoformat()
            data['status'] = 'PENDING'
            
            # Create serializer with prepared data
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            
            # Save with tenant
            advance = serializer.save(tenant=tenant)
            
            # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
            from django.core.cache import cache
            cache_key = f"payroll_overview_{tenant.id}"
            cache.delete(cache_key)
            
            # Clear advance payments list cache
            advance_payments_cache_key = f"advance_payments_list_{tenant.id}"
            cache.delete(advance_payments_cache_key)
            
            # Clear frontend charts cache to refresh dashboard immediately
            try:
                # Try to clear all frontend charts cache variations
                cache.delete_pattern(f"frontend_charts_{tenant.id}_*")
            except AttributeError:
                # Fallback: Clear specific common cache keys
                cache.delete(f"frontend_charts_{tenant.id}")
            
            logger.info(f"Cleared payroll overview, advance payments list, and frontend charts cache for tenant {tenant.id}")
            
            return Response({
                'success': True,
                'message': 'Advance payment created successfully',
                'advance': serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating advance payment: {str(e)}")
            return Response({"error": f"Failed to create advance: {str(e)}"}, status=500)
    
    def update(self, request, *args, **kwargs):
        """
        Update an advance payment
        """
        try:
            # Always use partial update to allow updating specific fields only
            partial = True
            instance = self.get_object()
            
            # Don't allow updating employee_id (keep it consistent for tracking)
            data = request.data.copy()
            if 'employee_id' in data and data['employee_id'] != instance.employee_id:
                return Response({
                    "error": "Cannot change employee ID for an existing advance payment"
                }, status=400)
            
            # Don't allow updating employee_name (it's auto-set from employee profile)
            data.pop('employee_name', None)
            
            # Don't allow updating advance_date (it's set when created)
            data.pop('advance_date', None)
            
            serializer = self.get_serializer(instance, data=data, partial=partial)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            
            # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
            from django.core.cache import cache
            tenant_id = getattr(self.request, 'tenant', None).id
            cache_key = f"payroll_overview_{tenant_id}"
            cache.delete(cache_key)
            
            # Clear advance payments list cache
            advance_payments_cache_key = f"advance_payments_list_{tenant_id}"
            cache.delete(advance_payments_cache_key)
            
            logger.info(f"Cleared payroll overview and advance payments list cache for tenant {tenant_id}")
            
            return Response({
                'success': True,
                'message': 'Advance payment updated successfully',
                'advance': serializer.data
            })
            
        except Exception as e:
            logger.error(f"Error updating advance payment: {str(e)}")
            return Response({"error": f"Failed to update advance: {str(e)}"}, status=500)
    
    def destroy(self, request, *args, **kwargs):
        """
        Delete an advance payment
        """
        try:
            instance = self.get_object()
            
            # Check if advance is already deducted from salary
            if hasattr(instance, 'status') and instance.status == 'DEDUCTED':
                return Response({
                    "error": "Cannot delete advance that has already been deducted from salary"
                }, status=400)
            
            instance.delete()
            
            # CLEAR CACHE: Invalidate payroll overview and advance payments cache after deletion
            from django.core.cache import cache
            tenant_id = getattr(self.request, 'tenant', None).id
            cache_key = f"payroll_overview_{tenant_id}"
            cache.delete(cache_key)
            
            # Clear advance payments list cache
            advance_payments_cache_key = f"advance_payments_list_{tenant_id}"
            cache.delete(advance_payments_cache_key)
            
            logger.info(f"Cleared payroll overview and advance payments list cache for tenant {tenant_id}")
            
            return Response({
                'success': True,
                'message': 'Advance payment deleted successfully'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error deleting advance payment: {str(e)}")
            return Response({"error": f"Failed to delete advance: {str(e)}"}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_months_with_attendance(request):
    """
    OPTIMIZED: Get list of months/years that have attendance data for payroll calculation
    Single aggregated query + caching for 90%+ performance improvement
    """
    import time
    from django.core.cache import cache
    from django.db.models import Count, Q
    import calendar
    
    start_time = time.time()
    
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        # Check cache first (cache for 30 minutes since attendance data doesn't change frequently)
        cache_key = f"months_with_attendance_{tenant.id}"
        use_cache = request.GET.get('no_cache', '').lower() != 'true'
        
        if use_cache:
            cached_data = cache.get(cache_key)
            if cached_data:
                cached_data['performance']['cached'] = True
                cached_data['performance']['query_time'] = f"{(time.time() - start_time):.3f}s"
                
                return Response(cached_data)
        
        from ..models import DailyAttendance, SalaryData, Attendance
        
        # Get daily attendance data periods (from attendance log)
        daily_attendance_aggregated = DailyAttendance.objects.filter(
            tenant=tenant
        ).extra(
            select={
                'year': "EXTRACT(year FROM date)", 
                'month': "EXTRACT(month FROM date)"
            }
        ).values('year', 'month').annotate(
            attendance_records=Count('id'),
            employees_with_attendance=Count('employee_id', distinct=True)
        ).order_by('-year', '-month')
        
        # Get monthly attendance data periods (from Excel uploads)
        monthly_attendance_aggregated = Attendance.objects.filter(
            tenant=tenant
        ).extra(
            select={
                'year': "EXTRACT(year FROM date)", 
                'month': "EXTRACT(month FROM date)"
            }
        ).values('year', 'month').annotate(
            attendance_records=Count('id'),
            employees_with_attendance=Count('employee_id', distinct=True)
        ).order_by('-year', '-month')
        
        # OPTIMIZED: Combine both attendance sources using efficient aggregation
        attendance_dict = {}
        
        # Process daily attendance
        for period in daily_attendance_aggregated:
            year = int(period['year'])
            month_num = int(period['month'])
            key = f"{year}-{month_num}"
            if key not in attendance_dict:
                attendance_dict[key] = {
                    'year': year,
                    'month_num': month_num,
                    'attendance_records': 0,
                    'daily_employees': set(),
                    'monthly_employees': set()
                }
            attendance_dict[key]['attendance_records'] += period['attendance_records']
        
        # Process monthly attendance (Excel uploads)
        for period in monthly_attendance_aggregated:
            year = int(period['year'])
            month_num = int(period['month'])
            key = f"{year}-{month_num}"
            if key not in attendance_dict:
                attendance_dict[key] = {
                    'year': year,
                    'month_num': month_num,
                    'attendance_records': 0,
                    'daily_employees': set(),
                    'monthly_employees': set()
                }
            attendance_dict[key]['attendance_records'] += period['attendance_records']
        
        # ULTRA-OPTIMIZED: Use a single query to get all distinct employee counts at once
        from django.db import connection
        
        # Build single query with UNION to get all employees for all periods
        employee_counts_by_period = {key: {'daily_employees': set(), 'monthly_employees': set()} 
                                     for key in attendance_dict.keys()}
        
        if attendance_dict:
            with connection.cursor() as cursor:
                # Build a single UNION query for all periods at once
                # This reduces N*2 queries to just 2 queries total (one for each table)
                
                # Get all daily attendance employees for all periods in one query
                period_conditions = []
                params = [tenant.id]
                
                for key, data in attendance_dict.items():
                    period_conditions.append(
                        "(EXTRACT(year FROM date) = %s AND EXTRACT(month FROM date) = %s)"
                    )
                    params.extend([data['year'], data['month_num']])
                
                if period_conditions:
                    # Single query for all daily attendance
                    daily_query = f"""
                        SELECT EXTRACT(year FROM date)::int as year, 
                               EXTRACT(month FROM date)::int as month,
                               employee_id 
                        FROM excel_data_dailyattendance 
                        WHERE tenant_id = %s 
                        AND ({' OR '.join(period_conditions)})
                        GROUP BY year, month, employee_id
                    """
                    cursor.execute(daily_query, params)
                    for row in cursor.fetchall():
                        year, month, employee_id = row
                        key = f"{year}-{month}"
                        if key in employee_counts_by_period:
                            employee_counts_by_period[key]['daily_employees'].add(employee_id)
                    
                    # Single query for all monthly attendance
                    monthly_query = f"""
                        SELECT EXTRACT(year FROM date)::int as year, 
                               EXTRACT(month FROM date)::int as month,
                               employee_id 
                        FROM excel_data_attendance 
                        WHERE tenant_id = %s 
                        AND ({' OR '.join(period_conditions)})
                        GROUP BY year, month, employee_id
                    """
                    cursor.execute(monthly_query, params)
                    for row in cursor.fetchall():
                        year, month, employee_id = row
                        key = f"{year}-{month}"
                        if key in employee_counts_by_period:
                            employee_counts_by_period[key]['monthly_employees'].add(employee_id)
        
        # Build final attendance_aggregated list using the pre-computed counts
        attendance_aggregated = []
        for key, data in attendance_dict.items():
            # Combine both sources and count distinct employees
            if key in employee_counts_by_period:
                distinct_employees = len(
                    employee_counts_by_period[key]['daily_employees'].union(
                        employee_counts_by_period[key]['monthly_employees']
                    )
                )
            else:
                distinct_employees = 0
            
            attendance_aggregated.append({
                'year': data['year'],
                'month': data['month_num'],
                'attendance_records': data['attendance_records'],
                'employees_with_attendance': distinct_employees
            })
        
        # Get salary data periods
        salary_aggregated = SalaryData.objects.filter(
            tenant=tenant
        ).values('year', 'month').annotate(
            salary_records=Count('id'),
            employees_with_salary=Count('employee_id', distinct=True)
        ).order_by('-year', '-month')
        
        # Process results into final format
        available_periods = []
        periods_dict = {}
        
        # Process attendance data
        for period in attendance_aggregated:
            year = int(period['year'])
            month_num = int(period['month'])
            month_name = calendar.month_name[month_num].upper()
            key = f"{year}-{month_num}"
            
            periods_dict[key] = {
                'year': year,
                'month': month_name,
                'month_num': month_num,
                'month_display': f"{calendar.month_name[month_num]} {year}",
                'attendance_records': period['attendance_records'],
                'employees_with_attendance': period['employees_with_attendance'],
                'salary_records': 0,
                'employees_with_salary': 0
            }
        
        # Process salary data
        month_name_to_num = {
            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
        }
        
        for period in salary_aggregated:
            year = int(period['year'])
            month_name = period['month']
            month_num = month_name_to_num.get(month_name, 1)  # Default to 1 if not found
            key = f"{year}-{month_num}"
            
            if key in periods_dict:
                # Update existing period
                periods_dict[key]['salary_records'] = period['salary_records']
                periods_dict[key]['employees_with_salary'] = period['employees_with_salary']
            else:
                # Create new period for salary data
                periods_dict[key] = {
                    'year': year,
                    'month': month_name,
                    'month_num': month_num,
                    'month_display': f"{calendar.month_name[month_num]} {year}",
                    'attendance_records': 0,
                    'employees_with_attendance': 0,
                    'salary_records': period['salary_records'],
                    'employees_with_salary': period['employees_with_salary']
                }
        
        # Convert to list and sort
        available_periods = list(periods_dict.values())
        available_periods.sort(key=lambda x: (x['year'], x['month_num']), reverse=True)
        
        # Prepare response
        response_data = {
            'success': True,
            'periods': available_periods,
            'performance': {
                'query_time': f"{(time.time() - start_time):.3f}s",
                'periods_found': len(available_periods),
                'optimization': 'single_aggregated_query_with_cache',
                'cached': False
            }
        }
        
        # Cache the result for 30 minutes (1800 seconds)
        if use_cache:
            cache.set(cache_key, response_data, 1800)
        
        
        return Response(response_data)
        
    except Exception as e:
        logger.error(f"Error in get_months_with_attendance: {str(e)}")
        return Response({
            "error": f"Failed to get periods: {str(e)}",
            "performance": {
                "query_time": f"{(time.time() - start_time):.3f}s",
                "optimization": "error_occurred"
            }
        }, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_simple_payroll(request):
    """
    OPTIMIZED payroll calculation with bulk operations and efficient database queries
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        from ..models import EmployeeProfile, DailyAttendance, AdvanceLedger
        from django.db.models import Sum, Count, Q, Case, When, IntegerField, DecimalField, Value
        from decimal import Decimal
        import calendar
        import time
        
        start_time = time.time()
        logger.info("Starting optimized payroll calculation")
        
        year = request.data.get('year')
        month = request.data.get('month')
        
        if not year or not month:
            return Response({"error": "Year and month are required"}, status=400)
        
        try:
            year = int(year)
            if isinstance(month, str):
                # Convert month name to number
                month_num = list(calendar.month_name).index(month.title())
            else:
                month_num = int(month)
        except (ValueError, TypeError):
            return Response({"error": "Invalid year or month format"}, status=400)
        
        # Derive month name for attendance-tracker based calculations
        month_name_upper = calendar.month_name[month_num].upper()
        
        # Calculate total days in the month
        total_days_in_month = calendar.monthrange(year, month_num)[1]
        
        # Keep a generic month working days for summary only (Mon-Fri)
        working_days = len([d for d in range(1, total_days_in_month + 1)
                          if calendar.weekday(year, month_num, d) < 5])
        
        logger.info(f"Total days in month: {total_days_in_month}, Working days calculated: {working_days}")
        
        # OPTIMIZATION 1: Get all active employees with required fields only
        employees = EmployeeProfile.objects.filter(
            tenant=tenant, 
            is_active=True
        ).only(
            'employee_id', 'first_name', 'last_name', 'department', 
            'basic_salary', 'ot_charge_per_hour', 'tds_percentage'
        )
        
        employee_ids = list(employees.values_list('employee_id', flat=True))
        logger.info(f"Found {len(employee_ids)} active employees")
        
        if not employee_ids:
            return Response({
                'success': True,
                'payroll_data': [],
                'summary': {
                    'total_employees': 0,
                    'working_days': working_days,
                    'month_year': f"{calendar.month_name[month_num]} {year}",
                    'total_base_salary': 0,
                    'total_gross_salary': 0,
                    'total_net_salary': 0
                }
            })
        
        # OPTIMIZATION 2: Bulk fetch all attendance data from Attendance model (monthly summary)
        from ..models import Attendance
        attendance_summary = Attendance.objects.filter(
            tenant=tenant,
            employee_id__in=employee_ids,
            date__year=year,
            date__month=month_num
        ).values('employee_id').annotate(
            total_present=Sum('present_days', output_field=DecimalField(max_digits=5, decimal_places=1)),
            total_absent=Sum('absent_days', output_field=DecimalField(max_digits=5, decimal_places=1)),
            total_ot_hours=Sum('ot_hours', output_field=DecimalField(max_digits=10, decimal_places=2)),
            total_late_minutes=Sum('late_minutes', output_field=IntegerField()),
            # FIXED: Include total_working_days from uploaded attendance data (use MAX in case of multiple records)
            uploaded_working_days=models.Max('total_working_days', output_field=IntegerField())
        )
        
        # Convert to dictionary for fast lookup and get list of employees with attendance
        attendance_dict = {
            item['employee_id']: {
                'present_days': float(item['total_present'] or 0),
                'absent_days': float(item['total_absent'] or 0),
                'ot_hours': float(item['total_ot_hours'] or 0),
                'late_minutes': int(item['total_late_minutes'] or 0),
                'uploaded_working_days': int(item['uploaded_working_days'] or 0)
            }
            for item in attendance_summary
        }
        
        # FIXED: Only include employees who have attendance data for this period
        employees_with_attendance_ids = list(attendance_dict.keys())
        
        if not employees_with_attendance_ids:
            logger.info(f"No employees with attendance data for {month_name_upper} {year}")
            return Response({
                'success': True,
                'payroll_data': [],
                'summary': {
                    'total_employees': 0,
                    'working_days': working_days,
                    'month_year': f"{calendar.month_name[month_num]} {year}",
                    'total_base_salary': 0,
                    'total_gross_salary': 0,
                    'total_net_salary': 0,
                    'message': 'No employees with attendance data for this period'
                }
            })
        
        logger.info(f"Attendance data aggregated for {len(attendance_dict)} employees with attendance")
        
        # Filter employees to only those with attendance
        employees = employees.filter(employee_id__in=employees_with_attendance_ids)
        
        # OPTIMIZATION 3: Bulk fetch all advance deductions (only for employees with attendance)
        month_year_string = f"{calendar.month_name[month_num]} {year}"
        advance_summary = AdvanceLedger.objects.filter(
            tenant=tenant,
            employee_id__in=employees_with_attendance_ids,
            for_month__icontains=month_year_string,
            status__in=['PENDING', 'PARTIALLY_PAID']
        ).values('employee_id').annotate(
            total_advance=Sum('remaining_balance', output_field=DecimalField(max_digits=12, decimal_places=2))
        )
        
        # Convert to dictionary for fast lookup
        advance_dict = {
            item['employee_id']: float(item['total_advance'] or 0)
            for item in advance_summary
        }
        
        # OPTIMIZATION 3.5: Get total advance balance for each employee (all pending advances)
        total_advance_summary = AdvanceLedger.objects.filter(
            tenant=tenant,
            employee_id__in=employees_with_attendance_ids,
            status__in=['PENDING', 'PARTIALLY_PAID']
        ).values('employee_id').annotate(
            total_balance=Sum('remaining_balance', output_field=DecimalField(max_digits=12, decimal_places=2))
        )
        
        # Convert to dictionary for fast lookup
        total_advance_dict = {
            item['employee_id']: float(item['total_balance'] or 0)
            for item in total_advance_summary
        }
        
        logger.info(f"Advance deductions aggregated for {len(advance_dict)} employees")
        
        # OPTIMIZATION 4: Process only employees with attendance data
        payroll_data = []
        total_base_salary = 0
        total_gross_salary = 0
        total_net_salary = 0
        
        from ..services.salary_service import SalaryCalculationService
        
        for employee in employees:
            # Get attendance data (employee should have attendance since we filtered above)
            attendance = attendance_dict.get(employee.employee_id)
            
            # Skip if no attendance data (shouldn't happen due to filtering, but safety check)
            if not attendance:
                logger.warning(f"Skipping employee {employee.employee_id} - no attendance data found")
                continue
            
            # FIXED: Use uploaded working days from attendance data if available, otherwise calculate
            # This ensures that Excel-uploaded working days are preserved during payroll calculation
            uploaded_working_days = attendance.get('uploaded_working_days', 0)
            if uploaded_working_days and uploaded_working_days > 0:
                # Use the uploaded working days from Excel
                employee_working_days = uploaded_working_days
            else:
                # Fallback: SMART CALCULATION with DOJ awareness
                # - Joining month: Calculates actual days from DOJ to month end
                # - Other months: Uses standard 30 days
                employee_working_days = SalaryCalculationService._calculate_employee_working_days(
                    employee, year, month_name_upper
                )
            
            # Get advance deductions (default to 0)
            advance_deductions = advance_dict.get(employee.employee_id, 0.0)
            total_advance_balance = total_advance_dict.get(employee.employee_id, 0.0)
            
            # Basic calculations
            base_salary = float(employee.basic_salary or 0)
            present_days = attendance['present_days']
            ot_hours = attendance['ot_hours']
            late_minutes = attendance['late_minutes']
            
            # Standardized Gross Salary calculation:
            # Gross Salary = (Base Salary ÷ Working Days × Present Days) + OT Charges - Late Deduction
            if employee_working_days > 0:
                daily_rate = base_salary / employee_working_days
                salary_for_present_days = daily_rate * present_days
            else:
                salary_for_present_days = 0
            
            # Calculate OT rate using STATIC formula
            # Formula: OT Charge per Hour = basic_salary / (shift_hours × 30.4)
            from datetime import datetime, timedelta
            shift_hours_per_day = 0
            if employee.shift_start_time and employee.shift_end_time:
                start_dt = datetime.combine(datetime.today().date(), employee.shift_start_time)
                end_dt = datetime.combine(datetime.today().date(), employee.shift_end_time)
                # Handle overnight shifts
                if end_dt <= start_dt:
                    end_dt += timedelta(days=1)
                shift_hours_per_day = (end_dt - start_dt).total_seconds() / 3600
            else:
                # Fallback to 8 hours if shift times not set
                shift_hours_per_day = 8
            
            # Calculate OT rate using STATIC 30.4 days
            static_days = 30.4  # Average days per month
            if shift_hours_per_day > 0 and base_salary > 0:
                ot_rate = base_salary / (shift_hours_per_day * static_days)
            else:
                ot_rate = 0
            
            # Calculate overtime charges
            ot_charges = ot_hours * ot_rate
            
            # Calculate late deduction using standardized approach
            late_charge_per_minute = ot_rate / 60 if ot_rate > 0 else 0
            late_deduction = late_minutes * late_charge_per_minute
            
            # Apply standardized gross salary formula
            gross_salary = salary_for_present_days + ot_charges - late_deduction
            
            # Calculate TDS (use employee-specific TDS or 0%)
            tds_percentage = float(employee.tds_percentage or 0)
            tds_amount = (gross_salary * tds_percentage) / 100
            salary_after_tds = gross_salary - tds_amount
            
            # Final net salary
            net_salary = salary_after_tds - advance_deductions
            
            # Calculate remaining advance balance
            remaining_advance_balance = total_advance_balance - advance_deductions
            
            # Round values for response
            gross_salary_rounded = round(gross_salary, 2)
            ot_charges_rounded = round(ot_charges, 2)
            late_deduction_rounded = round(late_deduction, 2)
            tds_amount_rounded = round(tds_amount, 2)
            net_salary_rounded = round(net_salary, 2)
            
            # Get paid holidays count for this employee
            from ..models import Holiday
            holiday_dates = SalaryCalculationService._get_employee_holidays_in_period(
                tenant, employee, year, month_name_upper
            )
            holiday_count = len(holiday_dates)
            
            # Calculate off days for this employee in the month
            off_day_flags = [
                employee.off_monday, employee.off_tuesday, employee.off_wednesday,
                employee.off_thursday, employee.off_friday, employee.off_saturday, employee.off_sunday
            ]
            off_days_count = 0
            for day_num in range(1, total_days_in_month + 1):
                day_date = datetime(year, month_num, day_num).date()
                # Skip if before DOJ
                if employee.date_of_joining and day_date < employee.date_of_joining:
                    continue
                day_of_week = day_date.weekday()  # Monday = 0, Sunday = 6
                if off_day_flags[day_of_week]:
                    off_days_count += 1
            
            payroll_data.append({
                'employee_id': employee.employee_id,
                'employee_name': f"{employee.first_name} {employee.last_name}",
                'department': employee.department or 'N/A',
                'base_salary': base_salary,
                'total_days': total_days_in_month,  # Total days in the month
                'working_days': employee_working_days,
                'present_days': present_days,
                'absent_days': attendance['absent_days'],
                'off_days': off_days_count,  # Add off days count
                'holiday_days': holiday_count,  # Add holidays count
                'ot_hours': ot_hours,
                'late_minutes': late_minutes,
                'gross_salary': gross_salary_rounded,
                'ot_charges': ot_charges_rounded,
                'late_deduction': late_deduction_rounded,
                'tds_percentage': tds_percentage,
                'tds_amount': tds_amount_rounded,
                'total_advance_balance': total_advance_balance,
                'advance_deduction': advance_deductions,
                'remaining_balance': remaining_advance_balance,
                'net_salary': net_salary_rounded,
                'is_paid': False,  # Default to unpaid
                'editable': True   # Allow editing
            })
            
            # Accumulate totals
            total_base_salary += base_salary
            total_gross_salary += gross_salary_rounded
            total_net_salary += net_salary_rounded
        
        end_time = time.time()
        calculation_time = round(end_time - start_time, 2)
        logger.info(f"Payroll calculation completed in {calculation_time} seconds for {len(payroll_data)} employees")
        
        return Response({
            'success': True,
            'payroll_data': payroll_data,
            'summary': {
                'total_employees': len(payroll_data),
                'total_days': total_days_in_month,  # Total days in the month
                'working_days': working_days,
                'month_year': f"{calendar.month_name[month_num]} {year}",
                'total_base_salary': round(total_base_salary, 2),
                'total_gross_salary': round(total_gross_salary, 2),
                'total_net_salary': round(total_net_salary, 2),
                'calculation_time_seconds': calculation_time
            }
        })
        
    except Exception as e:
        logger.error(f"Error in calculate_simple_payroll: {str(e)}")
        return Response({"error": f"Calculation failed: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_payroll_entry(request):
    """
    Update individual payroll entry (edit net salary, deductions, etc.)
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        employee_id = request.data.get('employee_id')
        updates = request.data.get('updates', {})
        
        if not employee_id:
            return Response({"error": "Employee ID is required"}, status=400)
        
        # For now, just return success - in a real implementation,
        # you might store these updates in a temporary payroll table
        return Response({
            'success': True,
            'message': f'Payroll updated for employee {employee_id}',
            'updates': updates
        })
        
    except Exception as e:
        logger.error(f"Error in update_payroll_entry: {str(e)}")
        return Response({"error": f"Update failed: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_payroll_paid(request):
    """
    Mark payroll entries as paid (individual or bulk)
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        employee_ids = request.data.get('employee_ids', [])
        mark_all = request.data.get('mark_all', False)
        
        if mark_all:
            message = "All employees marked as paid"
        else:
            message = f"{len(employee_ids)} employees marked as paid"
        
        # CLEAR CACHE: Invalidate payroll overview cache when payment status changes
        from excel_data.services.cache_service import invalidate_payroll_payment_caches
        
        cache_result = invalidate_payroll_payment_caches(
            tenant=tenant, 
            reason="payroll_payment_marked"
        )
        
        if cache_result['success']:
            logger.info(f"Cache invalidation successful: {cache_result['cleared_count']} keys cleared")
        else:
            logger.warning(f"Cache invalidation failed: {cache_result.get('error', 'Unknown error')}")
        
        # For now, just return success - in a real implementation,
        # you might update payment status in the database
        return Response({
            'success': True,
            'message': message,
            'employee_ids': employee_ids,
            'cache_cleared': cache_result['success'],
            'cache_invalidation': {
                'success': cache_result['success'],
                'cleared_count': cache_result.get('cleared_count', 0),
                'reason': cache_result.get('reason', 'payroll_payment_marked')
            }
        })
        
    except Exception as e:
        logger.error(f"Error in mark_payroll_paid: {str(e)}")
        return Response({"error": f"Mark paid failed: {str(e)}"}, status=500)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def auto_payroll_settings(request):
    """
    Get or update auto payroll calculation settings
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        if request.method == 'GET':
            return Response({
                'success': True,
                'auto_calculate_payroll': tenant.auto_calculate_payroll,
                'tenant_name': tenant.name
            })
        
        elif request.method == 'POST':
            auto_calculate = request.data.get('auto_calculate_payroll')
            if auto_calculate is None:
                return Response({"error": "auto_calculate_payroll field is required"}, status=400)
            
            tenant.auto_calculate_payroll = bool(auto_calculate)
            tenant.save()
            
            return Response({
                'success': True,
                'message': f'Auto payroll calculation {"enabled" if tenant.auto_calculate_payroll else "disabled"}',
                'auto_calculate_payroll': tenant.auto_calculate_payroll
            })
            
    except Exception as e:
        logger.error(f"Error in auto_payroll_settings: {str(e)}")
        return Response({"error": f"Settings update failed: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def manual_calculate_payroll(request):
    """
    Manually calculate payroll for a specific month/year
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        data = request.data
        year = data.get('year')
        month = data.get('month')
        
        if not year or not month:
            return Response({"error": "Year and month are required"}, status=400)
        
        # Validate year and month
        try:
            year = int(year)
            month = str(month).upper()
        except (ValueError, TypeError):
            return Response({"error": "Invalid year or month format"}, status=400)
        
        # Calculate payroll
        results = SalaryCalculationService.calculate_salary_for_period(
            tenant, year, month, force_recalculate=True
        )
        # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
        from django.core.cache import cache
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")
        
        return Response({
            'success': True,
            'message': f'Payroll calculated successfully for {month} {year}',
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Error in manual_calculate_payroll: {str(e)}")
        return Response({"error": f"Calculation failed: {str(e)}"}, status=500)

# Add a new super-optimized payroll calculation function after the existing one
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_simple_payroll_ultra_fast(request):
    """
    TRULY optimized payroll - should complete in under 5 seconds for 1000+ employees
    Key optimizations:
    1. All calculations in SQL (no Python loops with DB calls)
    2. Pre-calculated working days stored in temp table
    3. Bulk holiday lookup
    4. Minimal post-processing
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        from django.db import connection, transaction
        import calendar
        import time
        from datetime import date, timedelta
        
        start_time = time.time()
        logger.info("Starting ultra-fast payroll calculation")
        
        # Validate inputs
        year = request.data.get('year')
        month = request.data.get('month')
        
        if not year or not month:
            return Response({"error": "Year and month are required"}, status=400)
        
        try:
            year = int(year)
            if isinstance(month, str):
                month_num = list(calendar.month_name).index(month.title())
            else:
                month_num = int(month)
            
            if not (1 <= month_num <= 12):
                return Response({"error": f"Invalid month: {month_num}"}, status=400)
        except (ValueError, TypeError, IndexError) as e:
            return Response({"error": f"Invalid year or month: {str(e)}"}, status=400)
        
        total_days_in_month = calendar.monthrange(year, month_num)[1]
        month_name = calendar.month_name[month_num]
        month_year_string = f"{month_name} {year}"
        
        # Pre-calculate working days and holidays for ALL employees in Python (ONE TIME)
        # This is faster than doing it per-employee in the loop
        from ..models import EmployeeProfile, Holiday
        
        calc_start = time.time()
        
        # Get all active employees with necessary fields
        employees = list(EmployeeProfile.objects.filter(
            tenant=tenant, 
            is_active=True
        ).values(
            'employee_id', 'date_of_joining',
            'off_monday', 'off_tuesday', 'off_wednesday', 'off_thursday',
            'off_friday', 'off_saturday', 'off_sunday'
        ))
        
        logger.info(f"Loaded {len(employees)} employees in {time.time() - calc_start:.2f}s")
        
        # Pre-calculate working days and off days for each employee (holidays now handled in SQL)
        working_days_start = time.time()
        employee_working_days_map = {}
        employee_off_days_map = {}
        
        # Generate all dates in the month once
        first_day = date(year, month_num, 1)
        month_dates = [first_day + timedelta(days=i) for i in range(total_days_in_month)]
        
        # Day of week mapping
        off_day_map = {
            0: 'off_monday',
            1: 'off_tuesday', 
            2: 'off_wednesday',
            3: 'off_thursday',
            4: 'off_friday',
            5: 'off_saturday',
            6: 'off_sunday'
        }
        
        for emp in employees:
            employee_id = emp['employee_id']
            doj = emp.get('date_of_joining')
            
            # Count working days and off days for this employee
            working_days = 0
            off_days_count = 0
            
            for day_date in month_dates:
                # Skip if before DOJ
                if doj and day_date < doj:
                    continue
                
                # Check if it's the employee's off day
                day_of_week = day_date.weekday()
                off_day_field = off_day_map[day_of_week]
                is_off_day = emp.get(off_day_field, False)
                
                if is_off_day:
                    off_days_count += 1
                else:
                    working_days += 1
            
            employee_working_days_map[employee_id] = working_days if working_days > 0 else 30
            employee_off_days_map[employee_id] = off_days_count
        
        logger.info(f"Calculated working days for all employees in {time.time() - working_days_start:.2f}s")
        
        # Now run the optimized SQL query
        sql_start = time.time()
        with connection.cursor() as cursor:
            sql = """
            WITH 
            -- Calculate shift hours once
            employee_shifts AS (
                SELECT 
                    employee_id,
                    CASE 
                        WHEN shift_start_time IS NOT NULL AND shift_end_time IS NOT NULL THEN
                            CASE 
                                WHEN shift_end_time <= shift_start_time THEN
                                    EXTRACT(EPOCH FROM (
                                        shift_end_time::time - '00:00:00'::time + 
                                        ('24:00:00'::time - shift_start_time::time)
                                    )) / 3600.0
                                ELSE
                                    EXTRACT(EPOCH FROM (shift_end_time::time - shift_start_time::time)) / 3600.0
                            END
                        ELSE 8.0
                    END as shift_hours
                FROM excel_data_employeeprofile
                WHERE tenant_id = %s AND is_active = true
            ),
            -- Calculate OT rate once
            ot_rates AS (
                SELECT 
                    e.employee_id,
                    CASE 
                        WHEN es.shift_hours * 30.4 > 0 AND COALESCE(e.basic_salary, 0) > 0 
                        THEN e.basic_salary / (es.shift_hours * 30.4)
                        ELSE 0
                    END as ot_rate_per_hour
                FROM excel_data_employeeprofile e
                INNER JOIN employee_shifts es ON e.employee_id = es.employee_id
                WHERE e.tenant_id = %s AND e.is_active = true
            ),
            -- Aggregate attendance
            attendance_summary AS (
                SELECT 
                    employee_id,
                    SUM(COALESCE(present_days, 0)) as present_days,
                    SUM(COALESCE(absent_days, 0)) as absent_days,
                    SUM(COALESCE(ot_hours, 0)) as ot_hours,
                    SUM(COALESCE(late_minutes, 0)) as late_minutes,
                    MAX(COALESCE(total_working_days, 0)) as uploaded_working_days,
                    MAX(COALESCE(holiday_days, 0)) as holiday_days
                FROM excel_data_attendance 
                WHERE tenant_id = %s 
                    AND EXTRACT(YEAR FROM date) = %s 
                    AND EXTRACT(MONTH FROM date) = %s
                GROUP BY employee_id
                HAVING SUM(COALESCE(present_days, 0)) > 0 OR SUM(COALESCE(absent_days, 0)) > 0
            ),
            -- Calculate holidays for each employee in this month (respecting DOJ and off days)
            employee_holidays AS (
                SELECT 
                    e.employee_id,
                    COUNT(DISTINCT h.date) as holiday_count
                FROM excel_data_employeeprofile e
                LEFT JOIN holidays h ON h.tenant_id = e.tenant_id
                    AND h.is_active = true
                    AND EXTRACT(YEAR FROM h.date) = %s
                    AND EXTRACT(MONTH FROM h.date) = %s
                    AND (
                        e.date_of_joining IS NULL 
                        OR h.date >= e.date_of_joining
                    )
                    AND (
                        h.applies_to_all = true
                        OR (
                            h.specific_departments IS NOT NULL 
                            AND e.department = ANY(string_to_array(h.specific_departments, ','))
                        )
                    )
                    -- Exclude holidays that fall on employee's off days
                    AND NOT (
                        (EXTRACT(DOW FROM h.date) = 1 AND e.off_monday = true) OR
                        (EXTRACT(DOW FROM h.date) = 2 AND e.off_tuesday = true) OR
                        (EXTRACT(DOW FROM h.date) = 3 AND e.off_wednesday = true) OR
                        (EXTRACT(DOW FROM h.date) = 4 AND e.off_thursday = true) OR
                        (EXTRACT(DOW FROM h.date) = 5 AND e.off_friday = true) OR
                        (EXTRACT(DOW FROM h.date) = 6 AND e.off_saturday = true) OR
                        (EXTRACT(DOW FROM h.date) = 0 AND e.off_sunday = true)
                    )
                WHERE e.tenant_id = %s AND e.is_active = true
                GROUP BY e.employee_id
            ),
            -- Total advances (all pending)
            total_advances AS (
                SELECT 
                    employee_id,
                    SUM(COALESCE(remaining_balance, 0)) as total_advance
                FROM excel_data_advanceledger 
                WHERE tenant_id = %s 
                    AND status IN ('PENDING', 'PARTIALLY_PAID')
                GROUP BY employee_id
            )
            SELECT 
                e.employee_id,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                COALESCE(e.department, 'N/A') as department,
                COALESCE(e.basic_salary, 0) as base_salary,
                COALESCE(e.tds_percentage, 0) as tds_percentage,
                
                -- Shift and rates
                es.shift_hours as shift_hours_per_day,
                otr.ot_rate_per_hour as ot_rate,
                
                -- Attendance (with holidays added to present days)
                att.present_days as raw_present_days,
                att.present_days + COALESCE(eh.holiday_count, 0) as present_days,
                COALESCE(eh.holiday_count, 0) as holiday_days,
                att.absent_days,
                att.ot_hours,
                att.late_minutes,
                att.uploaded_working_days,
                
                -- Pre-calculated charges
                att.ot_hours * otr.ot_rate_per_hour as ot_charges,
                att.late_minutes * (otr.ot_rate_per_hour / 60.0) as late_deduction,
                
                -- Advances
                COALESCE(ta.total_advance, 0) as total_advance_balance
                
            FROM excel_data_employeeprofile e
            INNER JOIN employee_shifts es ON e.employee_id = es.employee_id
            INNER JOIN ot_rates otr ON e.employee_id = otr.employee_id
            INNER JOIN attendance_summary att ON e.employee_id = att.employee_id
            LEFT JOIN employee_holidays eh ON e.employee_id = eh.employee_id
            LEFT JOIN total_advances ta ON e.employee_id = ta.employee_id
            
            WHERE e.tenant_id = %s 
                AND e.is_active = true
            ORDER BY e.first_name, e.last_name
            """
            
            params = [
                tenant.id,  # employee_shifts
                tenant.id,  # ot_rates
                tenant.id, year, month_num,  # attendance_summary
                year, month_num, tenant.id,  # employee_holidays
                tenant.id,  # total_advances
                tenant.id   # main WHERE
            ]
            
            cursor.execute(sql, params)
            columns = [col[0] for col in cursor.description]
            raw_results = cursor.fetchall()
        
        logger.info(f"SQL query completed in {time.time() - sql_start:.2f}s, returned {len(raw_results)} rows")
        
        # Fast post-processing (no DB calls in loop!)
        process_start = time.time()
        payroll_data = []
        total_base_salary = 0
        total_gross_salary = 0
        total_net_salary = 0
        
        for row in raw_results:
            data = dict(zip(columns, row))
            employee_id = data['employee_id']
            
            # Get pre-calculated values
            base_salary = float(data['base_salary'] or 0)
            raw_present_days = float(data['raw_present_days'] or 0)
            present_days = float(data['present_days'] or 0)  # Includes holidays
            ot_charges = float(data['ot_charges'] or 0)
            late_deduction = float(data['late_deduction'] or 0)
            ot_rate = float(data['ot_rate'] or 0)
            
            # Use pre-calculated working days (NO DATABASE CALL!)
            uploaded_working_days = int(data['uploaded_working_days'] or 0)
            if uploaded_working_days > 0:
                employee_working_days = uploaded_working_days
            else:
                employee_working_days = employee_working_days_map.get(employee_id, 30)
            
            # Get holiday count from SQL and off days count from Python calculation
            holiday_count = int(data['holiday_days'] or 0)
            off_days_count = employee_off_days_map.get(employee_id, 0)
            
            # Calculate paid_days using SQL-calculated holiday count (respects DOJ, dept, and off days)
            paid_days = raw_present_days + holiday_count
            
            # Calculate gross salary using 30.4 (average days per month)
            daily_rate = base_salary / 30.4
            gross_salary = (
                (daily_rate * paid_days) + 
                ot_charges - 
                late_deduction
            )
            
            # TDS
            tds_percentage = float(data['tds_percentage'] or 0)
            tds_amount = (gross_salary * tds_percentage) / 100
            salary_after_tds = gross_salary - tds_amount
            
            # Smart advance deduction
            total_advance_balance = float(data['total_advance_balance'] or 0)
            max_deductible = max(0, salary_after_tds)
            actual_advance_deduction = min(total_advance_balance, max_deductible)
            net_salary = max(0, salary_after_tds - actual_advance_deduction)
            remaining_advance = total_advance_balance - actual_advance_deduction
            
            payroll_data.append({
                'employee_id': employee_id,
                'employee_name': data['employee_name'],
                'department': data['department'],
                'base_salary': round(base_salary, 2),
                'total_days': total_days_in_month,  # Total days in the month
                'working_days': employee_working_days,
                'raw_present_days': int(raw_present_days),  # Present without holidays
                'paid_days': int(paid_days),  # Present + holidays (respects DOJ)
                'present_days': int(paid_days),  # For backward compatibility (now same as paid_days)
                'absent_days': int(data['absent_days'] or 0),
                'off_days': off_days_count,  # Add off days count
                'holiday_days': holiday_count,
                'ot_hours': float(data['ot_hours'] or 0),
                'late_minutes': int(data['late_minutes'] or 0),
                'gross_salary': round(gross_salary, 2),
                'ot_charges': round(ot_charges, 2),
                'late_deduction': round(late_deduction, 2),
                'ot_rate': round(ot_rate, 2),
                'tds_percentage': tds_percentage,
                'tds_amount': round(tds_amount, 2),
                'total_advance_balance': round(total_advance_balance, 2),
                'advance_deduction': round(actual_advance_deduction, 2),
                'remaining_balance': round(remaining_advance, 2),
                'net_salary': round(net_salary, 2),
                'is_paid': False,
                'editable': True
            })
            
            total_base_salary += base_salary
            total_gross_salary += gross_salary
            total_net_salary += net_salary
        
        logger.info(f"Post-processing completed in {time.time() - process_start:.2f}s")
        
        calculation_time = round(time.time() - start_time, 2)
        logger.info(f"TOTAL payroll calculation: {calculation_time}s for {len(payroll_data)} employees")
        
        return Response({
            'success': True,
            'payroll_data': payroll_data,
            'summary': {
                'total_employees': len(payroll_data),
                'total_days': total_days_in_month,  # Total days in the month
                'working_days': total_days_in_month,
                'month_year': month_year_string,
                'total_base_salary': round(total_base_salary, 2),
                'total_gross_salary': round(total_gross_salary, 2),
                'total_net_salary': round(total_net_salary, 2),
                'calculation_time_seconds': calculation_time,
                'optimization_level': 'ultra_fast_v2'
            }
        })
        
    except Exception as e:
        import traceback
        logger.error(f"Payroll error: {str(e)}\n{traceback.format_exc()}")
        return Response({"error": f"Calculation failed: {str(e)}"}, status=500)
    
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_payroll_period_direct(request):
    """
    Save payroll period directly with the provided data (no recalculation)
    This preserves any manual edits made to advance deductions or other fields
    """
    def clean_null_bytes(data):
        """Recursively clean null bytes from strings in the data"""
        if isinstance(data, str):
            return data.replace('\x00', '')
        elif isinstance(data, dict):
            return {clean_null_bytes(key): clean_null_bytes(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [clean_null_bytes(item) for item in data]
        else:
            return data
    
    def clean_null_bytes_from_instance(instance):
        """Clean null bytes from all CharField and TextField values in a model instance"""
        from django.db import models
        
        for field in instance._meta.fields:
            if isinstance(field, (models.CharField, models.TextField)):
                value = getattr(instance, field.name)
                if isinstance(value, str) and '\x00' in value:
                    setattr(instance, field.name, value.replace('\x00', ''))
    
    try:
        from time import perf_counter
        from django.db import transaction
        t0 = perf_counter()
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        from ..models import PayrollPeriod, CalculatedSalary
        import calendar
        
        # Get request data and clean null bytes
        year = request.data.get('year')
        month = request.data.get('month')
        payroll_entries = request.data.get('payroll_entries', [])
        
        # Clean null bytes from all input data
        year = clean_null_bytes(year)
        month = clean_null_bytes(month)
        payroll_entries = clean_null_bytes(payroll_entries)
        
        if not year or not month or not payroll_entries:
            return Response({"error": "Year, month, and payroll_entries are required"}, status=400)
        
        try:
            year = int(year)
            if isinstance(month, str):
                # Handle both month name and number
                if month.isdigit():
                    month_num = int(month)
                    month_name = calendar.month_name[month_num].upper()
                else:
                    month_name = month.upper()
                    month_num = list(calendar.month_name).index(month.title())
            else:
                month_num = int(month)
                month_name = calendar.month_name[month_num].upper()
        except (ValueError, TypeError, IndexError):
            return Response({"error": "Invalid year or month format"}, status=400)
        
        # FIXED: Normalize month to short format (JAN, FEB, etc.) to match SalaryData format
        from ..services.salary_service import SalaryCalculationService
        month_normalized = SalaryCalculationService._normalize_month_to_short(month_name)
        
        # Use a single transaction for the whole write path to reduce overhead
        with transaction.atomic():
            t1 = perf_counter()
            # Create or get payroll period
            payroll_period, created = PayrollPeriod.objects.get_or_create(
                tenant=tenant,
                year=year,
                month=month_normalized,  # Use normalized short format
                defaults={
                    'data_source': 'FRONTEND',
                    'working_days_in_month': payroll_entries[0].get('working_days', 25) if payroll_entries else 25,
                }
            )
            t2 = perf_counter()

            # Fetch existing salaries once and map by employee_id
            fetch_existing_start = perf_counter()
            existing_list = list(CalculatedSalary.objects.filter(
                tenant=tenant,
                payroll_period=payroll_period
            ))
            existing_map = {cs.employee_id: cs for cs in existing_list}
            fetch_existing_end = perf_counter()

            payload_emp_ids = []
            to_create: list[CalculatedSalary] = []
            to_update: list[CalculatedSalary] = []

            # Build new/updated objects
            build_start = perf_counter()
            for entry in payroll_entries:
                emp_id = entry.get('employee_id')
                payload_emp_ids.append(emp_id)

                # Compute fields once
                base_salary = entry.get('base_salary', 0)
                working_days = entry.get('working_days', 0)
                present_days = entry.get('present_days', 0)
                absent_days = entry.get('absent_days', 0)
                ot_hours = entry.get('ot_hours', 0)
                late_minutes = entry.get('late_minutes', 0)
                gross_salary = entry.get('gross_salary', 0)
                ot_charges = entry.get('ot_charges', 0)
                late_deduction = entry.get('late_deduction', 0)
                tds_amount = entry.get('tds_amount', 0)
                total_advance_balance = entry.get('total_advance_balance', 0)
                advance_deduction = entry.get('advance_deduction', 0)
                remaining_balance = entry.get('remaining_balance', 0)
                net_salary = entry.get('net_salary', 0)
                tds_percentage = entry.get('tds_percentage', 0)
                is_paid = entry.get('is_paid', False)

                if emp_id in existing_map:
                    cs = existing_map[emp_id]
                    cs.employee_name = entry.get('employee_name')
                    cs.department = entry.get('department')
                    cs.basic_salary = base_salary
                    cs.basic_salary_per_hour = 0
                    cs.basic_salary_per_minute = 0
                    cs.employee_ot_rate = 0
                    cs.employee_tds_rate = tds_percentage
                    cs.total_working_days = working_days
                    cs.present_days = present_days
                    cs.absent_days = absent_days
                    cs.ot_hours = ot_hours
                    cs.late_minutes = late_minutes
                    cs.salary_for_present_days = gross_salary
                    cs.ot_charges = ot_charges
                    cs.late_deduction = late_deduction
                    cs.incentive = 0
                    cs.gross_salary = gross_salary + ot_charges - late_deduction
                    cs.tds_amount = tds_amount
                    cs.salary_after_tds = gross_salary + ot_charges - late_deduction - tds_amount
                    cs.total_advance_balance = total_advance_balance
                    cs.advance_deduction_amount = advance_deduction
                    cs.advance_deduction_editable = True
                    cs.remaining_advance_balance = remaining_balance
                    cs.net_payable = net_salary
                    cs.data_source = 'FRONTEND'
                    cs.is_paid = is_paid
                    to_update.append(cs)
                else:
                    to_create.append(CalculatedSalary(
                        tenant=tenant,
                        payroll_period=payroll_period,
                        employee_id=emp_id,
                        employee_name=entry.get('employee_name'),
                        department=entry.get('department'),
                        basic_salary=base_salary,
                        basic_salary_per_hour=0,
                        basic_salary_per_minute=0,
                        employee_ot_rate=0,
                        employee_tds_rate=tds_percentage,
                        total_working_days=working_days,
                        present_days=present_days,
                        absent_days=absent_days,
                        ot_hours=ot_hours,
                        late_minutes=late_minutes,
                        salary_for_present_days=gross_salary,
                        ot_charges=ot_charges,
                        late_deduction=late_deduction,
                        incentive=0,
                        gross_salary=gross_salary + ot_charges - late_deduction,
                        tds_amount=tds_amount,
                        salary_after_tds=gross_salary + ot_charges - late_deduction - tds_amount,
                        total_advance_balance=total_advance_balance,
                        advance_deduction_amount=advance_deduction,
                        advance_deduction_editable=True,
                        remaining_advance_balance=remaining_balance,
                        net_payable=net_salary,
                        data_source='FRONTEND',
                        is_paid=is_paid,
                    ))
            build_end = perf_counter()

            # Delete only those not present in payload (if any)
            delete_missing_start = perf_counter()
            missing_emp_ids = [eid for eid in existing_map.keys() if eid not in payload_emp_ids]
            deleted_missing_count = 0
            if missing_emp_ids:
                deleted_missing_count = CalculatedSalary.objects.filter(
                    tenant=tenant,
                    payroll_period=payroll_period,
                    employee_id__in=missing_emp_ids
                ).delete()[0]
            delete_missing_end = perf_counter()

            # Bulk update and bulk create with batch sizes
            update_start = perf_counter()
            updated_count = 0
            if to_update:
                # Clean null bytes from instances before bulk_update (pre_save signals not triggered for bulk operations)
                for instance in to_update:
                    clean_null_bytes_from_instance(instance)
                CalculatedSalary.objects.bulk_update(
                    to_update,
                    fields=[
                        'employee_name','department','basic_salary','basic_salary_per_hour','basic_salary_per_minute',
                        'employee_ot_rate','employee_tds_rate','total_working_days','present_days','absent_days',
                        'ot_hours','late_minutes','salary_for_present_days','ot_charges','late_deduction','incentive',
                        'gross_salary','tds_amount','salary_after_tds','total_advance_balance','advance_deduction_amount',
                        'advance_deduction_editable','remaining_advance_balance','net_payable','data_source','is_paid'
                    ],
                    batch_size=1000
                )
                updated_count = len(to_update)
            update_end = perf_counter()

            create_start = perf_counter()
            created_count = 0
            if to_create:
                # Clean null bytes from instances before bulk_create (pre_save signals not triggered for bulk operations)
                for instance in to_create:
                    clean_null_bytes_from_instance(instance)
                CalculatedSalary.objects.bulk_create(to_create, batch_size=1000)
                created_count = len(to_create)
            create_end = perf_counter()

        # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
        from excel_data.services.cache_service import invalidate_payroll_caches_comprehensive
        
        cache_result = invalidate_payroll_caches_comprehensive(
            tenant=tenant, 
            reason="payroll_period_data_saved"
        )
        
        if cache_result['success']:
            logger.info(f"Cache invalidation successful: {cache_result['cleared_count']} keys cleared")
        else:
            logger.warning(f"Cache invalidation failed: {cache_result.get('error', 'Unknown error')}")

        # ✨ BACKGROUND SYNC: Aggregate chart data in background (Celery/thread)
        bg_start = perf_counter()
        from excel_data.utils.chart_sync import sync_chart_data_batch_async
        sync_chart_data_batch_async(tenant, year, month_name, source='frontend')
        bg_end = perf_counter()

        t_end = perf_counter()
        timing_msg = (
            "[save_payroll_period_direct] entries=%d created_period=%s | "
            "get_or_create=%.3fs | fetch_existing=%.3fs | build=%.3fs | "
            "delete_missing(count=%d)=%.3fs | bulk_update(count=%d)=%.3fs | bulk_create(count=%d)=%.3fs | "
            "background_kick=%.3fs | total=%.3fs"
        ) % (
            len(payroll_entries), created,
            (t2 - t1), (fetch_existing_end - fetch_existing_start), (build_end - build_start),
            deleted_missing_count, (delete_missing_end - delete_missing_start),
            updated_count, (update_end - update_start),
            created_count, (create_end - create_start),
            (bg_end - bg_start), (t_end - t0)
        )
        logger.info(timing_msg)
        print(timing_msg.replace('\x00', '[NUL]'))  # Clean null bytes before printing

        summary_msg = (
            f"Saved payroll period {month_name} {year}: updated={updated_count}, created={created_count}, deleted_missing={deleted_missing_count}"
        )
        logger.info(summary_msg)
        print(summary_msg.replace('\x00', '[NUL]'))  # Clean null bytes before printing
        
        return Response({
            'success': True,
            'message': f'Payroll period saved successfully for {month_name} {year}',
            'payroll_period_id': payroll_period.id,
            'saved_entries': (created_count + updated_count)
        })
        
    except Exception as e:
        # SECURITY: Don't expose internal error details to client
        logger.error(f"Error in save_payroll_period_direct: {str(e)}", exc_info=True)
        return Response({"error": "Failed to save payroll period. Please try again."}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_update_payroll_period(request, period_id):
    """
    Bulk-update payment status and advance deductions for all
    entries in a payroll period.
    Expected payload:
    { "entries": [
        { "employee_id": "...", "is_paid": true/false,
          "advance_deduction_amount": "123.45" }
      ] }
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)

        entries = request.data.get('entries', [])
        if not entries:
            return Response({"error": "entries list is required"}, status=400)

        # Validate that the period exists and belongs to this tenant
        try:
            payroll_period = PayrollPeriod.objects.get(id=period_id, tenant=tenant)
        except PayrollPeriod.DoesNotExist:
            return Response({"error": "Payroll period not found"}, status=404)

        # Fetch all salaries for the period in one query
        employee_ids = [e.get("employee_id") for e in entries if e.get("employee_id")]
        if not employee_ids:
            return Response({"error": "No valid employee IDs provided"}, status=400)

        salary_map = {
            s.employee_id: s for s in
            CalculatedSalary.objects.filter(
                tenant=tenant, 
                payroll_period_id=period_id,
                employee_id__in=employee_ids
            )
        }

        if not salary_map:
            return Response({"error": "No calculated salaries found for the provided employees"}, status=404)

        # Process updates
        salaries_to_update = []
        advance_deductions_processed = {}
        
        for entry in entries:
            employee_id = entry.get("employee_id")
            if not employee_id:
                continue
                
            salary = salary_map.get(employee_id)
            if not salary:
                logger.warning(f"Salary not found for employee {employee_id} in period {period_id}")
                continue

            # Update payment status
            if "is_paid" in entry:
                salary.is_paid = bool(entry["is_paid"])
                salary.payment_date = timezone.now().date() if salary.is_paid else None

            # Update advance deduction amount
            if "advance_deduction_amount" in entry:
                try:
                    new_amount = Decimal(str(entry["advance_deduction_amount"]))
                    salary.advance_deduction_amount = new_amount
                    
                    # Recalculate net payable
                    salary.net_payable = salary.salary_after_tds - new_amount
                    
                    # Track advance deduction change for ledger updates
                    if salary.is_paid and new_amount > 0:
                        advance_deductions_processed[employee_id] = new_amount
                        
                except (ValueError, TypeError, InvalidOperation):
                    logger.error(f"Invalid advance_deduction_amount for employee {employee_id}: {entry.get('advance_deduction_amount')}")
                    continue

            salaries_to_update.append(salary)

        if not salaries_to_update:
            return Response({"error": "No valid updates to process"}, status=400)

        # Perform bulk update
        with transaction.atomic():
            CalculatedSalary.objects.bulk_update(
                salaries_to_update,
                ['is_paid', 'payment_date', 'advance_deduction_amount', 'net_payable'],
                batch_size=100
            )

            # Process advance ledger updates for paid salaries (similar to mark_salary_paid logic)
            if advance_deductions_processed:
                logger.info(f"Processing advance deductions for {len(advance_deductions_processed)} employees")
                
                # Get all relevant advance records in one query
                all_employee_ids = list(advance_deductions_processed.keys())
                all_advances = AdvanceLedger.objects.filter(
                    tenant=tenant,
                    employee_id__in=all_employee_ids,
                    status__in=['PENDING','PARTIALLY_PAID']
                ).order_by('employee_id', 'advance_date')

                # Group advances by employee for efficient processing
                advances_by_employee = {}
                for advance in all_advances:
                    if advance.employee_id not in advances_by_employee:
                        advances_by_employee[advance.employee_id] = []
                    advances_by_employee[advance.employee_id].append(advance)

                # Process advance deductions for each employee
                advances_to_update = []
                advances_to_mark_repaid = []

                for employee_id, total_deduction in advance_deductions_processed.items():
                    remaining_deduction = Decimal(str(total_deduction))
                    employee_advances = advances_by_employee.get(employee_id, [])

                    for advance in employee_advances:
                        if remaining_deduction <= 0:
                            break

                        current_balance = advance.remaining_balance
                        if current_balance <= remaining_deduction:
                            # This advance is fully paid
                            advance.status = 'REPAID'
                            advance.remaining_balance = Decimal('0')
                            advances_to_mark_repaid.append(advance)
                            remaining_deduction -= current_balance
                        else:
                            # This advance is partially paid - reduce the remaining_balance
                            advance.remaining_balance -= remaining_deduction
                            advance.status = 'PARTIALLY_PAID'
                            advances_to_update.append(advance)
                            remaining_deduction = Decimal('0')

                # Execute bulk updates for advance ledger
                if advances_to_update:
                    AdvanceLedger.objects.bulk_update(advances_to_update, ['remaining_balance', 'status'], batch_size=100)
                    logger.info(f"Bulk updated {len(advances_to_update)} advance remaining balances")

                if advances_to_mark_repaid:
                    AdvanceLedger.objects.bulk_update(advances_to_mark_repaid, ['status', 'remaining_balance'], batch_size=100)
                    logger.info(f"Marked {len(advances_to_mark_repaid)} advances as repaid")

        # Clear payroll overview cache
        from django.core.cache import cache
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")

        return Response({
            "success": True,
            "updated_count": len(salaries_to_update),
            "period_id": period_id,
            "message": f"Successfully updated {len(salaries_to_update)} salary records",
            "cache_cleared": True
        })

    except Exception as e:
        logger.error(f"Error in bulk_update_payroll_period: {str(e)}")
        return Response({"error": f"Bulk update failed: {str(e)}"}, status=500)

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum, Q, Avg
from django.utils import timezone
from datetime import timedelta
import logging
from rest_framework_simplejwt.tokens import RefreshToken

from ..models.tenant import Tenant
from ..models.auth import CustomUser
from ..models.support import SupportTicket
from ..models.employee import EmployeeProfile
from ..utils.permissions import IsSuperUser
from ..serializers.support_serializers import SupportTicketSerializer
from ..utils.session_manager import SessionManager

logger = logging.getLogger(__name__)


class SuperAdminDashboardStatsView(APIView):
    """
    Super admin dashboard statistics across all tenants
    """
    permission_classes = [IsAuthenticated, IsSuperUser]
    
    def get(self, request):
        """Get aggregated statistics across all tenants"""
        try:
            # Total tenants
            total_tenants = Tenant.objects.count()
            active_tenants = Tenant.objects.filter(is_active=True).count()
            inactive_tenants = total_tenants - active_tenants
            
            # Total users
            total_users = CustomUser.objects.count()
            active_users = CustomUser.objects.filter(is_active=True).count()
            
            # Total employees (use all_objects to bypass tenant filtering)
            total_employees = EmployeeProfile.all_objects.count()
            active_employees = EmployeeProfile.all_objects.filter(is_active=True).count()
            
            # Total credits across all tenants
            total_credits = Tenant.objects.aggregate(total=Sum('credits'))['total'] or 0
            tenants_with_credits = Tenant.objects.filter(credits__gt=0).count()
            tenants_without_credits = Tenant.objects.filter(credits=0).count()
            
            # Support tickets statistics (use all_objects to bypass tenant filtering)
            total_tickets = SupportTicket.all_objects.count()
            open_tickets = SupportTicket.all_objects.filter(status='open').count()
            in_progress_tickets = SupportTicket.all_objects.filter(status='in_progress').count()
            resolved_tickets = SupportTicket.all_objects.filter(status='resolved').count()
            closed_tickets = SupportTicket.all_objects.filter(status='closed').count()
            
            # Recent activity (last 7 days)
            seven_days_ago = timezone.now() - timedelta(days=7)
            recent_tickets = SupportTicket.all_objects.filter(created_at__gte=seven_days_ago).count()
            recent_users = CustomUser.objects.filter(date_joined__gte=seven_days_ago).count()
            recent_tenants = Tenant.objects.filter(created_at__gte=seven_days_ago).count()
            
            # Tenant distribution by plan
            tenant_plans = Tenant.objects.values('plan').annotate(count=Count('id')).order_by('plan')
            
            # Average credits per tenant
            avg_credits = Tenant.objects.aggregate(avg=Avg('credits'))['avg'] or 0
            
            return Response({
                'tenants': {
                    'total': total_tenants,
                    'active': active_tenants,
                    'inactive': inactive_tenants,
                    'with_credits': tenants_with_credits,
                    'without_credits': tenants_without_credits,
                    'plans': list(tenant_plans),
                    'avg_credits': round(avg_credits, 2)
                },
                'users': {
                    'total': total_users,
                    'active': active_users,
                    'inactive': total_users - active_users
                },
                'employees': {
                    'total': total_employees,
                    'active': active_employees,
                    'inactive': total_employees - active_employees
                },
                'credits': {
                    'total': total_credits,
                    'tenants_with_credits': tenants_with_credits,
                    'tenants_without_credits': tenants_without_credits
                },
                'support_tickets': {
                    'total': total_tickets,
                    'open': open_tickets,
                    'in_progress': in_progress_tickets,
                    'resolved': resolved_tickets,
                    'closed': closed_tickets
                },
                'recent_activity': {
                    'tickets_last_7_days': recent_tickets,
                    'users_last_7_days': recent_users,
                    'tenants_last_7_days': recent_tenants
                }
            })
        except Exception as e:
            logger.error(f"Error fetching super admin stats: {str(e)}")
            return Response(
                {'error': 'Failed to fetch statistics'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SuperAdminTenantListView(APIView):
    """
    List all tenants with their credit information (super admin only)
    """
    permission_classes = [IsAuthenticated, IsSuperUser]
    
    def get(self, request):
        """Get list of all tenants with credits"""
        try:
            tenants = Tenant.objects.all().order_by('-created_at')
            
            tenant_data = []
            for tenant in tenants:
                user_count = CustomUser.objects.filter(tenant=tenant).count()
                employee_count = EmployeeProfile.all_objects.filter(tenant=tenant).count()
                ticket_count = SupportTicket.all_objects.filter(tenant=tenant).count()
                
                tenant_data.append({
                    'id': tenant.id,
                    'name': tenant.name,
                    'subdomain': tenant.subdomain,
                    'credits': tenant.credits,
                    'is_active': tenant.is_active,
                    'plan': tenant.plan,
                    'created_at': tenant.created_at,
                    'last_credit_deducted': tenant.last_credit_deducted,
                    'user_count': user_count,
                    'employee_count': employee_count,
                    'ticket_count': ticket_count
                })
            
            return Response({
                'tenants': tenant_data,
                'total': len(tenant_data)
            })
        except Exception as e:
            logger.error(f"Error fetching tenants list: {str(e)}")
            return Response(
                {'error': 'Failed to fetch tenants'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SuperAdminTenantCreditsView(APIView):
    """
    Manage tenant credits (super admin only)
    """
    permission_classes = [IsAuthenticated, IsSuperUser]
    
    def patch(self, request, tenant_id):
        """Update tenant credits"""
        try:
            tenant = Tenant.objects.get(id=tenant_id)
            action = request.data.get('action')  # 'add' or 'set'
            amount = request.data.get('amount')
            
            if amount is None:
                return Response(
                    {'error': 'Amount is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                amount = int(amount)
                if amount < 0:
                    return Response(
                        {'error': 'Amount must be positive'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Invalid amount'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if action == 'add':
                tenant.add_credits(amount)
                message = f'Added {amount} credits to {tenant.name}'
            elif action == 'set':
                tenant.credits = amount
                # Reactivate if credits > 0
                if amount > 0 and not tenant.is_active:
                    tenant.is_active = True
                    tenant.deactivated_at = None
                    CustomUser.objects.filter(tenant=tenant).update(is_active=True)
                elif amount == 0 and tenant.is_active:
                    tenant.is_active = False
                    CustomUser.objects.filter(tenant=tenant).update(is_active=False)
                tenant.save()
                message = f'Set credits to {amount} for {tenant.name}'
            else:
                return Response(
                    {'error': 'Invalid action. Use "add" or "set"'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info(f"Super admin {request.user.email} {action} {amount} credits for tenant {tenant.name} (ID: {tenant.id})")
            
            return Response({
                'success': True,
                'message': message,
                'tenant': {
                    'id': tenant.id,
                    'name': tenant.name,
                    'credits': tenant.credits,
                    'is_active': tenant.is_active
                }
            })
        except Tenant.DoesNotExist:
            return Response(
                {'error': 'Tenant not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error updating tenant credits: {str(e)}")
            return Response(
                {'error': 'Failed to update credits'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SuperAdminSupportTicketsView(APIView):
    """
    List all support tickets across all tenants (super admin only)
    """
    permission_classes = [IsAuthenticated, IsSuperUser]
    
    def get(self, request):
        """Get all support tickets with tenant information"""
        try:
            # Get query parameters
            status_filter = request.query_params.get('status', None)
            priority_filter = request.query_params.get('priority', None)
            tenant_id = request.query_params.get('tenant_id', None)
            
            # Build queryset (use all_objects to bypass tenant filtering)
            tickets = SupportTicket.all_objects.all().select_related('tenant', 'created_by', 'resolved_by').order_by('-created_at')
            
            # Apply filters
            if status_filter:
                tickets = tickets.filter(status=status_filter)
            if priority_filter:
                tickets = tickets.filter(priority=priority_filter)
            if tenant_id:
                tickets = tickets.filter(tenant_id=tenant_id)
            
            # Serialize tickets
            serializer = SupportTicketSerializer(tickets, many=True)
            
            return Response({
                'tickets': serializer.data,
                'total': tickets.count()
            })
        except Exception as e:
            logger.error(f"Error fetching support tickets: {str(e)}")
            return Response(
                {'error': 'Failed to fetch support tickets'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SuperAdminSupportTicketStatusView(APIView):
    """
    Update support ticket status (super admin only)
    """
    permission_classes = [IsAuthenticated, IsSuperUser]
    
    def patch(self, request, ticket_id):
        """Update ticket status"""
        try:
            ticket = SupportTicket.all_objects.get(id=ticket_id)
            new_status = request.data.get('status')
            admin_response = request.data.get('admin_response', None)
            
            if new_status not in ['open', 'in_progress', 'resolved', 'closed']:
                return Response(
                    {'error': 'Invalid status. Must be one of: open, in_progress, resolved, closed'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            ticket.status = new_status
            if admin_response:
                ticket.admin_response = admin_response
            
            if new_status == 'resolved' and not ticket.resolved_at:
                ticket.resolved_at = timezone.now()
                ticket.resolved_by = request.user
            
            ticket.save()
            
            logger.info(f"Super admin {request.user.email} updated ticket {ticket_id} status to {new_status}")
            
            serializer = SupportTicketSerializer(ticket)
            return Response({
                'success': True,
                'message': f'Ticket status updated to {new_status}',
                'ticket': serializer.data
            })
        except SupportTicket.DoesNotExist:
            return Response(
                {'error': 'Ticket not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error updating ticket status: {str(e)}")
            return Response(
                {'error': 'Failed to update ticket status'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SuperAdminLoginAsTenantView(APIView):
    """
    Allow super admin to login as a tenant (impersonation)
    """
    permission_classes = [IsAuthenticated, IsSuperUser]
    
    def post(self, request, tenant_id):
        """Login as tenant"""
        try:
            tenant = Tenant.objects.get(id=tenant_id)
            
            # Get the first admin user for the tenant (or create a system user if none exists)
            admin_user = CustomUser.objects.filter(
                tenant=tenant,
                is_active=True
            ).order_by('date_joined').first()
            
            if not admin_user:
                return Response(
                    {'error': 'No active admin user found for this tenant'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Store original super admin info in the user object for restoration
            original_super_admin = {
                'id': request.user.id,
                'email': request.user.email,
                'name': f"{request.user.first_name} {request.user.last_name}".strip() or request.user.email,
            }
            
            # Create session for the tenant admin user
            session_key = SessionManager.create_new_session(admin_user, request)
            
            # Generate JWT tokens for the tenant admin user
            refresh = RefreshToken.for_user(admin_user)
            
            # Prepare user data with impersonation flag
            user_data = {
                'id': admin_user.id,
                'email': admin_user.email,
                'name': f"{admin_user.first_name} {admin_user.last_name}".strip() or admin_user.email,
                'first_name': admin_user.first_name or '',
                'last_name': admin_user.last_name or '',
                'role': admin_user.role,
                'is_superuser': False,
                'impersonating': True,
                'original_super_admin': original_super_admin,
            }
            
            # Prepare tenant data
            tenant_data = {
                'id': tenant.id,
                'name': tenant.name,
                'subdomain': tenant.subdomain,
            }
            
            logger.info(f"Super admin {request.user.email} logged in as tenant {tenant.name} (ID: {tenant.id})")
            
            return Response({
                'message': f'Logged in as tenant: {tenant.name}',
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'session_key': session_key,
                'user': user_data,
                'tenant': tenant_data,
            })
        except Tenant.DoesNotExist:
            return Response(
                {'error': 'Tenant not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error logging in as tenant: {str(e)}")
            return Response(
                {'error': 'Failed to login as tenant'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SuperAdminRestoreSessionView(APIView):
    """
    Restore super admin session after impersonation
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Restore original super admin session"""
        try:
            # Get original super admin ID from request
            original_super_admin_id = request.data.get('original_super_admin_id')
            
            if not original_super_admin_id:
                return Response(
                    {'error': 'Original super admin ID is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get the original super admin user
            try:
                original_super_admin = CustomUser.objects.get(
                    id=original_super_admin_id,
                    is_superuser=True
                )
            except CustomUser.DoesNotExist:
                return Response(
                    {'error': 'Original super admin user not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Create session for the original super admin
            session_key = SessionManager.create_new_session(original_super_admin, request)
            
            # Generate JWT tokens for the original super admin
            refresh = RefreshToken.for_user(original_super_admin)
            
            # Prepare user data without impersonation flag
            user_data = {
                'id': original_super_admin.id,
                'email': original_super_admin.email,
                'name': f"{original_super_admin.first_name} {original_super_admin.last_name}".strip() or original_super_admin.email,
                'first_name': original_super_admin.first_name or '',
                'last_name': original_super_admin.last_name or '',
                'role': original_super_admin.role,
                'is_superuser': True,
            }
            
            logger.info(f"Super admin {original_super_admin.email} restored session after impersonation")
            
            return Response({
                'message': 'Super admin session restored',
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'session_key': session_key,
                'user': user_data,
                'tenant': None,  # Super admins don't have tenants
            })
        except Exception as e:
            logger.error(f"Error restoring super admin session: {str(e)}")
            return Response(
                {'error': 'Failed to restore super admin session'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


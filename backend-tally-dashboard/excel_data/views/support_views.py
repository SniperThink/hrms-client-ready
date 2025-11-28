from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from django.core.cache import cache
import logging
import time

from ..models.support import SupportTicket
from ..serializers.support_serializers import SupportTicketSerializer, SupportTicketCreateSerializer
from ..services.zeptomail_service import send_email_via_zeptomail
from ..services.email_templates import get_email_template_base
from ..utils.utils import get_current_tenant

logger = logging.getLogger(__name__)

# Cache timeout for support tickets
SUPPORT_TICKETS_CACHE_TIMEOUT = 300  # 5 minutes for list views
SUPPORT_TICKET_DETAIL_CACHE_TIMEOUT = 600  # 10 minutes for individual tickets
SUPPORT_TICKET_SERIALIZED_CACHE_TIMEOUT = 300  # 5 minutes for serialized data


def render_ticket_email_template(ticket, user, admin_email=None):
    """Render email template for ticket notification"""
    from django.utils.html import escape
    
    priority_colors = {
        'low': '#4caf50',
        'medium': '#ff9800',
        'high': '#f44336',
        'urgent': '#d32f2f'
    }
    
    priority_color = priority_colors.get(ticket.priority, '#666666')
    
    # Escape user input to prevent HTML injection
    subject_escaped = escape(str(ticket.subject))
    description_escaped = escape(str(ticket.description))
    user_name = escape(f"{user.first_name} {user.last_name}".strip() or user.email)
    user_email_escaped = escape(str(user.email))
    
    # Convert newlines to <br> for description
    description_html = description_escaped.replace('\n', '<br>')
    
    content = f"""
    <div style="color: #333333;">
        <h2 style="color: #176d67; margin-top: 0;">New Support Ticket Created</h2>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #666666; width: 150px;">Ticket ID:</td>
                    <td style="padding: 8px 0; color: #333333;">#{ticket.id}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #666666;">Subject:</td>
                    <td style="padding: 8px 0; color: #333333;">{subject_escaped}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #666666;">Priority:</td>
                    <td style="padding: 8px 0;">
                        <span style="display: inline-block; padding: 4px 12px; background-color: {priority_color}; color: white; border-radius: 4px; font-size: 12px; font-weight: 600;">
                            {ticket.priority.upper()}
                        </span>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #666666;">Status:</td>
                    <td style="padding: 8px 0;">
                        <span style="display: inline-block; padding: 4px 12px; background-color: #2196f3; color: white; border-radius: 4px; font-size: 12px; font-weight: 600;">
                            {ticket.status.upper().replace('_', ' ')}
                        </span>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #666666;">Created By:</td>
                    <td style="padding: 8px 0; color: #333333;">{user_name} ({user_email_escaped})</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #666666;">Created At:</td>
                    <td style="padding: 8px 0; color: #333333;">{ticket.created_at.strftime('%B %d, %Y at %I:%M %p')}</td>
                </tr>
            </table>
        </div>
        
        <div style="margin: 20px 0;">
            <h3 style="color: #176d67; margin-bottom: 10px;">Description:</h3>
            <div style="background-color: #ffffff; padding: 15px; border-left: 4px solid #176d67; border-radius: 4px; white-space: pre-wrap; color: #333333; line-height: 1.6; max-height: 500px; overflow-y: auto; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">
                {description_html}
            </div>
            {len(ticket.description) > 2000 and f'<p style="margin-top: 10px; color: #666666; font-size: 12px; font-style: italic;">Note: This is a long description. Scroll within the box above to read the full content, or view the complete ticket in the HRMS system.</p>' or ''}
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666666; font-size: 14px;">
            <p>This ticket has been logged in the HRMS system and will be reviewed by the support team.</p>
            <p>You will receive updates on this ticket as it progresses.</p>
        </div>
    </div>
    """
    
    # Get current year for footer
    from datetime import datetime
    current_year = datetime.now().year
    
    # Get base template
    base_template = get_email_template_base()
    
    # Replace placeholders in base template
    # Note: f-strings convert {{ to {, so we replace {CONTENT_PLACEHOLDER} not {{CONTENT_PLACEHOLDER}}
    html_body = base_template.replace('{CONTENT_PLACEHOLDER}', content)
    html_body = html_body.replace('{YEAR_PLACEHOLDER}', str(current_year))
    
    # Create plain text version
    text_body = f"""
New Support Ticket Created

Ticket ID: #{ticket.id}
Subject: {ticket.subject}
Priority: {ticket.priority.upper()}
Status: {ticket.status.upper().replace('_', ' ')}
Created By: {user.first_name} {user.last_name} ({user.email})
Created At: {ticket.created_at.strftime('%B %d, %Y at %I:%M %p')}

Description:
{ticket.description}

This ticket has been logged in the HRMS system and will be reviewed by the support team.
You will receive updates on this ticket as it progresses.
    """.strip()
    
    return html_body, text_body


def send_ticket_email(ticket, user, recipient_email, recipient_name=None):
    """Send email notification for ticket creation"""
    try:
        html_body, text_body = render_ticket_email_template(ticket, user)
        
        # Debug: Log if content is missing
        if '{CONTENT_PLACEHOLDER}' in html_body or '{{CONTENT_PLACEHOLDER}}' in html_body:
            logger.error(f"Content placeholder not replaced in email template for ticket #{ticket.id}")
            logger.debug(f"HTML body preview: {html_body[:500]}")
        
        subject = f"New Support Ticket: {ticket.subject} (Ticket #{ticket.id})"
        
        success = send_email_via_zeptomail(
            to_email=recipient_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            from_name="SniperThink HRMS"
        )
        
        if success:
            logger.info(f"Ticket email sent successfully to {recipient_email} for ticket #{ticket.id}")
        else:
            logger.error(f"Failed to send ticket email to {recipient_email} for ticket #{ticket.id}")
        
        return success
    except Exception as e:
        logger.error(f"Error sending ticket email to {recipient_email}: {str(e)}")
        logger.exception("Full exception details:")
        return False


class SupportTicketViewSet(viewsets.ModelViewSet):
    """ViewSet for SupportTicket model"""
    permission_classes = [IsAuthenticated]
    queryset = SupportTicket.objects.all()
    
    def get_queryset(self):
        """Filter tickets by tenant and user with enhanced caching"""
        tenant = get_current_tenant() or self.request.tenant
        user = self.request.user
        
        if not tenant:
            return SupportTicket.objects.none()
        
        # Build cache key based on user role and tenant
        is_admin = user.role == 'admin' or user.is_superuser
        cache_key = f"support_tickets_queryset_{tenant.id}_{'admin' if is_admin else f'user_{user.id}'}"
        
        # Check cache
        use_cache = self.request.GET.get('no_cache', '').lower() != 'true'
        if use_cache:
            cached_queryset_ids = cache.get(cache_key)
            if cached_queryset_ids is not None:
                logger.info(f"📦 Cache HIT for support tickets queryset: {cache_key}")
                # Return queryset from cached IDs
                if cached_queryset_ids:
                    queryset = SupportTicket.objects.filter(id__in=cached_queryset_ids).order_by('-created_at')
                    return queryset
                else:
                    # Empty list cached - return empty queryset
                    return SupportTicket.objects.none()
        
        # Cache miss - fetch from database
        logger.info(f"💾 Cache MISS for support tickets queryset: {cache_key}")
        start_time = time.time()
        
        # Admin users can see all tickets in their tenant
        # Regular users can only see their own tickets
        if is_admin:
            queryset = SupportTicket.objects.filter(tenant=tenant).order_by('-created_at')
        else:
            queryset = SupportTicket.objects.filter(tenant=tenant, created_by=user).order_by('-created_at')
        
        # Cache the ticket IDs for faster retrieval
        ticket_ids = list(queryset.values_list('id', flat=True))
        cache.set(cache_key, ticket_ids, SUPPORT_TICKETS_CACHE_TIMEOUT)
        query_time_ms = round((time.time() - start_time) * 1000, 2)
        logger.info(f"✅ Cached support tickets queryset: {len(ticket_ids)} tickets in {query_time_ms}ms")
        
        return queryset
    
    def _clear_ticket_cache(self, tenant_id, user_id=None, is_admin=False, ticket_id=None):
        """Clear cache for support tickets - enhanced version"""
        try:
            # Clear queryset caches
            admin_cache_key = f"support_tickets_queryset_{tenant_id}_admin"
            cache.delete(admin_cache_key)
            
            # Clear user-specific queryset cache if provided
            if user_id:
                user_cache_key = f"support_tickets_queryset_{tenant_id}_user_{user_id}"
                cache.delete(user_cache_key)
            
            # Clear individual ticket cache if ticket_id provided
            if ticket_id:
                ticket_cache_key = f"support_ticket_detail_{ticket_id}"
                cache.delete(ticket_cache_key)
                ticket_serialized_key = f"support_ticket_serialized_{ticket_id}"
                cache.delete(ticket_serialized_key)
            
            # If admin, we need to clear all user caches for this tenant
            # Since we can't pattern match, we'll clear the admin cache which will force refresh
            if is_admin:
                # Clear all potential user caches by clearing admin cache
                # Individual user caches will be rebuilt on next request
                logger.info(f"🗑️ Cleared support ticket cache for tenant {tenant_id} (admin view)")
            else:
                logger.info(f"🗑️ Cleared support ticket cache for tenant {tenant_id}, user {user_id}")
        except Exception as e:
            logger.error(f"Error clearing support ticket cache: {e}")
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return SupportTicketCreateSerializer
        return SupportTicketSerializer
    
    def get_serializer_context(self):
        """Add request to serializer context for building absolute URLs"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def perform_create(self, serializer):
        """Create ticket and send email notifications"""
        tenant = get_current_tenant() or self.request.tenant
        user = self.request.user
        
        # Log file upload info for debugging
        if 'attachment' in serializer.validated_data and serializer.validated_data['attachment']:
            attachment = serializer.validated_data['attachment']
            logger.info(f"Uploading attachment: {attachment.name} ({attachment.size} bytes)")
            logger.info(f"Storage backend: {attachment.storage.__class__.__name__ if hasattr(attachment, 'storage') else 'N/A'}")
            if hasattr(settings, 'DEFAULT_FILE_STORAGE'):
                logger.info(f"DEFAULT_FILE_STORAGE: {settings.DEFAULT_FILE_STORAGE}")
        
        # Create ticket
        ticket = serializer.save(
            tenant=tenant,
            created_by=user
        )
        
        # Log attachment URL after save
        if ticket.attachment:
            logger.info(f"Ticket #{ticket.id} attachment saved: {ticket.attachment.name}")
            try:
                attachment_url = ticket.attachment.url
                logger.info(f"Attachment URL: {attachment_url}")
            except Exception as e:
                logger.error(f"Error getting attachment URL: {str(e)}")
        
        # Clear cache after creating ticket
        is_admin = user.role == 'admin' or user.is_superuser
        self._clear_ticket_cache(tenant.id, user.id, is_admin, ticket_id=ticket.id)
        
        # Send email only to support admin (not to ticket creator or tenant admins)
        admin_email = getattr(settings, 'SUPPORT_ADMIN_EMAIL', '')
        
        if admin_email and admin_email.strip():
            # Send to configured support admin email from environment variable
            send_ticket_email(ticket, user, admin_email.strip(), "Support Team")
            logger.info(f"Support ticket email sent to support admin: {admin_email}")
        else:
            # Log warning if SUPPORT_ADMIN_EMAIL is not configured
            logger.warning(
                f"SUPPORT_ADMIN_EMAIL not configured. Support ticket #{ticket.id} created but no notification sent to support team. "
                f"Please configure SUPPORT_ADMIN_EMAIL environment variable."
            )
        
        logger.info(f"Support ticket #{ticket.id} created by user {user.email}")
    
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Mark ticket as resolved"""
        ticket = self.get_object()
        user = request.user
        
        # Only admins can resolve tickets
        if not (user.role == 'admin' or user.is_superuser):
            return Response(
                {'error': 'Only administrators can resolve tickets'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        response_text = request.data.get('response', '')
        ticket.mark_resolved(user, response_text)
        
        # Clear cache after resolving ticket
        tenant = get_current_tenant() or request.tenant
        if tenant:
            self._clear_ticket_cache(tenant.id, ticket.created_by.id if ticket.created_by else None, is_admin=True, ticket_id=ticket.id)
        
        serializer = self.get_serializer(ticket)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close ticket"""
        ticket = self.get_object()
        user = request.user
        
        # Only admins can close tickets
        if not (user.role == 'admin' or user.is_superuser):
            return Response(
                {'error': 'Only administrators can close tickets'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        ticket.mark_closed()
        
        # Clear cache after closing ticket
        tenant = get_current_tenant() or request.tenant
        if tenant:
            self._clear_ticket_cache(tenant.id, ticket.created_by.id if ticket.created_by else None, is_admin=True, ticket_id=ticket.id)
        
        serializer = self.get_serializer(ticket)
        return Response(serializer.data)
    
    def perform_update(self, serializer):
        """Update ticket and clear cache"""
        ticket = serializer.save()
        
        # Clear cache after updating ticket
        tenant = get_current_tenant() or self.request.tenant
        user = self.request.user
        if tenant:
            is_admin = user.role == 'admin' or user.is_superuser
            self._clear_ticket_cache(tenant.id, ticket.created_by.id if ticket.created_by else None, is_admin, ticket_id=ticket.id)
        
        return ticket
    
    def perform_destroy(self, instance):
        """Delete ticket and clear cache"""
        tenant = get_current_tenant() or self.request.tenant
        user = self.request.user
        ticket_creator_id = instance.created_by.id if instance.created_by else None
        ticket_id = instance.id
        
        # Delete the ticket
        instance.delete()
        
        # Clear cache after deleting ticket
        if tenant:
            is_admin = user.role == 'admin' or user.is_superuser
            self._clear_ticket_cache(tenant.id, ticket_creator_id, is_admin, ticket_id=ticket_id)
    
    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Update ticket status (admin only)"""
        ticket = self.get_object()
        user = request.user
        
        # Only admins can update ticket status
        if not (user.role == 'admin' or user.is_superuser):
            return Response(
                {'error': 'Only administrators can update ticket status'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        new_status = request.data.get('status')
        if new_status not in ['open', 'in_progress', 'resolved', 'closed']:
            return Response(
                {'error': 'Invalid status. Must be one of: open, in_progress, resolved, closed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        ticket.status = new_status
        if new_status == 'resolved' and not ticket.resolved_at:
            from django.utils import timezone
            ticket.resolved_at = timezone.now()
            ticket.resolved_by = user
        ticket.save()
        
        # Clear cache after updating status
        tenant = get_current_tenant() or request.tenant
        if tenant:
            self._clear_ticket_cache(tenant.id, ticket.created_by.id if ticket.created_by else None, is_admin=True, ticket_id=ticket.id)
        
        serializer = self.get_serializer(ticket)
        return Response(serializer.data)
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve individual ticket with caching"""
        ticket_id = kwargs.get('pk')
        cache_key = f"support_ticket_detail_{ticket_id}"
        
        # Check cache for serialized ticket data
        use_cache = request.GET.get('no_cache', '').lower() != 'true'
        if use_cache:
            cached_ticket_data = cache.get(cache_key)
            if cached_ticket_data:
                logger.info(f"📦 Cache HIT for ticket detail: {ticket_id}")
                return Response(cached_ticket_data)
        
        # Cache miss - get ticket and serialize
        logger.info(f"💾 Cache MISS for ticket detail: {ticket_id}")
        start_time = time.time()
        
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        response_data = serializer.data
        
        # Cache the serialized data
        cache.set(cache_key, response_data, SUPPORT_TICKET_DETAIL_CACHE_TIMEOUT)
        query_time_ms = round((time.time() - start_time) * 1000, 2)
        logger.info(f"✅ Cached ticket detail: {ticket_id} in {query_time_ms}ms")
        
        return Response(response_data)
    
    def list(self, request, *args, **kwargs):
        """List tickets with enhanced caching and performance metadata"""
        start_time = time.time()
        use_cache = request.GET.get('no_cache', '').lower() != 'true'
        
        tenant = get_current_tenant() or request.tenant
        user = request.user
        
        # Build cache key for serialized list data
        is_admin = user.role == 'admin' or user.is_superuser
        list_cache_key = f"support_tickets_list_{tenant.id}_{'admin' if is_admin else f'user_{user.id}'}"
        
        # Check cache for serialized list
        cached_list_data = None
        if use_cache and tenant:
            cached_list_data = cache.get(list_cache_key)
            if cached_list_data:
                logger.info(f"📦 Cache HIT for support tickets list: {list_cache_key}")
                # Return cached serialized data
                response = Response(cached_list_data)
                response.data['performance'] = {
                    'cached': True,
                    'query_time_ms': round((time.time() - start_time) * 1000, 2),
                    'total_tickets': len(cached_list_data) if isinstance(cached_list_data, list) else 0
                }
                return response
        
        # Cache miss - get queryset (this will use queryset cache if available)
        logger.info(f"💾 Cache MISS for support tickets list: {list_cache_key}")
        queryset = self.filter_queryset(self.get_queryset())
        
        # Paginate if needed
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            # Cache paginated data structure
            if use_cache and tenant:
                cache.set(list_cache_key, response.data, SUPPORT_TICKETS_CACHE_TIMEOUT)
        else:
            serializer = self.get_serializer(queryset, many=True)
            response_data = serializer.data
            response = Response(response_data)
            # Cache the list data
            if use_cache and tenant:
                cache.set(list_cache_key, response_data, SUPPORT_TICKETS_CACHE_TIMEOUT)
        
        # Add performance metadata
        query_time_ms = round((time.time() - start_time) * 1000, 2)
        
        # Check if queryset came from cache
        queryset_cache_key = f"support_tickets_queryset_{tenant.id}_{'admin' if is_admin else f'user_{user.id}'}"
        queryset_cached = cache.get(queryset_cache_key) is not None if use_cache and tenant else False
        
        # Add performance metadata to response
        if isinstance(response.data, dict):
            response.data['performance'] = {
                'cached': queryset_cached,
                'list_cached': cached_list_data is not None,
                'query_time_ms': query_time_ms,
                'total_tickets': len(serializer.data) if not page else queryset.count()
            }
        
        return response


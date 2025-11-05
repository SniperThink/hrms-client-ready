import random
import string
from django.conf import settings
from django.utils import timezone
from django.utils.html import strip_tags
import logging

logger = logging.getLogger(__name__)


def generate_otp(length=6):
    """Generate a random OTP code"""
    return ''.join(random.choices(string.digits, k=length))


def send_password_reset_otp(email, otp_code):
    """
    Send OTP code for password reset
    
    Returns:
        dict: {
            'success': bool
        }
    """
    try:
        from .zeptomail_service import send_email_via_zeptomail
        from .email_templates import render_password_reset_email
        
        subject = "Password Reset OTP - SniperThink HRMS"
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://35.154.9.249')
        expire_minutes = getattr(settings, 'PASSWORD_RESET_EXPIRE_MINUTES', 30)
        
        html_message = render_password_reset_email(email, otp_code, expire_minutes, frontend_url)
        text_message = strip_tags(html_message).strip()
        
        success = send_email_via_zeptomail(
            to_email=email,
            subject=subject,
            html_body=html_message,
            text_body=text_message,
            from_name="SniperThink"
        )
        
        if success:
            logger.info(f"Password reset OTP sent successfully to {email}")
            return {'success': True}
        else:
            logger.error(f"Failed to send password reset OTP to {email}")
            return {'success': False}
        
    except Exception as e:
        logger.error(f"Failed to send password reset OTP to {email}: {str(e)}")
        return {'success': False}


def send_welcome_email(user):
    """Send welcome email after successful registration"""
    try:
        from .zeptomail_service import send_email_via_zeptomail
        from .email_templates import render_welcome_email
        
        subject = f"Welcome to SniperThink - HRMS"
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://35.154.9.249')
        
        html_message = render_welcome_email(user, frontend_url)
        text_message = strip_tags(html_message).strip()
        
        success = send_email_via_zeptomail(
            to_email=user.email,
            subject=subject,
            html_body=html_message,
            text_body=text_message,
            from_name="SniperThink"
        )
        
        if success:
            logger.info(f"Welcome email sent successfully to {user.email}")
            return True
        else:
            logger.error(f"Failed to send welcome email to {user.email}")
            return False
        
    except Exception as e:
        logger.error(f"Failed to send welcome email to {user.email}: {str(e)}")
        return False


def send_deletion_warning_email(tenant):
    """Send warning email to admin users 3 days before account permanent deletion"""
    try:
        from .zeptomail_service import send_email_via_zeptomail
        from .email_templates import render_deletion_warning_email
        from ..models.auth import CustomUser
        from datetime import timedelta
        
        # Get all admin users for this tenant
        admin_users = CustomUser.objects.filter(tenant=tenant, role='admin', email_verified=True)
        
        if not admin_users.exists():
            logger.warning(f"No admin users found for tenant {tenant.name} to send deletion warning email")
            return False
        
        # Calculate days remaining
        recovery_deadline = tenant.deactivated_at + timedelta(days=30)
        days_remaining = max(0, (recovery_deadline - timezone.now()).days)
        
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://35.154.9.249')
        
        # Send email to all admin users
        email_sent = False
        for admin_user in admin_users:
            subject = f"⚠️ Important: Your HRMS Account Will Be Deleted in 3 Days - {tenant.name}"
            
            html_message = render_deletion_warning_email(
                admin_user, tenant, days_remaining, recovery_deadline, frontend_url
            )
            text_message = strip_tags(html_message).strip()
            
            success = send_email_via_zeptomail(
                to_email=admin_user.email,
                subject=subject,
                html_body=html_message,
                text_body=text_message,
                from_name="SniperThink"
            )
            
            if success:
                email_sent = True
                logger.info(f"Deletion warning email sent to admin user {admin_user.email} for tenant {tenant.name}")
            else:
                logger.error(f"Failed to send deletion warning email to {admin_user.email} for tenant {tenant.name}")
        
        return email_sent
        
    except Exception as e:
        logger.error(f"Failed to send deletion warning email for tenant {tenant.name}: {str(e)}", exc_info=True)
        return False


def cleanup_expired_tokens():
    """Clean up expired invitation tokens and OTP codes"""
    from ..models import InvitationToken, PasswordResetOTP
    
    now = timezone.now()
    
    # Delete expired invitation tokens
    expired_invitations = InvitationToken.objects.filter(expires_at__lt=now)
    invitation_count = expired_invitations.count()
    expired_invitations.delete()
    
    # Delete expired OTP codes
    expired_otps = PasswordResetOTP.objects.filter(expires_at__lt=now)
    otp_count = expired_otps.count()
    expired_otps.delete()
    
    logger.info(f"Cleanup completed: {invitation_count} expired invitations and {otp_count} expired OTPs deleted")
    
    return invitation_count, otp_count
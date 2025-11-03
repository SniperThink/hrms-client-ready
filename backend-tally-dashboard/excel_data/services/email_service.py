import random
import string
from django.conf import settings
from django.utils import timezone
import logging
from .zeptomail_service import send_email_via_zeptomail

logger = logging.getLogger(__name__)


def generate_otp(length=6):
    """Generate a random OTP code"""
    return ''.join(random.choices(string.digits, k=length))


def send_password_reset_otp(email, otp_code):
    """Send OTP code for password reset"""
    try:
        subject = "Password Reset OTP - HRMS"
        
        text_message = f"""
Password Reset OTP - HR Management System

Hello,

You requested to reset your password for the HR Management System.

Your OTP Code: {otp_code}

This OTP code will expire in {getattr(settings, 'PASSWORD_RESET_EXPIRE_MINUTES', 30)} minutes.

If you did not request this password reset, please ignore this email.

Best regards,
The SniperThink Team
        """
        
        html_message = f"""
<html>
<body>
    <h2>Password Reset OTP - HR Management System</h2>
    <p>Hello,</p>
    <p>You requested to reset your password for the HR Management System.</p>
    <p><strong>Your OTP Code: {otp_code}</strong></p>
    <p>This OTP code will expire in {getattr(settings, 'PASSWORD_RESET_EXPIRE_MINUTES', 30)} minutes.</p>
    <p>If you did not request this password reset, please ignore this email.</p>
    <p>Best regards,<br>The SniperThink Team</p>
</body>
</html>
        """
        
        success = send_email_via_zeptomail(
            to_email=email,
            subject=subject,
            html_body=html_message,
            text_body=text_message
        )
        
        if success:
            logger.info(f"Password reset OTP sent successfully to {email}")
            return True
        else:
            logger.error(f"Failed to send password reset OTP to {email}")
            return False
        
    except Exception as e:
        logger.error(f"Failed to send password reset OTP to {email}: {str(e)}")
        return False


def send_welcome_email(user):
    """Send welcome email after successful registration"""
    try:
        subject = f"Welcome to SniperThink - HRMS"
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://35.154.9.249')
        
        text_message = f"""
Welcome to {user.tenant.name} - HR Management System

Hello {user.first_name} {user.last_name},

Your account has been successfully created!

You can login at: {frontend_url}/login

Thank you for joining SniperThink!

Best regards,
The SniperThink Team
        """
        
        html_message = f"""
<html>
<body>
    <h2>Welcome to {user.tenant.name} - HR Management System</h2>
    <p>Hello {user.first_name} {user.last_name},</p>
    <p>Your account has been successfully created!</p>
    <p>You can login at: <a href="{frontend_url}/login">{frontend_url}/login</a></p>
    <p>Thank you for joining SniperThink!</p>
    <p>Best regards,<br>The SniperThink Team</p>
</body>
</html>
        """
        
        success = send_email_via_zeptomail(
            to_email=user.email,
            subject=subject,
            html_body=html_message,
            text_body=text_message
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
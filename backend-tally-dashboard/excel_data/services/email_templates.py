"""
Email Templates for SniperThink HRMS
Professional email templates with branding
"""

from django.conf import settings


# Branding Configuration
BRAND_COLORS = {
    'primary': '#176d67',  # Main teal color
    'primary_dark': '#1A6262',  # Dark teal for text
    'primary_light': '#e3f2fd',  # Light teal background
    'secondary': '#1976d2',  # Blue accent
    'success': '#4caf50',  # Green for success
    'warning': '#ff9800',  # Orange for warnings
    'danger': '#f44336',  # Red for errors/danger
    'text_primary': '#333333',
    'text_secondary': '#666666',
    'border': '#e0e0e0',
    'background': '#f5f5f5',
}

BRAND_NAME = "SniperThink"
LOGO_URL = ""  # Update with actual logo URL or use base64 encoded logo


def get_email_template_base():
    """Base HTML template for all emails"""
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{BRAND_NAME} - HRMS</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: {BRAND_COLORS['background']};">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: {BRAND_COLORS['background']};">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, {BRAND_COLORS['primary']} 0%, {BRAND_COLORS['primary_dark']} 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">{BRAND_NAME}</h1>
                            <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">HR Management System</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            {{CONTENT_PLACEHOLDER}}
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px; background-color: #f9f9f9; border-top: 1px solid {BRAND_COLORS['border']}; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: {BRAND_COLORS['text_secondary']}; font-size: 13px;">
                                This email was sent by <strong>{BRAND_NAME}</strong>
                            </p>
                            <p style="margin: 0; color: {BRAND_COLORS['text_secondary']}; font-size: 12px;">
                                © {{YEAR_PLACEHOLDER}} {BRAND_NAME}. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def create_button(text, url, color=None):
    """Create a styled button for emails"""
    button_color = color or BRAND_COLORS['primary']
    button_hover = BRAND_COLORS['primary_dark']
    
    return f"""
    <table role="presentation" style="width: 100%; margin: 30px 0;">
        <tr>
            <td style="text-align: center;">
                <a href="{url}" style="display: inline-block; padding: 14px 32px; background-color: {button_color}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    {text}
                </a>
            </td>
        </tr>
    </table>
    """


def create_info_box(text, type='info'):
    """Create an info box with different styles"""
    colors = {
        'info': {'bg': '#e3f2fd', 'border': '#1976d2', 'text': '#1976d2'},
        'warning': {'bg': '#fff3cd', 'border': '#ff9800', 'text': '#856404'},
        'danger': {'bg': '#ffebee', 'border': '#f44336', 'text': '#c62828'},
        'success': {'bg': '#e8f5e9', 'border': '#4caf50', 'text': '#2e7d32'},
    }
    
    style = colors.get(type, colors['info'])
    
    return f"""
    <div style="background-color: {style['bg']}; border-left: 4px solid {style['border']}; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: {style['text']}; font-size: 14px; line-height: 1.6;">
            {text}
        </p>
    </div>
    """


def render_deletion_warning_email(admin_user, tenant, days_remaining, recovery_deadline, frontend_url):
    """Render deletion warning email template"""
    year = recovery_deadline.year
    content = f"""
    <h2 style="color: {BRAND_COLORS['text_primary']}; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">
        ⚠️ Important Notice: Account Deletion Warning
    </h2>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 15px 0;">
        Hello <strong>{admin_user.first_name} {admin_user.last_name}</strong>,
    </p>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        We hope this message finds you well. This is an important notice regarding your HRMS account for <strong>{tenant.name}</strong>.
    </p>
    
    {create_info_box(f'Your account has been deactivated and will be permanently deleted in <strong>3 days</strong> (on {recovery_deadline.strftime("%B %d, %Y")}).', 'warning')}
    
    <h3 style="color: {BRAND_COLORS['primary']}; margin: 25px 0 15px 0; font-size: 18px; font-weight: 600;">
        Current Status:
    </h3>
    
    <table role="presentation" style="width: 100%; margin: 15px 0; border-collapse: collapse;">
        <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid {BRAND_COLORS['border']};">
                <strong style="color: {BRAND_COLORS['text_primary']};">Account:</strong>
                <span style="color: {BRAND_COLORS['text_secondary']}; margin-left: 10px;">{tenant.name}</span>
            </td>
        </tr>
        <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid {BRAND_COLORS['border']};">
                <strong style="color: {BRAND_COLORS['text_primary']};">Days Remaining:</strong>
                <span style="color: {BRAND_COLORS['text_secondary']}; margin-left: 10px;">{days_remaining} day(s)</span>
            </td>
        </tr>
        <tr>
            <td style="padding: 10px 0;">
                <strong style="color: {BRAND_COLORS['text_primary']};">Deletion Date:</strong>
                <span style="color: {BRAND_COLORS['text_secondary']}; margin-left: 10px;">{recovery_deadline.strftime("%B %d, %Y at %I:%M %p UTC")}</span>
            </td>
        </tr>
    </table>
    
    {create_info_box('To prevent permanent deletion, please log in to your account within the next 3 days. Logging in will automatically reactivate your account and all your data will be preserved.', 'info')}
    
    {create_button("Login to Reactivate Account", f"{frontend_url}/login", BRAND_COLORS['primary'])}
    
    {create_info_box(f'<strong>⚠️ Important:</strong> After {recovery_deadline.strftime("%B %d, %Y")}, your account and all associated data will be permanently deleted and cannot be recovered.', 'danger')}
    
    <p style="color: {BRAND_COLORS['text_secondary']}; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
        If you have any questions or need assistance, please contact our support team immediately.
    </p>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 25px 0 0 0;">
        Best regards,<br>
        <strong>The {BRAND_NAME} Team</strong>
    </p>
    """
    
    template = get_email_template_base()
    return template.replace('{CONTENT_PLACEHOLDER}', content).replace('{YEAR_PLACEHOLDER}', str(year))


def render_welcome_email(user, frontend_url):
    """Render welcome email template"""
    year = user.date_joined.year if hasattr(user, 'date_joined') else 2025
    tenant_name = user.tenant.name if user.tenant else 'HRMS'
    
    content = f"""
    <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 80px; height: 80px; background-color: {BRAND_COLORS['success']}; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 40px;">✓</span>
        </div>
    </div>
    
    <h2 style="color: {BRAND_COLORS['text_primary']}; margin: 0 0 20px 0; font-size: 24px; font-weight: 600; text-align: center;">
        Welcome to {tenant_name}!
    </h2>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 15px 0;">
        Hello <strong>{user.first_name} {user.last_name}</strong>,
    </p>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your account has been successfully created! We're excited to have you join {BRAND_NAME} HR Management System.
    </p>
    
    {create_info_box('Your account is ready to use. You can now log in and start managing your HR operations.', 'success')}
    
    {create_button("Login to Your Account", f"{frontend_url}/login", BRAND_COLORS['primary'])}
    
    <p style="color: {BRAND_COLORS['text_secondary']}; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
        If you have any questions or need assistance, feel free to contact our support team.
    </p>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 25px 0 0 0;">
        Best regards,<br>
        <strong>The {BRAND_NAME} Team</strong>
    </p>
    """
    
    template = get_email_template_base()
    return template.replace('{CONTENT_PLACEHOLDER}', content).replace('{YEAR_PLACEHOLDER}', str(year))


def render_password_reset_email(email, otp_code, expire_minutes, frontend_url):
    """Render password reset OTP email template"""
    from datetime import datetime
    year = datetime.now().year
    
    content = f"""
    <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 80px; height: 80px; background-color: {BRAND_COLORS['secondary']}; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 40px;">🔐</span>
        </div>
    </div>
    
    <h2 style="color: {BRAND_COLORS['text_primary']}; margin: 0 0 20px 0; font-size: 24px; font-weight: 600; text-align: center;">
        Password Reset Request
    </h2>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 15px 0;">
        Hello,
    </p>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        You requested to reset your password for your {BRAND_NAME} HRMS account.
    </p>
    
    {create_info_box(f'Use the OTP code below to reset your password. This code will expire in {{expire_minutes}} minutes.', 'info')}
    
    <div style="text-align: center; margin: 30px 0;">
        <div style="display: inline-block; background-color: {BRAND_COLORS['primary_light']}; border: 2px solid {BRAND_COLORS['primary']}; border-radius: 8px; padding: 20px 40px;">
            <p style="margin: 0 0 10px 0; color: {BRAND_COLORS['text_secondary']}; font-size: 14px; font-weight: 500;">Your OTP Code:</p>
            <p style="margin: 0; color: {BRAND_COLORS['primary']}; font-size: 32px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                {otp_code}
            </p>
        </div>
    </div>
    
    {create_button("Reset Password", f"{frontend_url}/reset-password", BRAND_COLORS['primary'])}
    
    {create_info_box('If you did not request this password reset, please ignore this email. Your account remains secure.', 'warning')}
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 25px 0 0 0;">
        Best regards,<br>
        <strong>The {BRAND_NAME} Team</strong>
    </p>
    """
    
    template = get_email_template_base()
    return template.replace('{CONTENT_PLACEHOLDER}', content).replace('{YEAR_PLACEHOLDER}', str(year))


def render_email_verification_email(user, verification_url, expiry_hours):
    """Render email verification email template"""
    year = user.date_joined.year if hasattr(user, 'date_joined') else 2025
    tenant_name = user.tenant.name if user.tenant else 'HRMS'
    
    content = f"""
    <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 80px; height: 80px; background-color: {BRAND_COLORS['secondary']}; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 40px;">📧</span>
        </div>
    </div>
    
    <h2 style="color: {BRAND_COLORS['text_primary']}; margin: 0 0 20px 0; font-size: 24px; font-weight: 600; text-align: center;">
        Verify Your Email Address
    </h2>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 15px 0;">
        Hello <strong>{user.first_name} {user.last_name}</strong>,
    </p>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Welcome to <strong>{tenant_name}</strong> - HR Management System! Thank you for signing up. To complete your registration and access your account, please verify your email address.
    </p>
    
    {create_info_box(f'Click the button below to verify your email address. This verification link will expire in {expiry_hours} hours.', 'info')}
    
    {create_button("Verify Email Address", verification_url, BRAND_COLORS['primary'])}
    
    <p style="color: {BRAND_COLORS['text_secondary']}; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0; word-break: break-all;">
        Or copy and paste this link into your browser:<br>
        <a href="{verification_url}" style="color: {BRAND_COLORS['primary']}; text-decoration: none;">{verification_url}</a>
    </p>
    
    {create_info_box('If you didn\'t create an account with {tenant_name}, please ignore this email.', 'warning')}
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 25px 0 0 0;">
        Best regards,<br>
        <strong>The {tenant_name} Team</strong>
    </p>
    """
    
    template = get_email_template_base()
    return template.replace('{CONTENT_PLACEHOLDER}', content).replace('{YEAR_PLACEHOLDER}', str(year))


def render_account_recovery_email(user, tenant_name):
    """Render account recovery success email template"""
    from datetime import datetime
    year = datetime.now().year
    
    content = f"""
    <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 80px; height: 80px; background-color: {BRAND_COLORS['success']}; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 40px;">✓</span>
        </div>
    </div>
    
    <h2 style="color: {BRAND_COLORS['text_primary']}; margin: 0 0 20px 0; font-size: 24px; font-weight: 600; text-align: center;">
        Account Successfully Recovered!
    </h2>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 15px 0;">
        Hello <strong>{user.first_name} {user.last_name}</strong>,
    </p>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Great news! Your account for <strong>{tenant_name}</strong> has been successfully recovered and reactivated.
    </p>
    
    {create_info_box('All your data has been preserved and your account is now fully active. You can continue using all features immediately.', 'success')}
    
    <p style="color: {BRAND_COLORS['text_secondary']}; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
        If you have any questions or need assistance, feel free to contact our support team.
    </p>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 25px 0 0 0;">
        Best regards,<br>
        <strong>The {BRAND_NAME} Team</strong>
    </p>
    """
    
    template = get_email_template_base()
    return template.replace('{CONTENT_PLACEHOLDER}', content).replace('{YEAR_PLACEHOLDER}', str(year))


def render_invitation_email(invited_user, inviter_name, tenant_name, temp_password, frontend_url):
    """Render user invitation email template"""
    from datetime import datetime
    year = datetime.now().year
    
    content = f"""
    <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 80px; height: 80px; background-color: {BRAND_COLORS['primary']}; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 40px;">👋</span>
        </div>
    </div>
    
    <h2 style="color: {BRAND_COLORS['text_primary']}; margin: 0 0 20px 0; font-size: 24px; font-weight: 600; text-align: center;">
        You've Been Invited!
    </h2>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 15px 0;">
        Hello <strong>{invited_user.first_name} {invited_user.last_name}</strong>,
    </p>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        You have been invited by <strong>{inviter_name}</strong> to join <strong>{tenant_name}</strong>'s HR Management System.
    </p>
    
    {create_info_box('Your account has been created! Use the credentials below to log in. You will be required to change your password on first login.', 'info')}
    
    <table role="presentation" style="width: 100%; margin: 20px 0; border-collapse: collapse; background-color: {BRAND_COLORS['primary_light']}; border-radius: 8px; padding: 20px;">
        <tr>
            <td style="padding: 15px; border-bottom: 1px solid {BRAND_COLORS['border']};">
                <strong style="color: {BRAND_COLORS['text_primary']};">Email:</strong>
                <span style="color: {BRAND_COLORS['text_secondary']}; margin-left: 10px; display: block; margin-top: 5px;">{invited_user.email}</span>
            </td>
        </tr>
        <tr>
            <td style="padding: 15px;">
                <strong style="color: {BRAND_COLORS['text_primary']};">Temporary Password:</strong>
                <div style="background-color: white; border: 2px solid {BRAND_COLORS['primary']}; border-radius: 6px; padding: 12px; margin-top: 8px;">
                    <span style="color: {BRAND_COLORS['primary']}; font-size: 18px; font-weight: 700; letter-spacing: 2px; font-family: 'Courier New', monospace;">
                        {temp_password}
                    </span>
                </div>
            </td>
        </tr>
    </table>
    
    {create_button("Login to Your Account", f"{frontend_url}/login", BRAND_COLORS['primary'])}
    
    {create_info_box('IMPORTANT: You will be required to change your password when you first log in for security purposes.', 'warning')}
    
    <p style="color: {BRAND_COLORS['text_secondary']}; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
        If you have any questions, please contact your administrator.
    </p>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 25px 0 0 0;">
        Best regards,<br>
        <strong>{inviter_name}</strong><br>
        <span style="color: {BRAND_COLORS['text_secondary']};">{tenant_name}</span>
    </p>
    """
    
    template = get_email_template_base()
    return template.replace('{CONTENT_PLACEHOLDER}', content).replace('{YEAR_PLACEHOLDER}', str(year))


def render_company_signup_email(user, tenant_name, temp_password, frontend_url):
    """Render company account creation email template with credentials"""
    from datetime import datetime
    year = datetime.now().year
    
    content = f"""
    <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 80px; height: 80px; background-color: {BRAND_COLORS['success']}; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 40px;">✓</span>
        </div>
    </div>
    
    <h2 style="color: {BRAND_COLORS['text_primary']}; margin: 0 0 20px 0; font-size: 24px; font-weight: 600; text-align: center;">
        Welcome to {BRAND_NAME}!
    </h2>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 15px 0;">
        Hello <strong>{user.first_name} {user.last_name}</strong>,
    </p>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Your company account for <strong>{tenant_name}</strong> has been created successfully! We're excited to have you join {BRAND_NAME} HR Management System.
    </p>
    
    {create_info_box('Your account is ready to use! Use the credentials below to log in. You will be required to change your password on first login.', 'success')}
    
    <table role="presentation" style="width: 100%; margin: 20px 0; border-collapse: collapse; background-color: {BRAND_COLORS['primary_light']}; border-radius: 8px; padding: 20px;">
        <tr>
            <td style="padding: 15px; border-bottom: 1px solid {BRAND_COLORS['border']};">
                <strong style="color: {BRAND_COLORS['text_primary']};">Email:</strong>
                <span style="color: {BRAND_COLORS['text_secondary']}; margin-left: 10px; display: block; margin-top: 5px;">{user.email}</span>
            </td>
        </tr>
        <tr>
            <td style="padding: 15px;">
                <strong style="color: {BRAND_COLORS['text_primary']};">Temporary Password:</strong>
                <div style="background-color: white; border: 2px solid {BRAND_COLORS['primary']}; border-radius: 6px; padding: 12px; margin-top: 8px;">
                    <span style="color: {BRAND_COLORS['primary']}; font-size: 18px; font-weight: 700; letter-spacing: 2px; font-family: 'Courier New', monospace;">
                        {temp_password}
                    </span>
                </div>
            </td>
        </tr>
    </table>
    
    {create_button("Login to Your Account", f"{frontend_url}/login", BRAND_COLORS['primary'])}
    
    {create_info_box('IMPORTANT: You will be required to change your password when you first log in for security purposes.', 'warning')}
    
    <p style="color: {BRAND_COLORS['text_secondary']}; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
        If you have any questions or need assistance, please contact our support team.
    </p>
    
    <p style="color: {BRAND_COLORS['text_primary']}; font-size: 15px; line-height: 1.6; margin: 25px 0 0 0;">
        Best regards,<br>
        <strong>The {BRAND_NAME} Team</strong>
    </p>
    """
    
    template = get_email_template_base()
    return template.replace('{CONTENT_PLACEHOLDER}', content).replace('{YEAR_PLACEHOLDER}', str(year))


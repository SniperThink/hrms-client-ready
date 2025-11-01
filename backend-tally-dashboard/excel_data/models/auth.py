from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager, Group, Permission
from django.utils import timezone
from django.utils.timezone import timedelta
from django.utils.translation import gettext_lazy as _
import uuid

from .tenant import TenantAwareModel


class ActiveSession(models.Model):
    """Track active sessions by IP address to prevent multiple logins from same IP"""
    ip_address = models.GenericIPAddressField(help_text="Client IP address")
    user = models.ForeignKey('CustomUser', on_delete=models.CASCADE, related_name='active_sessions')
    session_key = models.CharField(max_length=40, help_text="Django session key")
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)
    user_agent = models.TextField(blank=True, null=True, help_text="User agent string")
    is_active = models.BooleanField(default=True, help_text="Whether the session is active")
    
    class Meta:
        app_label = 'excel_data'
        unique_together = ['ip_address', 'user']
        indexes = [
            models.Index(fields=['ip_address', '-last_activity']),
            models.Index(fields=['user', '-last_activity']),
        ]
    
    def is_expired(self, expiry_minutes=30):
        """Check if session is expired"""
        return timezone.now() > self.last_activity + timedelta(minutes=expiry_minutes)
    
    def __str__(self):
        return f"{self.user.email} from {self.ip_address}"


class UserPermissions(models.Model):
    """User permissions for granular access control"""
    can_view = models.BooleanField(default=True, help_text="Can view data and reports")
    can_modify = models.BooleanField(default=False, help_text="Can modify data and settings")
    can_invite_users = models.BooleanField(default=False, help_text="Can invite new team members")
    can_manage_payroll = models.BooleanField(default=False, help_text="Can manage payroll data")
    can_export_data = models.BooleanField(default=False, help_text="Can export company data")
    
    class Meta:
        app_label = 'excel_data'
        db_table = 'user_permissions'


class CustomUserManager(BaseUserManager):
    """
    Custom user manager for CustomUser model
    """
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        # Remove username from extra_fields if it exists
        extra_fields.pop('username', None)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        # Remove username from extra_fields if it exists
        extra_fields.pop('username', None)
        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractUser):
    """Custom user model with tenant isolation and role-based permissions"""
    
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('hr_manager', 'HR Manager'),
        ('supervisor', 'Supervisor'),
        ('employee', 'Employee'),
    ]
    
    username = None  # Remove username field
    email = models.EmailField(unique=True, help_text="User's email address")
    tenant = models.ForeignKey(
        'excel_data.Tenant', 
        on_delete=models.CASCADE, 
        related_name='users',
        null=True, 
        blank=True,
        help_text="Company this user belongs to"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee')
    email_verified = models.BooleanField(default=False, help_text="Whether the user's email has been verified")
    permissions = models.OneToOneField(
        UserPermissions, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='user'
    )
    is_invited = models.BooleanField(default=False, help_text="User was invited by admin")
    invitation_token = models.UUIDField(default=None, null=True, blank=True)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    must_change_password = models.BooleanField(default=False, help_text="User must change password on next login")
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    
    objects = CustomUserManager()
    
    class Meta:
        app_label = 'excel_data'
        db_table = 'users'
        
    def save(self, *args, **kwargs):
        # Create default permissions if not exists
        if not self.permissions:
            permissions = UserPermissions.objects.create(
                can_view=True,
                can_modify=self.role in ['admin', 'hr_manager'],
                can_invite_users=self.role in ['admin'],
                can_manage_payroll=self.role in ['admin', 'hr_manager'],
                can_export_data=self.role in ['admin', 'hr_manager']
            )
            self.permissions = permissions
        super().save(*args, **kwargs)
    
    # Session management fields for single-login enforcement
    current_session_key = models.CharField(max_length=40, blank=True, null=True, help_text="Current active session key")
    session_created_at = models.DateTimeField(blank=True, null=True, help_text="When the current session was created")

    def is_session_active(self):
        """Check if current session is still active (5-minute expiry for improper logout)"""
        if not self.current_session_key or not self.session_created_at:
            return False
        # Expire after 5 minutes if not logged out properly
        return timezone.now() < self.session_created_at + timedelta(minutes=5)
    
    def clear_session(self):
        """Clear current session data"""
        self.current_session_key = None
        self.session_created_at = None
        self.save(update_fields=['current_session_key', 'session_created_at'])
    
    def set_session(self, session_key):
        """Set new session data"""
        self.current_session_key = session_key
        self.session_created_at = timezone.now()
        self.save(update_fields=['current_session_key', 'session_created_at'])
        
    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"


class InvitationToken(models.Model):
    """Model to track invitation tokens for user invitations"""
    email = models.EmailField()
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    tenant = models.ForeignKey('excel_data.Tenant', on_delete=models.CASCADE, related_name='invitations')
    invited_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_invitations')
    role = models.CharField(max_length=20, choices=CustomUser.ROLE_CHOICES, default='employee')
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    
    class Meta:
        app_label = 'excel_data'
        unique_together = ['email', 'tenant']
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Invitation for {self.email} to {self.tenant.name}"
    
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at


class PasswordResetOTP(models.Model):
    """Model to track OTP codes for password reset"""
    email = models.EmailField()
    otp_code = models.CharField(max_length=6)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    
    class Meta:
        app_label = 'excel_data'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"OTP for {self.email} - {self.otp_code}"
    
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at
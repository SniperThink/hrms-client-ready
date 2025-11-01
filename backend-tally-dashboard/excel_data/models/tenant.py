from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from ..utils.utils import get_current_tenant
import logging
import pytz

logger = logging.getLogger(__name__)


class Tenant(models.Model):
    """
    Tenant model for multi-tenant support
    """
    name = models.CharField(max_length=255, help_text="Organization/Company name")
    subdomain = models.CharField(max_length=100, unique=True, blank=True, null=True, help_text="Unique subdomain identifier (optional)")
    custom_domain = models.CharField(max_length=255, blank=True, null=True, help_text="Custom domain if any")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Tenant settings
    max_employees = models.IntegerField(default=1000, help_text="Maximum number of employees allowed")
    timezone = models.CharField(max_length=50, default='UTC')
    
    # Credit and Billing Information
    credits = models.PositiveIntegerField(default=0, help_text="Available credits for this tenant")
    is_active = models.BooleanField(default=True, help_text="Whether the tenant is active (has credits > 0 and is not manually deactivated)")
    
    # Billing information (for future use)
    plan = models.CharField(max_length=50, default='free', choices=[
        ('free', 'Free'),
        ('premium', 'Premium'),
        ('enterprise', 'Enterprise')
    ])
    
    # Auto-calculate payroll setting
    auto_calculate_payroll = models.BooleanField(
        default=False,
        help_text="Automatically calculate payroll on 1st of each month for previous month"
    )
    
    class Meta:
        app_label = 'excel_data'
        verbose_name = _('tenant')
        verbose_name_plural = _('tenants')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.subdomain}) - Credits: {self.credits}"
        
    def get_ist_time(self):
        """Get current time in Indian Standard Time"""
        ist = pytz.timezone('Asia/Kolkata')
        return timezone.now().astimezone(ist)
        
    def deduct_daily_credit(self):
        """Deduct 1 credit if it's a new day in IST and credits are available"""
        from excel_data.models.auth import CustomUser
        
        now_ist = self.get_ist_time()
        last_updated_ist = self.updated_at.astimezone(pytz.timezone('Asia/Kolkata')) if self.updated_at else None
        
        should_deduct = (
            last_updated_ist is None or 
            last_updated_ist.date() < now_ist.date()
        )
        
        if should_deduct and self.credits > 0:
            with transaction.atomic():
                # Use select_for_update to prevent race conditions
                tenant = Tenant.objects.select_for_update().get(pk=self.pk)
                if tenant.credits > 0:
                    tenant.credits -= 1
                    
                    # Deactivate tenant if no credits left
                    if tenant.credits == 0:
                        tenant.is_active = False
                        # Deactivate all users for this tenant
                        CustomUser.objects.filter(tenant=tenant).update(is_active=False)
                        logger.info(f"Tenant {tenant.name} deactivated due to zero credits")
                    
                    # Save will automatically update the updated_at field
                    tenant.save(update_fields=['credits', 'is_active', 'updated_at'])
                    logger.debug(f"Deducted 1 credit from tenant {tenant.name}. Remaining: {tenant.credits}")
                    return True
        return False
    
    def add_credits(self, amount):
        """Add credits to tenant and reactivate if needed"""
        if amount <= 0:
            return False
            
        with transaction.atomic():
            # Use select_for_update to prevent race conditions
            tenant = Tenant.objects.select_for_update().get(pk=self.pk)
            was_inactive = not tenant.is_active
            
            tenant.credits += amount
            
            # Reactivate tenant if credits were added to a deactivated account
            if was_inactive and tenant.credits > 0:
                tenant.is_active = True
                from excel_data.models.auth import CustomUser
                # Reactivate all users for this tenant
                CustomUser.objects.filter(tenant=tenant).update(is_active=True)
                logger.info(f"Tenant {tenant.name} reactivated with {amount} credits")
            
            tenant.save(update_fields=['credits', 'is_active'])
            logger.info(f"Added {amount} credits to tenant {tenant.name}. Total: {tenant.credits}")
            return True


class TenantAwareManager(models.Manager):
    """
    Manager that automatically filters by current tenant
    """
    def get_queryset(self):
        tenant = get_current_tenant()
        if tenant:
            return super().get_queryset().filter(tenant=tenant)
        return super().get_queryset()


class TenantAwareModel(models.Model):
    """
    Abstract base model that automatically adds tenant to all models
    """
    tenant = models.ForeignKey('excel_data.Tenant', on_delete=models.CASCADE, related_name='%(class)s_set')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = TenantAwareManager()
    all_objects = models.Manager()  # Access all objects regardless of tenant
    
    class Meta:
        abstract = True
        app_label = 'excel_data'
    
    def save(self, *args, **kwargs):
        if not self.tenant_id:
            self.tenant = get_current_tenant()
        super().save(*args, **kwargs)
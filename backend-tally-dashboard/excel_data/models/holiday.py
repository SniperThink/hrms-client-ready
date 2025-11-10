from django.db import models
from django.utils import timezone
from django.conf import settings
from .tenant import TenantAwareModel


class Holiday(TenantAwareModel):
    """Holiday model for tracking organization holidays"""
    
    HOLIDAY_TYPE_CHOICES = [
        ('NATIONAL', 'National Holiday'),
        ('REGIONAL', 'Regional Holiday'),
        ('COMPANY', 'Company Holiday'),
        ('FESTIVAL', 'Festival'),
        ('OTHER', 'Other'),
    ]
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_holidays',
        help_text="User who created this holiday"
    )
    
    name = models.CharField(max_length=200, help_text="Holiday name")
    date = models.DateField(help_text="Holiday date")
    holiday_type = models.CharField(
        max_length=20,
        choices=HOLIDAY_TYPE_CHOICES,
        default='COMPANY',
        help_text="Type of holiday"
    )
    description = models.TextField(blank=True, null=True, help_text="Holiday description")
    is_active = models.BooleanField(default=True, help_text="Whether this holiday is active")
    
    # Optional: Specific to certain departments
    applies_to_all = models.BooleanField(
        default=True,
        help_text="If False, specify departments this holiday applies to"
    )
    specific_departments = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Comma-separated department names (if not applies_to_all)"
    )
    
    class Meta:
        app_label = 'excel_data'
        verbose_name = 'Holiday'
        verbose_name_plural = 'Holidays'
        ordering = ['-date']
        unique_together = ['tenant', 'date', 'name']
        indexes = [
            models.Index(fields=['tenant', 'date']),
            models.Index(fields=['date', 'is_active']),
            models.Index(fields=['tenant', 'date', 'is_active']),
        ]
        db_table = 'holidays'
    
    def __str__(self):
        return f"{self.name} - {self.date} ({self.tenant.name if self.tenant else 'No Tenant'})"
    
    @property
    def is_past(self):
        """Check if holiday is in the past"""
        return self.date < timezone.now().date()
    
    def applies_to_department(self, department_name):
        """Check if holiday applies to a specific department"""
        if self.applies_to_all:
            return True
        if not self.specific_departments:
            return False
        departments = [d.strip() for d in self.specific_departments.split(',')]
        return department_name in departments


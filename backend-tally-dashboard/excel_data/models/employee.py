from django.db import models
from django.conf import settings
from .tenant import TenantAwareModel
from datetime import datetime, timedelta
import uuid


class EmployeeProfile(TenantAwareModel):
    # Personal Information
    first_name = models.CharField(max_length=100)  # Mandatory
    last_name = models.CharField(max_length=100, blank=True, null=True)   # Optional
    mobile_number = models.CharField(max_length=20, blank=True, null=True)  # Optional
    email = models.EmailField(max_length=100, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    
    MARITAL_STATUS_CHOICES = [
        ('SINGLE', 'Single'),
        ('MARRIED', 'Married'),
        ('DIVORCED', 'Divorced'),
        ('WIDOWED', 'Widowed'),
    ]
    marital_status = models.CharField(max_length=20, choices=MARITAL_STATUS_CHOICES, blank=True, null=True)
    
    GENDER_CHOICES = [
        ('MALE', 'Male'),
        ('FEMALE', 'Female'),
        ('OTHER', 'Other'),
    ]
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True)
    
    nationality = models.CharField(max_length=50, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=50, blank=True, null=True)
    state = models.CharField(max_length=50, blank=True, null=True)
    
    # Professional Information - All optional except shift times and basic salary
    department = models.CharField(max_length=100, blank=True, null=True)
    designation = models.CharField(max_length=100, blank=True, null=True)
    
    EMPLOYMENT_TYPE_CHOICES = [
        ('FULL_TIME', 'Full Time'),
        ('PART_TIME', 'Part Time'),
        ('CONTRACT', 'Contract'),
        ('INTERN', 'Intern'),
    ]
    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_TYPE_CHOICES, blank=True, null=True)
    
    date_of_joining = models.DateField(blank=True, null=True)
    location_branch = models.CharField(max_length=100, blank=True, null=True)
    shift_start_time = models.TimeField(default='09:00')  # Mandatory
    shift_end_time = models.TimeField(default='18:00')    # Mandatory
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # Mandatory
    tds_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0, blank=True, null=True)
    
    # Off Days
    off_monday = models.BooleanField(default=False)
    off_tuesday = models.BooleanField(default=False)
    off_wednesday = models.BooleanField(default=False)
    off_thursday = models.BooleanField(default=False)
    off_friday = models.BooleanField(default=False)
    off_saturday = models.BooleanField(default=False)
    off_sunday = models.BooleanField(default=True)  # Sunday is commonly off
    
    # System fields
    employee_id = models.CharField(max_length=50, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    # Date when the employee was marked inactive
    inactive_marked_at = models.DateField(blank=True, null=True)
    ot_charge_per_hour = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Weekly rules - employee-specific override
    # Only applicable if tenant weekly_absent_penalty_enabled is True
    weekly_rules_enabled = models.BooleanField(
        default=True,
        help_text="Enable weekly penalty rules for this employee (only applicable if tenant weekly rules are enabled)"
    )

    class Meta:
        app_label = 'excel_data'
        unique_together = ['tenant', 'employee_id']
        ordering = ['first_name', 'last_name']
        managed = True
        db_table = 'excel_data_employeeprofile'
        indexes = [
            models.Index(fields=['tenant', 'is_active'], name='employee_active_idx'),
            models.Index(fields=['tenant', 'employee_id'], name='employee_id_idx'),
            models.Index(fields=['is_active', 'employee_id'], name='employee_lookup_idx'),
        ]

    def _calculate_shift_hours(self):
        """Calculate shift duration in hours from shift_start_time to shift_end_time, minus break time"""
        if not self.shift_start_time or not self.shift_end_time:
            return 0
        
        # Convert time objects to datetime for calculation
        start_dt = datetime.combine(datetime.today().date(), self.shift_start_time)
        end_dt = datetime.combine(datetime.today().date(), self.shift_end_time)
        
        # Handle overnight shifts (end time before start time means next day)
        if end_dt <= start_dt:
            end_dt += timedelta(days=1)
        
        # Calculate difference in hours
        delta = end_dt - start_dt
        raw_shift_hours = delta.total_seconds() / 3600  # Convert to hours
        
        # Subtract break time from shift hours
        from ..utils.utils import get_break_time
        break_time = get_break_time(self.tenant)
        effective_shift_hours = max(0, raw_shift_hours - break_time)
        
        return effective_shift_hours
    
    def _calculate_working_days_for_month(self, year=None, month=None):
        """Calculate working days for a given month based on off days"""
        from calendar import monthrange
        from datetime import date
        
        # Use current month if not specified
        if year is None or month is None:
            now = date.today()
            year = now.year
            month = now.month
        elif isinstance(month, str):
            # Convert month name to number if needed
            month_names = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                          'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
            try:
                month = month_names.index(month.upper()) + 1
            except ValueError:
                month = date.today().month
        
        total_days = monthrange(year, month)[1]
        month_start = date(year, month, 1)
        month_end = date(year, month, total_days)
        
        # Build off-day set
        off_days = set()
        if self.off_monday: off_days.add(0)
        if self.off_tuesday: off_days.add(1)
        if self.off_wednesday: off_days.add(2)
        if self.off_thursday: off_days.add(3)
        if self.off_friday: off_days.add(4)
        if self.off_saturday: off_days.add(5)
        if self.off_sunday: off_days.add(6)
        
        # Calculate working days excluding off days
        working_days = 0
        current_date = month_start
        while current_date <= month_end:
            if current_date.weekday() not in off_days:
                working_days += 1
            current_date += timedelta(days=1)
        
        return working_days
    
    def save(self, *args, **kwargs):
        # Generate employee_id if not provided
        if not self.employee_id and self.first_name and self.last_name and self.tenant_id:
            from ..utils.utils import generate_employee_id
            full_name = f"{self.first_name} {self.last_name}"
            self.employee_id = generate_employee_id(full_name, self.tenant_id, self.department)
        
        # Auto-calculate OT charge per hour using STATIC formula: basic_salary / ((shift_hours - break_time) × AVERAGE_DAYS_PER_MONTH)
        # Formula: OT Charge per Hour = basic_salary / ((shift_end_time - shift_start_time - break_time) × AVERAGE_DAYS_PER_MONTH)
        # Using AVERAGE_DAYS_PER_MONTH and break_time from settings for consistent OT rates across all months
        # Only auto-calculate if OT charge is not already provided (preserves manual entries)
        if not self.ot_charge_per_hour and self.shift_start_time and self.shift_end_time and self.basic_salary:
            # Calculate (end_time - start_time - break_time) in hours
            shift_hours_per_day = self._calculate_shift_hours()  # This is (shift_end_time - shift_start_time - break_time)
            
            # OT Charge per Hour = basic_salary / ((shift_hours - break_time) × AVERAGE_DAYS_PER_MONTH)
            if shift_hours_per_day > 0:
                from decimal import Decimal
                from ..utils.utils import get_average_days_per_month
                # Convert both values to Decimal to avoid type mismatch
                basic_salary_decimal = Decimal(str(self.basic_salary))
                shift_hours_decimal = Decimal(str(shift_hours_per_day))
                average_days = Decimal(str(get_average_days_per_month(self.tenant)))
                self.ot_charge_per_hour = basic_salary_decimal / (shift_hours_decimal * average_days)
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.employee_id})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class BulkUpdateLog(TenantAwareModel):
    """
    Audit trail for bulk update operations on employees.
    Stores old values to enable reverting changes.
    """
    action_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='bulk_updates'
    )
    performed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    ACTION_TYPE_CHOICES = [
        ('bulk_update', 'Bulk Update'),
        ('activate', 'Activate Employees'),
        ('deactivate', 'Deactivate Employees'),
        ('delete', 'Delete Employees'),
    ]
    action_type = models.CharField(max_length=50, choices=ACTION_TYPE_CHOICES)
    employee_count = models.IntegerField()
    
    # JSON field to store the changes
    # Format: {
    #     'employee_ids': [1, 2, 3],
    #     'old_values': [{'id': 1, 'department': 'Sales', ...}, ...],
    #     'new_values': {'department': 'Engineering', ...}
    # }
    changes = models.JSONField()
    
    # Revert tracking
    reverted = models.BooleanField(default=False, db_index=True)
    reverted_at = models.DateTimeField(null=True, blank=True)
    reverted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bulk_update_reverts'
    )
    
    class Meta:
        ordering = ['-performed_at']
        indexes = [
            models.Index(fields=['-performed_at', 'tenant']),
            models.Index(fields=['action_id']),
            models.Index(fields=['reverted', 'tenant']),
        ]
    
    def __str__(self):
        return f"{self.action_type} - {self.employee_count} employees - {self.performed_at}"
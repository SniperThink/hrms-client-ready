from django.db import models
from .tenant import TenantAwareModel


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

    def save(self, *args, **kwargs):
        # Generate employee_id if not provided
        if not self.employee_id and self.first_name and self.last_name and self.tenant_id:
            from ..utils.utils import generate_employee_id
            full_name = f"{self.first_name} {self.last_name}"
            self.employee_id = generate_employee_id(full_name, self.tenant_id, self.department)
        
        # Auto-calculate OT charge per hour (basic_salary / 240 hours)
        if self.basic_salary:
            self.ot_charge_per_hour = self.basic_salary / 240
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.employee_id})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
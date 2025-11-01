from django.db import models
from decimal import Decimal
from .tenant import TenantAwareModel


class DataSource(models.TextChoices):
    """Enum for tracking data sources"""
    UPLOADED = 'UPLOADED', 'Uploaded Data'
    FRONTEND = 'FRONTEND', 'Frontend Tracked'
    HYBRID = 'HYBRID', 'Mixed Sources'


class PayrollPeriod(TenantAwareModel):
    """
    Represents a payroll period (month/year) and tracks whether it uses uploaded or calculated data
    """
    year = models.IntegerField()
    month = models.CharField(max_length=20)
    data_source = models.CharField(max_length=20, choices=DataSource.choices, default=DataSource.FRONTEND)
    is_locked = models.BooleanField(default=False, help_text="Locked periods cannot be modified")
    calculation_date = models.DateTimeField(auto_now_add=True)
    
    # Payroll settings for this period
    working_days_in_month = models.IntegerField(default=25)
    tds_rate = models.DecimalField(max_digits=5, decimal_places=2, default=5.00, help_text="TDS percentage")
    
    class Meta:
        app_label = 'excel_data'
        unique_together = ['tenant', 'year', 'month']
        ordering = ['-year', '-month']
    
    def __str__(self):
        return f"{self.month} {self.year} - {self.get_data_source_display()}"


class CalculatedSalary(TenantAwareModel):
    """
    Autonomous salary calculation that combines attendance, advances, and employee data
    """
    payroll_period = models.ForeignKey('excel_data.PayrollPeriod', on_delete=models.CASCADE, related_name='calculated_salaries')
    employee_id = models.CharField(max_length=50, db_index=True)
    employee_name = models.CharField(max_length=255)
    department = models.CharField(max_length=100, blank=True, null=True)
    
    # Base salary information
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2)
    basic_salary_per_hour = models.DecimalField(max_digits=10, decimal_places=2)
    basic_salary_per_minute = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Employee-specific rates
    employee_ot_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Employee's OT rate per hour")
    employee_tds_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Employee's TDS percentage")
    
    # Attendance data (from Attendance model or uploaded data)
    total_working_days = models.IntegerField(default=0)
    present_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    absent_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    ot_hours = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    late_minutes = models.IntegerField(default=0)
    
    # Calculated amounts
    salary_for_present_days = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    ot_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    late_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    incentive = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Tax calculations
    tds_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    salary_after_tds = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Advance management
    total_advance_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Total pending advance")
    advance_deduction_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Amount to deduct this month")
    advance_deduction_editable = models.BooleanField(default=True, help_text="Admin can modify deduction amount")
    remaining_advance_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Final calculation
    net_payable = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Tracking
    data_source = models.CharField(max_length=20, choices=DataSource.choices, default=DataSource.FRONTEND)
    calculation_timestamp = models.DateTimeField(auto_now=True)
    is_paid = models.BooleanField(default=False)
    payment_date = models.DateField(null=True, blank=True)
    
    class Meta:
        app_label = 'excel_data'
        unique_together = ['tenant', 'payroll_period', 'employee_id']
        ordering = ['-payroll_period__year', '-payroll_period__month', 'employee_name']
    
    def save(self, *args, **kwargs):
        """Auto-calculate salary components unless explicitly skipped or data source is UPLOADED.
        Set an instance attribute `_skip_auto_calc = True` before saving to bypass.
        Skip auto-calculation for UPLOADED data since it's already calculated.
        """
        if not getattr(self, '_skip_auto_calc', False) and self.data_source != DataSource.UPLOADED:
            self.calculate_salary()
        super().save(*args, **kwargs)
    
    def calculate_salary(self):
        """Autonomous salary calculation logic using standardized formula:
        Gross Salary = (Base Salary ÷ Working Days × Present Days) + OT Charges - Late Deduction
        """
        # 1. Calculate salary for present days using standardized formula
        if self.total_working_days > 0:
            daily_salary = self.basic_salary / self.total_working_days
            self.salary_for_present_days = daily_salary * self.present_days
        else:
            self.salary_for_present_days = self.basic_salary
        
        # 2. Calculate OT charges using employee-specific OT rate
        if self.employee_ot_rate > 0:
            self.ot_charges = self.employee_ot_rate * self.ot_hours
        elif self.basic_salary_per_hour > 0:
            # Fallback to basic salary per hour calculation
            self.ot_charges = self.basic_salary_per_hour * self.ot_hours
        else:
            # No OT rate available - calculate from basic salary
            if self.total_working_days > 0:
                # Calculate hourly rate from basic salary (assuming 8 hours per day)
                hourly_rate = self.basic_salary / (self.total_working_days * Decimal('8'))
                self.ot_charges = hourly_rate * self.ot_hours
            else:
                self.ot_charges = Decimal('0')
        
        # 3. Calculate late deduction using standardized approach
        # Use OT rate per minute for consistency across all calculation methods
        if self.employee_ot_rate > 0:
            late_deduction_per_minute = self.employee_ot_rate / Decimal('60')
        elif self.basic_salary_per_minute > 0:
            late_deduction_per_minute = self.basic_salary_per_minute
        else:
            # No OT rate available - calculate from basic salary
            if self.total_working_days > 0:
                # Calculate hourly rate from basic salary (assuming 8 hours per day)
                hourly_rate = self.basic_salary / (self.total_working_days * Decimal('8'))
                late_deduction_per_minute = hourly_rate / Decimal('60')
            else:
                late_deduction_per_minute = Decimal('0')
        self.late_deduction = late_deduction_per_minute * self.late_minutes
        
        # 4. Calculate gross salary using standardized formula
        # Note: Incentive is moved to a separate field and not included in gross salary
        self.gross_salary = self.salary_for_present_days + self.ot_charges - self.late_deduction
        
        # 5. Calculate TDS using employee-specific TDS rate
        # TDS is calculated on gross salary + incentive
        if self.employee_tds_rate > 0:
            tds_rate = self.employee_tds_rate / 100
        else:
            # Fallback to period TDS rate
            tds_rate = self.payroll_period.tds_rate / 100
        
        # TDS is calculated on gross salary + incentive
        taxable_amount = self.gross_salary + self.incentive
        self.tds_amount = taxable_amount * tds_rate
        self.salary_after_tds = taxable_amount - self.tds_amount
        
        # 6. Calculate advance deduction
        if not self.advance_deduction_editable or self.advance_deduction_amount == 0:
            # Auto-calculate: deduct up to 50% of net salary or remaining balance, whichever is lower
            max_deduction = self.salary_after_tds * Decimal('0.5')
            # Ensure we don't deduct more than the salary itself or more than available advance
            self.advance_deduction_amount = min(max_deduction, self.total_advance_balance, self.salary_after_tds)
        
        # 7. Calculate remaining advance balance
        self.remaining_advance_balance = self.total_advance_balance - self.advance_deduction_amount
        
        # 8. Calculate final net payable (ensure it's never negative)
        self.net_payable = max(Decimal('0'), self.salary_after_tds - self.advance_deduction_amount)
    
    def __str__(self):
        return f"{self.employee_name} - {self.payroll_period}"


class SalaryAdjustment(TenantAwareModel):
    """
    Manual adjustments to calculated salaries
    """
    calculated_salary = models.ForeignKey(CalculatedSalary, on_delete=models.CASCADE, related_name='adjustments')
    adjustment_type = models.CharField(max_length=50, choices=[
        ('INCENTIVE', 'Incentive'),
        ('DEDUCTION', 'Deduction'),
        ('ADVANCE_OVERRIDE', 'Advance Deduction Override'),
        ('BONUS', 'Bonus'),
        ('PENALTY', 'Penalty')
    ])
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    created_by = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        app_label = 'excel_data'
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Recalculate the salary after adjustment
        self.calculated_salary.save()
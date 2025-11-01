from django.db import models
from .tenant import TenantAwareModel


class SalaryData(TenantAwareModel):
    """
    Simplified Salary Data model following exact template structure:
    [NAME, SALARY, ABSENT, DAYS, SL W/O OT, OT, HOUR RS, OT CHARGES, LATE, LATE CHARGE, AMT, SAL+OT, 25TH ADV, OLD ADV, NETT PAYABLE, Department, Total old ADV, Balnce Adv, INCENTIVE, TDS, SAL-TDS, ADVANCE]
    
    Note: 
    - OT CHARGES = Overtime payment (added to salary)
    - LATE CHARGE = Late deduction (deducted from salary)
    """
    # Basic Information
    year = models.IntegerField(null=True, blank=True)
    month = models.CharField(max_length=20, null=True, blank=True)
    date = models.DateField(null=True, blank=True)
    
    # Template Fields (exact column names)
    name = models.CharField(max_length=100, verbose_name="NAME")
    salary = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="SALARY") 
    absent = models.IntegerField(default=0, verbose_name="ABSENT")
    days = models.IntegerField(default=0, verbose_name="DAYS")
    sl_wo_ot = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="SL W/O OT")
    ot = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="OT")
    hour_rs = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="HOUR RS")
    charges = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="OT CHARGES")  # Overtime payment
    late = models.IntegerField(default=0, verbose_name="LATE")
    charge = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="LATE CHARGE")  # Late deduction
    amt = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="AMT")
    sal_ot = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="SAL+OT")
    adv_25th = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="25TH ADV")
    old_adv = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="OLD ADV")
    nett_payable = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="NETT PAYABLE")
    department = models.CharField(max_length=100, verbose_name="Department")
    total_old_adv = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Total old ADV")
    balnce_adv = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Balnce Adv")
    incentive = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="INCENTIVE")
    tds = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="TDS")
    sal_tds = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="SAL-TDS")
    advance = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="ADVANCE")
    
    # Auto-generated fields
    employee_id = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        app_label = 'excel_data'
        unique_together = ['tenant', 'employee_id', 'year', 'month']
        ordering = ['-year', '-month', 'name']
        indexes = [
            models.Index(fields=['tenant', 'employee_id', '-year', '-month'], name='salary_lookup_idx'),
            models.Index(fields=['employee_id', '-year', '-month'], name='salary_employee_idx'),
            models.Index(fields=['tenant', '-year', '-month'], name='salary_period_idx'),
        ]

    def save(self, *args, **kwargs):
        # Auto-generate employee_id if not provided
        if not self.employee_id and self.name and self.tenant_id:
            from ..utils.utils import generate_employee_id
            self.employee_id = generate_employee_id(self.name, self.tenant_id, self.department)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} - {self.month} {self.year} ({self.tenant.subdomain if self.tenant else 'No Tenant'})"
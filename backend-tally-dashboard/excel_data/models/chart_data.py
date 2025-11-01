from django.db import models
from decimal import Decimal
from .tenant import TenantAwareModel


class ChartAggregatedData(TenantAwareModel):
    """
    Unified chart data aggregated from BOTH CalculatedSalary (frontend forms) 
    and SalaryData (Excel uploads).
    
    IMPORTANT: Contains ONLY fields that exist in CalculatedSalary or SalaryData.
    No additional fields - this is a pure aggregation layer.
    """
    # Employee Information (common to both sources)
    employee_id = models.CharField(max_length=50, db_index=True)
    employee_name = models.CharField(max_length=255)
    department = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    
    # Period Information
    year = models.IntegerField(db_index=True)
    month = models.CharField(max_length=20, db_index=True)  # Short name: JAN, FEB, MAR, etc.
    period_key = models.CharField(max_length=50, db_index=True)  # Format: "JAN-2025"
    payroll_period = models.ForeignKey(
        'excel_data.PayrollPeriod', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='chart_data'
    )
    
    # Salary Components (exist in both models)
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0, db_index=True)
    net_payable = models.DecimalField(max_digits=12, decimal_places=2, default=0, db_index=True)  # net_payable in CalculatedSalary, nett_payable in SalaryData
    
    # Attendance Data (exist in both models)
    present_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    absent_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    total_working_days = models.IntegerField(default=30)
    attendance_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # Calculated
    
    # OT and Late (exist in both models)
    ot_hours = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    ot_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # charges field in SalaryData
    late_minutes = models.IntegerField(default=0)
    late_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # charge field in SalaryData
    
    # Deductions (exist in both models)
    tds_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # tds_amount/tds
    advance_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # advance_deduction_amount/advance
    total_advance_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # From original table
    
    # Incentive (exists in both models)
    incentive = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Tracking
    data_source = models.CharField(max_length=20, default='excel')
    aggregated_at = models.DateTimeField(auto_now=True)  # Match original table
    is_paid = models.BooleanField(default=False)  # From original table
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        app_label = 'excel_data'
        db_table = 'excel_data_chartaggregateddata'  # Use existing table name
        verbose_name = 'Chart Aggregated Data'
        verbose_name_plural = 'Chart Aggregated Data'
        unique_together = ['tenant', 'employee_id', 'year', 'month']
        ordering = ['-year', '-month', 'employee_name']
    
    def __str__(self):
        return f"{self.employee_name} - {self.month} {self.year} ({self.data_source})"
    
    def save(self, *args, **kwargs):
        """Auto-calculate attendance percentage"""
        if self.total_working_days > 0:
            self.attendance_percentage = (self.present_days / self.total_working_days) * 100
        else:
            self.attendance_percentage = 0
        super().save(*args, **kwargs)
    
    @classmethod
    def aggregate_from_salary_data(cls, salary_data):
        """
        Create/update ChartAggregatedData from SalaryData (Excel upload)
        
        Maps SalaryData fields to ChartAggregatedData:
        - name -> employee_name
        - salary -> basic_salary
        - days -> present_days
        - absent -> absent_days
        - charges -> ot_charges
        - charge -> late_charge
        - amt/sal_ot -> gross_salary
        - nett_payable -> net_payable
        - tds -> tds_amount
        - advance -> advance_deduction
        """
        from datetime import datetime
        
        # Standardize month to 3-letter abbreviation (JAN, FEB, MAR, etc.)
        MONTH_MAPPING = {
            'JANUARY': 'JAN', 'FEBRUARY': 'FEB', 'MARCH': 'MAR', 'APRIL': 'APR',
            'MAY': 'MAY', 'JUNE': 'JUN', 'JULY': 'JUL', 'AUGUST': 'AUG',
            'SEPTEMBER': 'SEP', 'OCTOBER': 'OCT', 'NOVEMBER': 'NOV', 'DECEMBER': 'DEC',
            'JAN': 'JAN', 'FEB': 'FEB', 'MAR': 'MAR', 'APR': 'APR',
            'JUN': 'JUN', 'JUL': 'JUL', 'AUG': 'AUG', 'SEP': 'SEP',
            'OCT': 'OCT', 'NOV': 'NOV', 'DEC': 'DEC'
        }
        month_short = MONTH_MAPPING.get(salary_data.month.upper(), 'JAN') if salary_data.month else 'JAN'
        
        # Calculate working days (Excel doesn't have this explicitly)
        # Use present + absent, or default to 30
        working_days = int(salary_data.days or 0) + int(salary_data.absent or 0)
        if working_days == 0:
            working_days = 30
        
        period_key = f"{month_short}-{salary_data.year}"
        
        chart_data, created = cls.objects.update_or_create(
            tenant=salary_data.tenant,
            employee_id=salary_data.employee_id,
            year=salary_data.year,
            month=month_short,
            defaults={
                'employee_name': salary_data.name,
                'department': salary_data.department or '',
                'period_key': period_key,
                'basic_salary': salary_data.salary or 0,
                'present_days': salary_data.days or 0,
                'absent_days': salary_data.absent or 0,
                'total_working_days': working_days,
                'ot_hours': salary_data.ot or 0,
                'ot_charges': salary_data.charges or 0,  # OT CHARGES column
                'late_minutes': salary_data.late or 0,
                'late_deduction': salary_data.charge or 0,  # LATE CHARGE column
                'gross_salary': salary_data.amt or salary_data.sal_ot or 0,
                'net_payable': salary_data.nett_payable or 0,
                'tds_amount': salary_data.tds or 0,
                'advance_deduction': salary_data.advance or 0,
                'total_advance_balance': salary_data.total_old_adv or 0,
                'incentive': salary_data.incentive or 0,
                'data_source': 'excel',
                'is_paid': False,
            }
        )
        return chart_data, created
    
    @classmethod
    def aggregate_from_calculated_salary(cls, calculated_salary):
        """
        Create/update ChartAggregatedData from CalculatedSalary (Frontend form)
        
        Direct mapping - fields match exactly
        """
        from datetime import datetime
        
        # Standardize month to 3-letter abbreviation (JAN, FEB, MAR, etc.)
        MONTH_MAPPING = {
            'JANUARY': 'JAN', 'FEBRUARY': 'FEB', 'MARCH': 'MAR', 'APRIL': 'APR',
            'MAY': 'MAY', 'JUNE': 'JUN', 'JULY': 'JUL', 'AUGUST': 'AUG',
            'SEPTEMBER': 'SEP', 'OCTOBER': 'OCT', 'NOVEMBER': 'NOV', 'DECEMBER': 'DEC',
            'JAN': 'JAN', 'FEB': 'FEB', 'MAR': 'MAR', 'APR': 'APR',
            'JUN': 'JUN', 'JUL': 'JUL', 'AUG': 'AUG', 'SEP': 'SEP',
            'OCT': 'OCT', 'NOV': 'NOV', 'DEC': 'DEC'
        }
        month_name = calculated_salary.payroll_period.month.upper()
        month_short = MONTH_MAPPING.get(month_name, 'JAN')
        period_key = f"{month_short}-{calculated_salary.payroll_period.year}"
        
        chart_data, created = cls.objects.update_or_create(
            tenant=calculated_salary.tenant,
            employee_id=calculated_salary.employee_id,
            year=calculated_salary.payroll_period.year,
            month=month_short,
            defaults={
                'employee_name': calculated_salary.employee_name,
                'department': calculated_salary.department or '',
                'period_key': period_key,
                'payroll_period': calculated_salary.payroll_period,
                'basic_salary': calculated_salary.basic_salary,
                'present_days': calculated_salary.present_days,
                'absent_days': calculated_salary.absent_days,
                'total_working_days': calculated_salary.total_working_days,
                'ot_hours': calculated_salary.ot_hours,
                'ot_charges': calculated_salary.ot_charges,
                'late_minutes': calculated_salary.late_minutes,
                'late_deduction': calculated_salary.late_deduction,
                'gross_salary': calculated_salary.gross_salary,
                'net_payable': calculated_salary.net_payable,
                'tds_amount': calculated_salary.tds_amount,
                'advance_deduction': calculated_salary.advance_deduction_amount,
                'total_advance_balance': calculated_salary.total_advance_balance,
                'incentive': calculated_salary.incentive,
                'data_source': 'frontend',
                'is_paid': calculated_salary.is_paid,
            }
        )
        return chart_data, created


from django.db import models
from .tenant import TenantAwareModel


class AdvanceLedger(TenantAwareModel):
    PAYMENT_METHOD_CHOICES = [
        ('CASH', 'Cash'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('CHEQUE', 'Cheque'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PARTIALLY_PAID', 'Partially Paid'),
        ('REPAID', 'Repaid'),
    ]

    employee_id = models.CharField(max_length=50)
    employee_name = models.CharField(max_length=255)
    advance_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Original advance amount")
    remaining_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Remaining balance to be repaid")
    for_month = models.CharField(max_length=20)  # e.g., 'Mar 2025'
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    remarks = models.TextField(blank=True, null=True)

    def save(self, *args, **kwargs):
        # Set remaining_balance to amount if not set (for new records)
        if self.remaining_balance == 0 and self.amount > 0 and not self.pk:
            # This is a new record (no pk yet) with amount > 0, set remaining_balance = amount
            self.remaining_balance = self.amount
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee_id} - {self.employee_name} - {self.advance_date}"

    class Meta:
        app_label = 'excel_data'
        managed = True
        db_table = 'excel_data_advanceledger'
        indexes = [
            models.Index(fields=['tenant', 'employee_id', 'status'], name='advance_payroll_idx'),
            models.Index(fields=['tenant', 'for_month'], name='advance_month_idx'),
            models.Index(fields=['employee_id', 'status'], name='advance_status_idx'),
        ]


class Payment(TenantAwareModel):
    PAYMENT_METHOD_CHOICES = [
        ('CASH', 'Cash'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('CHEQUE', 'Cheque'),
    ]

    employee_id = models.CharField(max_length=50)
    employee_name = models.CharField(max_length=255)
    payment_date = models.DateField()
    net_payable = models.DecimalField(max_digits=12, decimal_places=2)
    advance_deduction = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2)
    pay_period = models.CharField(max_length=20)  # e.g., 'Mar 2025'
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)

    class Meta:
        app_label = 'excel_data'

    def __str__(self):
        return f"{self.employee_id} - {self.employee_name} - {self.payment_date}"
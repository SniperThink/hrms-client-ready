from django.contrib import admin
from ..models import AdvanceLedger, Payment


@admin.register(AdvanceLedger)
class AdvanceLedgerAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'employee_id', 'employee_name', 'advance_date', 'amount', 'for_month', 'payment_method', 'status', 'remarks')
    list_filter = ('tenant', 'payment_method', 'status', 'for_month', 'advance_date')
    search_fields = ('employee_id', 'employee_name', 'remarks', 'for_month')
    ordering = ('-advance_date', '-created_at')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'employee_id', 'employee_name', 'payment_date', 'net_payable', 'advance_deduction', 'amount_paid', 'pay_period', 'payment_method')
    list_filter = ('tenant', 'payment_method', 'pay_period', 'payment_date')
    search_fields = ('employee_id', 'employee_name', 'pay_period')
    ordering = ('-payment_date', '-created_at')
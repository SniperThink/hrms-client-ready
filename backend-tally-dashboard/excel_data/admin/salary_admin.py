from django.contrib import admin
from ..models import SalaryData


@admin.register(SalaryData)
class SalaryDataAdmin(admin.ModelAdmin):
    list_display = (
        'tenant', 'name', 'department', 'year', 'month', 
        'salary', 'nett_payable', 'created_at'
    )
    list_filter = ('tenant', 'year', 'month', 'department')
    search_fields = ('name', 'department')
    ordering = ('-year', '-month', 'name')
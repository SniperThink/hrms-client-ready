"""
Serializers for salary-related models including salary data,
frontend mappings, and summary views.
"""

from rest_framework import serializers
from ..models import SalaryData

class SalaryDataSerializer(serializers.ModelSerializer):
    """
    Serializer for the new simplified salary data model
    """
    class Meta:
        model = SalaryData
        fields = [
            'id', 'name', 'month', 'year', 'department', 'employee_id',
            # Core salary fields - using actual model field names
            'salary', 'absent', 'days', 'sl_wo_ot', 'ot', 'hour_rs', 
            'charges', 'late', 'charge', 'amt', 'sal_ot', 'adv_25th', 
            'old_adv', 'nett_payable', 'total_old_adv', 'balnce_adv', 
            'incentive', 'tds', 'sal_tds', 'advance', 'date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

class SalaryDataFrontendSerializer(serializers.ModelSerializer):
    """
    Serializer that maps backend field names to frontend-expected names for charts/calculations
    """
    # Map backend fields to frontend expected field names
    basic_salary = serializers.CharField(source='salary')
    days_present = serializers.CharField(source='days')
    days_absent = serializers.CharField(source='absent')
    sl_wo_ot_wo_late = serializers.CharField(source='sl_wo_ot')
    ot_hours = serializers.CharField(source='ot')
    basic_salary_per_hour = serializers.CharField(source='hour_rs')
    ot_charges = serializers.CharField(source='charges')
    late_minutes = serializers.CharField(source='late')
    basic_salary_per_minute = serializers.CharField(source='charge')
    late_charges = serializers.CharField(source='amt')
    salary_wo_advance_deduction = serializers.CharField(source='sal_ot')
    adv_paid_on_25th = serializers.CharField(source='adv_25th')
    repayment_of_old_adv = serializers.CharField(source='old_adv')
    net_payable = serializers.CharField(source='nett_payable')
    total_old_advance = serializers.CharField(source='total_old_adv')
    final_balance_advance = serializers.CharField(source='balnce_adv')
    sal_before_tds = serializers.CharField(source='sal_tds')

    class Meta:
        model = SalaryData
        fields = [
            'id', 'name', 'month', 'year', 'department', 'employee_id',
            # Frontend-expected field names
            'basic_salary', 'days_present', 'days_absent', 'sl_wo_ot_wo_late',
            'ot_hours', 'basic_salary_per_hour', 'ot_charges', 'late_minutes',
            'basic_salary_per_minute', 'late_charges', 'salary_wo_advance_deduction',
            'adv_paid_on_25th', 'repayment_of_old_adv', 'net_payable',
            'total_old_advance', 'final_balance_advance', 'sal_before_tds',
            'incentive', 'tds', 'advance', 'date'
        ]

class SalaryDataSummarySerializer(serializers.ModelSerializer):
    """
    Simplified serializer for list views - using correct field names with all essential fields
    """
    class Meta:
        model = SalaryData
        fields = [
            'id', 'name', 'month', 'year', 'department', 'employee_id',
            'salary', 'nett_payable', 'days', 'absent', 'ot', 'late',
            'adv_25th', 'old_adv', 'incentive', 'tds', 'advance',
            'charges', 'hour_rs', 'amt', 'sal_ot', 'total_old_adv', 
            'balnce_adv', 'sal_tds', 'sl_wo_ot', 'charge', 'date'
        ]
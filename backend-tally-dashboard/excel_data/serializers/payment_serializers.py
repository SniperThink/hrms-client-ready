"""
Serializers for payment-related models including advances
and payment transactions.
"""

from rest_framework import serializers
from ..models import AdvanceLedger, Payment

class AdvanceLedgerSerializer(serializers.ModelSerializer):
    # Add computed fields for better frontend display
    is_active = serializers.SerializerMethodField()
    is_fully_repaid = serializers.SerializerMethodField() 
    amount_formatted = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = AdvanceLedger
        fields = [
            'id', 'employee_id', 'employee_name', 'advance_date', 'amount',
            'remaining_balance', 'for_month', 'payment_method', 'status', 'remarks',
            'created_at', 'updated_at', 'is_active', 'is_fully_repaid', 
            'amount_formatted', 'status_display'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_is_active(self, obj):
        """Check if advance is still active (not fully repaid)"""
        return obj.status != 'REPAID'
    
    def get_is_fully_repaid(self, obj):
        """Check if advance is fully repaid"""
        return obj.status == 'REPAID'
    
    def get_amount_formatted(self, obj):
        """Format amount with currency symbol"""
        return f"₹{obj.amount:.2f}"
    
    def get_status_display(self, obj):
        """Get user-friendly status display"""
        status_map = {
            'PENDING': 'Unpaid',
            'PARTIALLY_PAID': 'Partially Paid', 
            'REPAID': 'Fully Repaid'
        }
        return status_map.get(obj.status, obj.status)

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
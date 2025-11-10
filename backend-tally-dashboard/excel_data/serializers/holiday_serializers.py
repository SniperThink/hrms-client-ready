from rest_framework import serializers
from ..models import Holiday


class HolidaySerializer(serializers.ModelSerializer):
    """Serializer for Holiday model"""
    
    is_past = serializers.ReadOnlyField()
    created_by_email = serializers.CharField(source='created_by.email', read_only=True, allow_null=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    
    class Meta:
        model = Holiday
        fields = [
            'id', 'name', 'date', 'holiday_type', 'description',
            'is_active', 'applies_to_all', 'specific_departments',
            'is_past', 'created_by', 'created_by_email', 'tenant_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_past', 'created_by_email', 'tenant_name']
    
    def validate_date(self, value):
        """Ensure holiday date is unique for this tenant (same date + name)"""
        from ..utils.utils import get_current_tenant
        
        # Get tenant from middleware
        tenant = get_current_tenant()
        if not tenant:
            # Try to get from request if available
            request = self.context.get('request')
            if request and hasattr(request, 'tenant'):
                tenant = request.tenant
        
        if not tenant:
            return value  # Validation will fail elsewhere if no tenant
        
        name = self.initial_data.get('name', '')
        if not name:
            # If name is not in initial_data, get from instance (for updates)
            if self.instance:
                name = self.instance.name
        
        # Check for duplicate
        if self.instance:
            # Update operation - exclude current instance
            if Holiday.objects.filter(
                tenant=tenant,
                date=value,
                name=name
            ).exclude(id=self.instance.id).exists():
                raise serializers.ValidationError(
                    f"A holiday with name '{name}' already exists on {value} for this organization"
                )
        else:
            # Create operation
            if Holiday.objects.filter(tenant=tenant, date=value, name=name).exists():
                raise serializers.ValidationError(
                    f"A holiday with name '{name}' already exists on {value} for this organization"
                )
        
        return value


class HolidayCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a holiday"""
    
    class Meta:
        model = Holiday
        fields = [
            'name', 'date', 'holiday_type', 'description',
            'applies_to_all', 'specific_departments'
        ]
    
    def create(self, validated_data):
        from ..utils.utils import get_current_tenant
        
        # Get tenant from middleware
        tenant = get_current_tenant()
        if not tenant:
            # Try to get from request if available
            request = self.context.get('request')
            if request and hasattr(request, 'tenant'):
                tenant = request.tenant
        
        if not tenant:
            raise serializers.ValidationError("Tenant information is required")
        
        # Set tenant and created_by
        validated_data['tenant'] = tenant
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
        
        return super().create(validated_data)


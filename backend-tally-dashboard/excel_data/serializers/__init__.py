"""
Main serializers module that re-exports all serializers
from the serializers package.
"""

from excel_data.models.auth import CustomUser, UserPermissions
from .tenant_user_serializers import (
    TenantSerializer, UserPermissionsSerializer, CustomUserSerializer,
    CustomUserCreateSerializer, UserRegistrationSerializer,
    UserLoginSerializer, UserSerializer
)

from .salary_serializers import (
    SalaryDataSerializer, SalaryDataFrontendSerializer,
    SalaryDataSummarySerializer
)

from .employee_serializers import (
    EmployeeProfileSerializer, EmployeeProfileListSerializer,
    EmployeeFormSerializer, EmployeeTableSerializer
)

from .attendance_serializers import (
    AttendanceSerializer, DailyAttendanceSerializer,
    LeaveSerializer
)

from .payment_serializers import (
    AdvanceLedgerSerializer, PaymentSerializer
)

from rest_framework import serializers

class UserPermissionsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPermissions
        fields = [
            'can_view', 'can_modify', 'can_invite_users', 
            'can_manage_payroll', 'can_export_data'
        ]

class CustomUserSerializer(serializers.ModelSerializer):
    """Serializer for CustomUser model with tenant and permissions"""
    permissions = UserPermissionsSerializer(read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'is_active', 'is_invited', 'phone_number', 
            'department', 'date_joined', 'tenant_name', 'permissions'
        ]
        read_only_fields = ['id', 'date_joined', 'tenant_name', 'permissions']
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

class CustomUserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users (invitations)"""
    permissions = UserPermissionsSerializer(required=False)
    
    class Meta:
        model = CustomUser
        fields = [
            'email', 'first_name', 'last_name', 'role', 
            'phone_number', 'department', 'permissions'
        ]
    
    def create(self, validated_data):
        permissions_data = validated_data.pop('permissions', {})
        user = CustomUser.objects.create_user(**validated_data)
        
        # Create permissions if provided
        if permissions_data:
            if hasattr(user, 'permissions') and user.permissions:
                for key, value in permissions_data.items():
                    setattr(user.permissions, key, value)
                user.permissions.save()
        
        return user

__all__ = [
    # Tenant and User serializers
    'TenantSerializer',
    'UserPermissionsSerializer',
    'CustomUserSerializer',
    'CustomUserCreateSerializer',
    'UserRegistrationSerializer',
    'UserLoginSerializer',
    'UserSerializer',
    
    # Salary serializers
    'SalaryDataSerializer',
    'SalaryDataFrontendSerializer',
    'SalaryDataSummarySerializer',
    
    # Employee serializers
    'EmployeeProfileSerializer',
    'EmployeeProfileListSerializer',
    'EmployeeFormSerializer',
    'EmployeeTableSerializer',
    
    # Attendance serializers
    'AttendanceSerializer',
    'DailyAttendanceSerializer',
    'LeaveSerializer',
    
    # Payment serializers
    'AdvanceLedgerSerializer',
    'PaymentSerializer',
]
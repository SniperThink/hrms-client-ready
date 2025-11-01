"""
Serializers for tenant and user-related models including
authentication, permissions, and user management.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from ..models import Tenant, UserPermissions, CustomUser

User = get_user_model()

class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'subdomain', 'is_active', 'plan', 
                  'max_employees', 'created_at']
        read_only_fields = ['created_at']

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

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = CustomUser
        fields = ('email', 'password', 'password2', 'first_name', 'last_name')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        tenant = validated_data.pop('tenant', None)
        user = CustomUser.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            tenant=tenant
        )
        return user

class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)

class UserSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    
    class Meta:
        model = CustomUser
        fields = ('id', 'email', 'first_name', 'last_name', 'is_active', 
                  'is_staff', 'is_superuser', 'role', 'tenant_name', 'date_joined')
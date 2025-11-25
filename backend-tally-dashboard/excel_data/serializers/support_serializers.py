from rest_framework import serializers
from ..models.support import SupportTicket
from ..models.auth import CustomUser


class SupportTicketSerializer(serializers.ModelSerializer):
    """Serializer for SupportTicket model"""
    created_by = serializers.SerializerMethodField()
    
    class Meta:
        model = SupportTicket
        fields = [
            'id', 'subject', 'description', 'status', 'priority',
            'created_by', 'created_at', 'updated_at',
            'admin_response', 'resolved_at', 'resolved_by'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'resolved_at', 'resolved_by']
    
    def get_created_by(self, obj):
        """Return user info for created_by"""
        if obj.created_by:
            return {
                'id': obj.created_by.id,
                'email': obj.created_by.email,
                'name': f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.email
            }
        return None


class SupportTicketCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating support tickets"""
    
    class Meta:
        model = SupportTicket
        fields = ['subject', 'description', 'priority']
    
    def validate_subject(self, value):
        """Validate subject field"""
        if not value or not value.strip():
            raise serializers.ValidationError("Subject cannot be empty")
        if len(value) > 200:
            raise serializers.ValidationError("Subject cannot exceed 200 characters")
        return value.strip()
    
    def validate_description(self, value):
        """Validate description field"""
        if not value or not value.strip():
            raise serializers.ValidationError("Description cannot be empty")
        return value.strip()


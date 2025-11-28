from rest_framework import serializers
from ..models.support import SupportTicket
from ..models.auth import CustomUser


class SupportTicketSerializer(serializers.ModelSerializer):
    """Serializer for SupportTicket model"""
    created_by = serializers.SerializerMethodField()
    resolved_by_info = serializers.SerializerMethodField()
    tenant_info = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    
    class Meta:
        model = SupportTicket
        fields = [
            'id', 'subject', 'description', 'status', 'priority',
            'created_by', 'created_at', 'updated_at',
            'admin_response', 'resolved_at', 'resolved_by', 'resolved_by_info',
            'tenant_info', 'attachment', 'attachment_url'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'resolved_at', 'resolved_by']
    
    def get_attachment_url(self, obj):
        """Return full URL for attachment if it exists"""
        if obj.attachment:
            try:
                attachment_url = obj.attachment.url
                
                # If the URL is already a complete URL (presigned R2 URL), return it as-is
                # Presigned URLs from R2 start with https://
                if attachment_url.startswith('https://') or attachment_url.startswith('http://'):
                    return attachment_url
                
                # Otherwise, build absolute URI for local storage URLs
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(attachment_url)
                return attachment_url
            except Exception as e:
                # Log error but don't break the response
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error getting attachment URL for ticket {obj.id}: {str(e)}")
                return None
        return None
    
    def get_created_by(self, obj):
        """Return user info for created_by"""
        if obj.created_by:
            return {
                'id': obj.created_by.id,
                'email': obj.created_by.email,
                'name': f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.email
            }
        return None
    
    def get_resolved_by_info(self, obj):
        """Return user info for resolved_by"""
        if obj.resolved_by:
            return {
                'id': obj.resolved_by.id,
                'email': obj.resolved_by.email,
                'name': f"{obj.resolved_by.first_name} {obj.resolved_by.last_name}".strip() or obj.resolved_by.email
            }
        return None
    
    def get_tenant_info(self, obj):
        """Return tenant info"""
        if obj.tenant:
            return {
                'id': obj.tenant.id,
                'name': obj.tenant.name,
                'subdomain': obj.tenant.subdomain
            }
        return None


class SupportTicketCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating support tickets"""
    
    class Meta:
        model = SupportTicket
        fields = ['subject', 'description', 'priority', 'attachment']
    
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
    
    def validate_attachment(self, value):
        """Validate attachment file"""
        if value:
            # Check file size (10MB limit)
            max_size = 10 * 1024 * 1024  # 10MB in bytes
            if value.size > max_size:
                raise serializers.ValidationError(
                    f"File size cannot exceed 10MB. Current file size: {value.size / (1024 * 1024):.2f}MB"
                )
            
            # Check file extension
            allowed_extensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.txt', '.csv', '.xlsx', '.xls']
            file_extension = value.name.lower().split('.')[-1] if '.' in value.name else ''
            if file_extension and f'.{file_extension}' not in allowed_extensions:
                raise serializers.ValidationError(
                    f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"
                )
        
        return value


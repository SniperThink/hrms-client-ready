from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from ..models.tenant import Tenant
from ..utils.utils import get_current_tenant

class TenantCreditsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        Get the current tenant's remaining credits
        """
        tenant = get_current_tenant()
        if not tenant:
            return Response(
                {"error": "Tenant not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
            
        return Response({
            "tenant_id": tenant.id,
            "tenant_name": tenant.name,
            "credits": tenant.credits,
            "is_active": tenant.is_active
        })

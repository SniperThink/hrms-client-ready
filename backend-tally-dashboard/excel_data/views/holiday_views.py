from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from datetime import datetime
from ..models import Holiday
from ..serializers import HolidaySerializer, HolidayCreateSerializer
from ..utils.utils import get_current_tenant
import logging

logger = logging.getLogger(__name__)


class HolidayViewSet(viewsets.ModelViewSet):
    """ViewSet for Holiday CRUD operations"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return holidays for current tenant only"""
        tenant = get_current_tenant()
        if not tenant:
            return Holiday.objects.none()
        return Holiday.objects.filter(tenant=tenant).order_by('-date')
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return HolidayCreateSerializer
        return HolidaySerializer
    
    def perform_create(self, serializer):
        """Set tenant and created_by on create"""
        tenant = get_current_tenant()
        if not tenant:
            raise serializers.ValidationError("Tenant information is required")
        serializer.save(tenant=tenant, created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming holidays"""
        today = datetime.now().date()
        holidays = self.get_queryset().filter(
            date__gte=today, 
            is_active=True
        ).order_by('date')[:10]
        serializer = self.get_serializer(holidays, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_month(self, request):
        """Get holidays for a specific month"""
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        
        if not year or not month:
            return Response(
                {'error': 'year and month are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            holidays = self.get_queryset().filter(
                date__year=int(year),
                date__month=int(month),
                is_active=True
            )
            serializer = self.get_serializer(holidays, many=True)
            return Response(serializer.data)
        except ValueError:
            return Response(
                {'error': 'Invalid year or month format'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def check_date(self, request):
        """Check if a specific date is a holiday"""
        date_str = request.query_params.get('date')
        
        if not date_str:
            return Response(
                {'error': 'date is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        holiday = self.get_queryset().filter(date=date, is_active=True).first()
        
        if holiday:
            return Response({
                'is_holiday': True,
                'holiday': HolidaySerializer(holiday).data
            })
        else:
            return Response({'is_holiday': False})


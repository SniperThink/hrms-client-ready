"""
Serializers for attendance-related models including daily
attendance, leaves, and summary views.
"""

from rest_framework import serializers
from ..models import Attendance, DailyAttendance, Leave

class AttendanceSerializer(serializers.ModelSerializer):
    attendance_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = Attendance
        fields = [
            'id', 'employee_id', 'name', 'department', 'date', 
            'calendar_days', 'total_working_days', 'present_days', 
            'absent_days', 'ot_hours', 'late_minutes', 'attendance_percentage',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_attendance_percentage(self, obj):
        # Use total_working_days if available, otherwise fall back to calendar_days
        working_days = obj.total_working_days if obj.total_working_days > 0 else obj.calendar_days
        if working_days > 0:
            return round((obj.present_days / working_days) * 100, 1)
        return 0

class DailyAttendanceSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = DailyAttendance
        fields = [
            'id', 'employee_id', 'employee_name', 'department', 'designation',
            'employment_type', 'attendance_status', 'date', 'check_in', 
            'check_out', 'working_hours', 'time_status', 'ot_hours', 'late_minutes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

class LeaveSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.email', read_only=True)
    
    class Meta:
        model = Leave
        fields = [
            'id', 'employee', 'employee_name', 'leave_type', 'start_date',
            'end_date', 'days_count', 'reason', 'status', 'approved_by',
            'approved_by_name', 'applied_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['applied_date', 'created_at', 'updated_at']
"""
Serializers for employee-related models including profiles,
forms, and table views.
"""

from rest_framework import serializers
from ..models import EmployeeProfile, SalaryData, Attendance, DailyAttendance
from datetime import datetime
from django.db.models import Count, Q

class FlexibleDateField(serializers.DateField):
    """
    A flexible date field that can handle multiple date formats and empty values
    """
    def to_internal_value(self, value):
        if value is None or value == '' or str(value).strip() == '' or str(value).lower() in ['null', 'none', 'nan']:
            return None
        
        # Try multiple date formats
        date_formats = [
            '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y', '%m-%d-%Y',
            '%Y/%m/%d', '%d.%m.%Y', '%m.%d.%Y', '%d.%m.%y', '%m.%d.%y',
            '%d/%m/%y', '%m/%d/%y', '%d-%m-%y', '%m-%d-%y', '%Y%m%d',
            '%d%m%Y', '%m%d%Y', '%d%m%y', '%m%d%y'
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(str(value), fmt).date()
            except ValueError:
                continue
        
        # If no format works, raise validation error
        raise serializers.ValidationError(
            f"Date has wrong format. Use one of these formats instead: {', '.join(date_formats[:5])}."
        )

class EmployeeProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for employee profiles
    """
    full_name = serializers.SerializerMethodField()
    
    # Custom date fields with flexible input format and empty value handling
    date_of_birth = FlexibleDateField(required=False, allow_null=True)
    date_of_joining = FlexibleDateField(required=False, allow_null=True)
    
    
    class Meta:
        model = EmployeeProfile
        fields = [
            'id', 'first_name', 'last_name', 'full_name', 'email', 'employee_id', 
            'department', 'designation', 'date_of_joining', 'mobile_number', 
            'basic_salary', 'is_active', 'inactive_marked_at', 'employment_type', 'location_branch',
            'shift_start_time', 'shift_end_time', 'date_of_birth', 'marital_status',
            'gender', 'nationality', 'address', 'city', 'state', 'tds_percentage',
            'ot_charge_per_hour', 'off_monday', 'off_tuesday', 'off_wednesday',
            'off_thursday', 'off_friday', 'off_saturday', 'off_sunday',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['employee_id', 'created_at', 'updated_at']
    
    def get_full_name(self, obj):
        return obj.full_name
    
    def create(self, validated_data):
        """Create employee with auto-generated Employee ID if not provided"""
        # Remove employee_id from validated_data if it exists (it's read-only)
        employee_id = validated_data.pop('employee_id', None)
        
        # Get tenant from context (set by the view) or from validated_data
        tenant = None
        if hasattr(self.context.get('request', {}), 'tenant'):
            tenant = self.context['request'].tenant
        elif 'tenant' in validated_data:
            tenant = validated_data['tenant']
        
        if not tenant:
            raise serializers.ValidationError("No tenant found for this request")
        
        # Generate Employee ID if not provided
        if not employee_id:
            from ..utils.utils import generate_employee_id
            first_name = validated_data.get('first_name', '')
            last_name = validated_data.get('last_name', '')
            department = validated_data.get('department', '')
            
            # Create full name for ID generation
            full_name = f"{first_name} {last_name}".strip()
            employee_id = generate_employee_id(full_name, tenant.id, department)
        
        # Create the employee with the generated ID
        validated_data['employee_id'] = employee_id
        return super().create(validated_data)

class EmployeeProfileListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for employee list views
    """
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = EmployeeProfile
        fields = ['id', 'employee_id', 'first_name', 'last_name', 'full_name', 
                  'department', 'designation', 'mobile_number', 'email', 'is_active']
    
    def get_full_name(self, obj):
        return obj.full_name

class EmployeeFormSerializer(serializers.ModelSerializer):
    """
    Serializer for employee form submissions with mandatory field validation
    """
    # Calculate OT rate display value
    ot_calculation = serializers.SerializerMethodField(read_only=True)
    
    # Custom date fields with flexible input format and empty value handling
    date_of_birth = FlexibleDateField(required=False, allow_null=True)
    date_of_joining = FlexibleDateField(required=False, allow_null=True)
    
    
    class Meta:
        model = EmployeeProfile
        fields = [
            'first_name', 'last_name', 'mobile_number', 'email', 'date_of_birth',
            'marital_status', 'gender', 'nationality', 'address', 'city', 'state',
            'department', 'designation', 'employment_type', 'date_of_joining',
            'location_branch', 'shift_start_time', 'shift_end_time', 
            'basic_salary', 'tds_percentage', 'ot_charge_per_hour', 'ot_calculation',
            'off_monday', 'off_tuesday', 'off_wednesday', 'off_thursday',
            'off_friday', 'off_saturday', 'off_sunday', 'is_active'
        ]
        
    def get_ot_calculation(self, obj):
        """Show OT calculation formula"""
        if obj.basic_salary:
            return f"{obj.basic_salary} ÷ 240 = {round(obj.basic_salary / 240, 2)}"
        return "Enter basic salary to calculate"
        
    def validate(self, data):
        """Custom validation for mandatory fields"""
        # Mandatory fields validation
        required_fields = ['first_name', 'last_name', 'shift_start_time', 'shift_end_time', 'basic_salary']
        
        for field in required_fields:
            if not data.get(field):
                raise serializers.ValidationError(f"{field.replace('_', ' ').title()} is required.")
        
        return data

class EmployeeTableSerializer(serializers.ModelSerializer):
    """
    Serializer for employee table view with calculated fields
    """
    employee_name = serializers.SerializerMethodField()
    latest_salary = serializers.SerializerMethodField()
    attendance_percentage = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeProfile
        fields = [
            'employee_id', 'employee_name', 'mobile_number', 'email',
            'department', 'designation', 'employment_type', 'location_branch',
            'basic_salary', 'ot_charge_per_hour', 'latest_salary', 'attendance_percentage'
        ]

    def get_employee_name(self, obj):
        return obj.full_name

    def get_latest_salary(self, obj):
        latest = SalaryData.objects.filter(employee_id=obj.employee_id).order_by('-year', '-month').first()
        return float(latest.nett_payable) if latest else 0

    def get_attendance_percentage(self, obj):
        """
        Calculate attendance percentage by aggregating data from:
        1. Uploaded Salary Excel (SalaryData model - has days and absent fields)
        2. Manually marked attendance (DailyAttendance model - daily records)
        
        Combines both sources to give complete attendance picture.
        """
        total_present_days = 0
        total_absent_days = 0
        
        # 1. Get attendance data from uploaded Salary Excel
        latest_salary = SalaryData.objects.filter(
            employee_id=obj.employee_id
        ).order_by('-year', '-month').first()
        
        if latest_salary:
            total_present_days += float(latest_salary.days or 0)
            total_absent_days += float(latest_salary.absent or 0)
        
        # 2. Get manually marked attendance from DailyAttendance
        daily_attendance = DailyAttendance.objects.filter(
            employee_id=obj.employee_id
        )
        
        # Count present days (PRESENT + PAID_LEAVE = full day, HALF_DAY = 0.5)
        present_count = daily_attendance.filter(attendance_status='PRESENT').count()
        paid_leave_count = daily_attendance.filter(attendance_status='PAID_LEAVE').count()
        half_day_count = daily_attendance.filter(attendance_status='HALF_DAY').count()
        absent_count = daily_attendance.filter(attendance_status='ABSENT').count()
        
        # Aggregate manually marked attendance
        manual_present = present_count + paid_leave_count + (half_day_count * 0.5)
        manual_absent = absent_count + (half_day_count * 0.5)
        
        total_present_days += manual_present
        total_absent_days += manual_absent
        
        # Calculate percentage
        total_days = total_present_days + total_absent_days
        if total_days > 0:
            return round((total_present_days / total_days) * 100, 1)
        
        return 0
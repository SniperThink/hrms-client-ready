from django.db import models
from django.utils import timezone
from datetime import datetime, date, time
from .tenant import TenantAwareModel
from .employee import EmployeeProfile


class Attendance(TenantAwareModel):
    """
    Model to track employee attendance details including working days, absences, OT, and late minutes.
    """
    employee_id = models.CharField(max_length=50, db_index=True)
    name = models.CharField(max_length=255)
    department = models.CharField(max_length=100, blank=True, null=True)
    date = models.DateField(default=timezone.now)
    calendar_days = models.IntegerField(default=0, help_text="Total calendar days in the month")
    total_working_days = models.IntegerField(default=0, help_text="Total working days excluding holidays and weekends")
    present_days = models.IntegerField(default=0)
    absent_days = models.IntegerField(default=0)
    ot_hours = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    late_minutes = models.IntegerField(default=0)

    class Meta:
        app_label = 'excel_data'
        ordering = ['-date', 'name']
        # Ensure we don't have duplicate entries for the same employee on the same date
        unique_together = ['tenant', 'employee_id', 'date']

    def __str__(self):
        return f"{self.name} - {self.date}"
        
    def save(self, *args, **kwargs):
        # Ensure absent_days is calculated correctly
        # Use calendar_days as fallback if total_working_days is 0
        working_days = self.total_working_days if self.total_working_days > 0 else self.calendar_days
        self.absent_days = working_days - self.present_days
        super().save(*args, **kwargs)


class DailyAttendance(TenantAwareModel):
    """
    Model to track daily attendance of employees including check-in/out times and status
    """
    ATTENDANCE_STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
        ('HALF_DAY', 'Half Day'),
        ('PAID_LEAVE', 'Paid Leave'),
        ('OFF', 'Off Day'),
    ]

    TIME_STATUS_CHOICES = [
        ('ON_TIME', 'On Time'),
        ('LATE', 'Late'),
    ]

    employee_id = models.CharField(max_length=50, db_index=True)
    employee_name = models.CharField(max_length=255)
    department = models.CharField(max_length=100)
    designation = models.CharField(max_length=100)
    employment_type = models.CharField(max_length=50)
    attendance_status = models.CharField(max_length=10, choices=ATTENDANCE_STATUS_CHOICES)
    date = models.DateField(default=timezone.now)
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    working_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    time_status = models.CharField(max_length=10, choices=TIME_STATUS_CHOICES, null=True, blank=True)
    
    # OT and Late tracking (added for payroll calculation)
    ot_hours = models.DecimalField(max_digits=5, decimal_places=1, default=0, help_text="Overtime hours worked")
    late_minutes = models.IntegerField(default=0, help_text="Minutes late for work")

    class Meta:
        app_label = 'excel_data'
        ordering = ['-date', 'employee_name']
        unique_together = ['tenant', 'employee_id', 'date']
        managed = True
        db_table = 'excel_data_dailyattendance'
        indexes = [
            models.Index(fields=['tenant', 'employee_id', 'date'], name='attendance_payroll_idx'),
            models.Index(fields=['tenant', 'date'], name='attendance_date_idx'),
            models.Index(fields=['employee_id', 'attendance_status'], name='attendance_status_idx'),
        ]

    def save(self, *args, **kwargs):
        # Calculate working hours if both check_in and check_out are present
        if self.check_in and self.check_out:
            check_in_dt = datetime.combine(date.today(), self.check_in)
            check_out_dt = datetime.combine(date.today(), self.check_out)
            duration = check_out_dt - check_in_dt
            self.working_hours = round(duration.total_seconds() / 3600, 2)  # Convert to hours

            # Determine if employee is late (assuming 9:30 AM is the cutoff)
            cutoff_time = time(9, 30)  # 9:30 AM
            self.time_status = 'LATE' if self.check_in > cutoff_time else 'ON_TIME'

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee_name} - {self.date}"


class MonthlyAttendanceSummary(TenantAwareModel):
    """
    Pre-aggregated monthly attendance metrics for each employee.
    This model is updated automatically whenever DailyAttendance records
    are inserted, updated or deleted.  Salary calculation logic can then
    read a single row per employee instead of scanning DailyAttendance
    each time, dramatically improving performance.
    """

    employee_id = models.CharField(max_length=50, db_index=True)
    year = models.IntegerField()
    # Store month as integer 1-12 to simplify querying/sorting
    month = models.IntegerField()

    # Aggregated metrics
    present_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    ot_hours = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    late_minutes = models.IntegerField(default=0)

    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'excel_data'
        unique_together = ["tenant", "employee_id", "year", "month"]
        ordering = ["-year", "-month", "employee_id"]
        verbose_name = "Monthly attendance summary"
        verbose_name_plural = "Monthly attendance summaries"

    def __str__(self):
        return f"{self.employee_id} – {self.month}/{self.year}"
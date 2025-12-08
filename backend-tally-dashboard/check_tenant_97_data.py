#!/usr/bin/env python
"""
Quick script to check penalty/bonus days for tenant 97
Run this from the backend-tally-dashboard directory after activating your virtual environment
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hrms.settings')
django.setup()

from excel_data.models import Tenant, MonthlyAttendanceSummary
from django.db import models

tenant_id = 97
year = 2025
month = 12

try:
    tenant = Tenant.objects.get(id=tenant_id)
except Tenant.DoesNotExist:
    print(f"❌ Tenant with ID {tenant_id} not found.")
    sys.exit(1)

# Check tenant settings
print(f"\n{'='*80}")
print(f"Tenant: {tenant.name} (ID: {tenant_id})")
print(f"{'='*80}")
print(f"weekly_absent_penalty_enabled: {tenant.weekly_absent_penalty_enabled}")
print(f"sunday_bonus_enabled: {tenant.sunday_bonus_enabled}")
print(f"weekly_absent_threshold: {tenant.weekly_absent_threshold}")
print(f"{'='*80}\n")

# Query MonthlyAttendanceSummary
qs = MonthlyAttendanceSummary.objects.filter(
    tenant=tenant,
    year=year,
    month=month
).order_by('employee_id')

total_records = qs.count()
records_with_penalty = qs.filter(weekly_penalty_days__gt=0).count()
records_with_bonus = qs.filter(sunday_bonus_days__gt=0).count()

print(f"MonthlyAttendanceSummary for {year}-{month:02d}:")
print(f"  Total records: {total_records}")
print(f"  Records with penalty_days > 0: {records_with_penalty}")
print(f"  Records with bonus_days > 0: {records_with_bonus}")

if records_with_penalty > 0 or records_with_bonus > 0:
    print(f"\n{'='*80}")
    print("Records with penalty/bonus days:")
    print(f"{'='*80}")
    for record in qs.filter(
        models.Q(weekly_penalty_days__gt=0) | models.Q(sunday_bonus_days__gt=0)
    )[:20]:  # Show first 20
        print(
            f"  {record.employee_id}: penalty={record.weekly_penalty_days}, "
            f"bonus={record.sunday_bonus_days}"
        )

# Check a few sample employees
print(f"\n{'='*80}")
print("Sample records (first 10):")
print(f"{'='*80}")
for record in qs[:10]:
    print(
        f"  {record.employee_id}: penalty={record.weekly_penalty_days}, "
        f"bonus={record.sunday_bonus_days}, present={record.present_days}"
    )

# Check if features are enabled but no data
if (tenant.weekly_absent_penalty_enabled or tenant.sunday_bonus_enabled) and total_records > 0:
    if records_with_penalty == 0 and records_with_bonus == 0:
        print(f"\n⚠️  WARNING: Features are enabled but no penalty/bonus days found!")
        print(
            "   This might mean:\n"
            "   1. The data hasn't been recalculated yet\n"
            "   2. No employees met the threshold criteria\n"
            "   3. The signal hasn't run to update MonthlyAttendanceSummary"
        )
        print(
            f"\n   Try running: python manage.py recalculate_penalty_bonus "
            f"--tenant-id {tenant_id} --year {year} --month {month}"
        )

print(f"\n{'='*80}")
print("Done!")
print(f"{'='*80}\n")


#!/usr/bin/env python
"""Check holidays for September 2025"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from excel_data.models import Holiday
from datetime import date

# Query holidays for September 2025
holidays = Holiday.objects.filter(
    date__year=2025,
    date__month=9,
    is_active=True
).order_by('date')

print(f"\n📅 Found {holidays.count()} active holidays in September 2025:\n")

if holidays.exists():
    for h in holidays:
        applies_to = "All Departments" if h.applies_to_all else f"Specific: {h.specific_departments}"
        print(f"  📌 {h.date} - {h.name}")
        print(f"     Type: {h.holiday_type}")
        print(f"     Applies to: {applies_to}")
        if h.description:
            print(f"     Description: {h.description}")
        print()
else:
    print("  ⚠️ No holidays found for September 2025")
    print("\nNote: Holidays need to be added through the Holiday Management interface")

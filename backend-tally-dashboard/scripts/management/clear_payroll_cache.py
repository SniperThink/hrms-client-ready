#!/usr/bin/env python3
"""
Script to clear payroll overview cache and test Excel upload functionality
"""
import os
import sys
import django
from django.core.cache import cache

# Add the project directory to Python path
# Get the project root directory (two levels up from scripts/management/)
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.append(project_root)

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from excel_data.models import Tenant, PayrollPeriod, SalaryData

def clear_payroll_cache():
    """Clear all payroll-related caches"""
    print("🧹 Clearing payroll overview cache...")
    
    # Clear general payroll overview cache for all tenants
    tenants = Tenant.objects.all()
    for tenant in tenants:
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        print(f"   Cleared cache for tenant: {tenant.subdomain}")
    
    # Clear specific period caches
    periods = PayrollPeriod.objects.all()
    for period in periods:
        cache.delete(f"payroll_period_detail_{period.id}")
        cache.delete(f"payroll_summary_{period.id}")
    
    print(f"✅ Cleared cache for {len(tenants)} tenants and {len(periods)} periods")

def show_uploaded_data():
    """Show uploaded salary data"""
    print("\n📊 Checking uploaded salary data...")
    
    # Get all uploaded salary data
    uploaded_data = SalaryData.objects.all().values('year', 'month', 'tenant__subdomain').annotate(
        count=django.db.models.Count('id')
    ).order_by('-year', '-month')
    
    if uploaded_data:
        print("   Uploaded salary data found:")
        for data in uploaded_data:
            print(f"   - {data['month']} {data['year']} ({data['tenant__subdomain']}): {data['count']} records")
    else:
        print("   No uploaded salary data found")
    
    # Check for corresponding PayrollPeriod records
    periods = PayrollPeriod.objects.all()
    print(f"\n📋 Payroll periods found: {periods.count()}")
    
    for period in periods:
        salary_count = SalaryData.objects.filter(
            tenant=period.tenant,
            year=period.year,
            month=period.month
        ).count()
        
        print(f"   - {period.month} {period.year} ({period.tenant.subdomain}): {period.data_source} - {salary_count} salary records")

if __name__ == "__main__":
    clear_payroll_cache()
    show_uploaded_data()
    print("\n🎯 Cache cleared! Try uploading Excel data now.")
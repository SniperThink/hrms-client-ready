"""
Quick test script to verify Celery setup
Run with: python test_celery.py
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from excel_data.models import Tenant
from excel_data.tasks import sync_chart_data_batch_task

def test_celery():
    """Test Celery task execution"""
    print("=" * 60)
    print("🧪 Testing Celery Setup")
    print("=" * 60)
    
    try:
        # Get first tenant
        tenant = Tenant.objects.first()
        if not tenant:
            print("❌ No tenants found in database")
            return
        
        print(f"✅ Found tenant: {tenant.subdomain} (ID: {tenant.id})")
        
        # Queue a test task
        print("\n🔄 Queuing Celery task...")
        task = sync_chart_data_batch_task.delay(tenant.id, 2025, 'JAN', 'excel')
        
        print(f"✅ Task queued successfully!")
        print(f"   Task ID: {task.id}")
        print(f"   Task State: {task.state}")
        
        print("\n📊 Task Details:")
        print(f"   - Tenant: {tenant.subdomain}")
        print(f"   - Year: 2025")
        print(f"   - Month: JAN")
        print(f"   - Source: excel")
        
        print("\n" + "=" * 60)
        print("✅ Celery is working correctly!")
        print("=" * 60)
        print("\n💡 To see task execution, check Celery worker logs or:")
        print("   celery -A dashboard flower")
        print("   Then open: http://localhost:5555")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\n⚠️  Make sure:")
        print("   1. Redis is running: redis-cli ping")
        print("   2. Celery worker is running: celery -A dashboard worker -l info")

if __name__ == '__main__':
    test_celery()


#!/usr/bin/env python3
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
import django
django.setup()

from excel_data.models import CustomUser, Tenant

# Check if user exists
try:
    user = CustomUser.objects.get(email='test@testing.com')
    print(f'✅ User exists: {user.email}')
    print(f'   Tenant: {user.tenant.name if user.tenant else "No tenant"}')
    print(f'   Active: {user.is_active}')
    print(f'   Current session: {user.current_session_key}')
    
    # Clear any existing session
    if user.current_session_key:
        user.clear_session()
        print('   🧹 Cleared existing session')
        
except CustomUser.DoesNotExist:
    print('❌ User does not exist. Creating user...')
    
    # Get or create test tenant
    tenant, created = Tenant.objects.get_or_create(
        subdomain='testing',
        defaults={
            'name': 'Testing Company',
            'is_active': True
        }
    )
    
    # Create user
    user = CustomUser.objects.create_user(
        email='test@testing.com',
        password='test123',
        first_name='Test',
        last_name='User',
        tenant=tenant,
        is_active=True,
        role='admin'
    )
    print(f'✅ Created user: {user.email}')
    print(f'   Tenant: {user.tenant.name}')

print('\n🚀 Ready for curl testing!')

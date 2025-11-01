from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from excel_data.models import Tenant

User = get_user_model()

class Command(BaseCommand):
    help = 'Setup a new tenant with admin user'

    def add_arguments(self, parser):
        parser.add_argument('tenant_name', type=str, help='Name of the tenant')
        parser.add_argument('subdomain', type=str, help='Subdomain for the tenant')
        parser.add_argument('admin_email', type=str, help='Admin email')
        parser.add_argument('admin_password', type=str, help='Admin password')

    def handle(self, *args, **options):
        tenant_name = options['tenant_name']
        subdomain = options['subdomain']
        admin_email = options['admin_email']
        admin_password = options['admin_password']

        # Create tenant
        tenant, created = Tenant.objects.get_or_create(
            subdomain=subdomain,
            defaults={
                'name': tenant_name,
                'is_active': True
            }
        )

        if created:
            self.stdout.write(f'Created tenant: {tenant_name} with subdomain: {subdomain}')
        else:
            self.stdout.write(f'Tenant already exists: {tenant_name}')

        # Create admin user for tenant
        user, user_created = User.objects.get_or_create(
            email=admin_email,
            tenant=tenant,
            defaults={
                'is_tenant_admin': True,
                'is_hr': True,
                'is_active': True
            }
        )

        if user_created:
            user.set_password(admin_password)
            user.save()
            self.stdout.write(f'Created admin user: {admin_email}')
        else:
            self.stdout.write(f'Admin user already exists: {admin_email}')

        self.stdout.write(
            self.style.SUCCESS(
                f'Setup complete!\n'
                f'Tenant: {tenant_name}\n'
                f'Subdomain: {subdomain}\n'
                f'Admin: {admin_email}\n'
                f'Access URL: http://{subdomain}.localhost:8000'
            )
        ) 
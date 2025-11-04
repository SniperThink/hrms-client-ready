"""
Management command to reactivate a user account
Usage: python manage.py reactivate_user test@testing.com
"""

from django.core.management.base import BaseCommand
from excel_data.models import CustomUser, Tenant


class Command(BaseCommand):
    help = 'Reactivate a user account by email'

    def add_arguments(self, parser):
        parser.add_argument(
            'email',
            type=str,
            help='Email address of the user to reactivate',
        )
        parser.add_argument(
            '--tenant',
            action='store_true',
            help='Also reactivate the tenant if it is deactivated',
        )

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        reactivate_tenant = options.get('tenant', False)
        
        self.stdout.write(self.style.SUCCESS('=' * 80))
        self.stdout.write(self.style.SUCCESS('USER REACTIVATION'))
        self.stdout.write(self.style.SUCCESS('=' * 80))
        self.stdout.write('')
        
        try:
            user = CustomUser.objects.get(email=email)
            self.stdout.write(f'Found user: {user.email}')
            self.stdout.write(f'Current status - User Active: {user.is_active}')
            
            if user.tenant:
                tenant = user.tenant
                self.stdout.write(f'Tenant: {tenant.name} (ID: {tenant.id})')
                self.stdout.write(f'Current status - Tenant Active: {tenant.is_active}')
                if tenant.deactivated_at:
                    self.stdout.write(f'Tenant Deactivated At: {tenant.deactivated_at}')
            
            self.stdout.write('')
            
            # Reactivate user
            if not user.is_active:
                user.is_active = True
                user.save(update_fields=['is_active'])
                self.stdout.write(self.style.SUCCESS(f'✓ User {email} has been reactivated'))
            else:
                self.stdout.write(self.style.WARNING(f'User {email} is already active'))
            
            # Reactivate tenant if requested
            if user.tenant and reactivate_tenant:
                tenant = user.tenant
                if tenant.deactivated_at:
                    # This is a soft-deleted tenant, use the recover method
                    tenant.recover()
                    self.stdout.write(self.style.SUCCESS(f'✓ Tenant {tenant.name} has been recovered (soft delete reversed)'))
                elif not tenant.is_active:
                    # Regular deactivation
                    tenant.is_active = True
                    tenant.save(update_fields=['is_active'])
                    self.stdout.write(self.style.SUCCESS(f'✓ Tenant {tenant.name} has been reactivated'))
                else:
                    self.stdout.write(self.style.WARNING(f'Tenant {tenant.name} is already active'))
            elif user.tenant and user.tenant.deactivated_at:
                self.stdout.write('')
                self.stdout.write(self.style.WARNING('⚠️  Note: Tenant is soft-deleted. Use --tenant flag to recover it.'))
                self.stdout.write(self.style.WARNING('   Or the tenant will be automatically recovered when user logs in.'))
            
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('Reactivation complete!'))
            
        except CustomUser.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'✗ User not found: {email}'))
            self.stdout.write('Please check the email address and try again.')
        
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 80))


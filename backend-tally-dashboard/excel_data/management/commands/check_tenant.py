"""
Management command to check tenant and user status by email
Usage: python manage.py check_tenant test@testing.com
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from excel_data.models import Tenant, CustomUser


class Command(BaseCommand):
    help = 'Check tenant and user status by email'

    def add_arguments(self, parser):
        parser.add_argument(
            'email',
            type=str,
            help='Email address to check',
        )

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        
        self.stdout.write(self.style.SUCCESS('=' * 80))
        self.stdout.write(self.style.SUCCESS('TENANT & USER STATUS CHECK'))
        self.stdout.write(self.style.SUCCESS('=' * 80))
        self.stdout.write('')
        
        try:
            user = CustomUser.objects.get(email=email)
            self.stdout.write(self.style.SUCCESS(f'✓ User found: {email}'))
            self.stdout.write('')
            
            # User Information
            self.stdout.write(self.style.WARNING('USER INFORMATION:'))
            self.stdout.write(f'  ID: {user.id}')
            self.stdout.write(f'  Name: {user.first_name} {user.last_name}'.strip() or 'N/A')
            self.stdout.write(f'  Email: {user.email}')
            self.stdout.write(f'  Role: {user.role}')
            self.stdout.write(f'  Is Active: {user.is_active}')
            self.stdout.write(f'  Email Verified: {user.email_verified}')
            self.stdout.write(f'  Is Superuser: {user.is_superuser}')
            self.stdout.write(f'  Date Joined: {user.date_joined}')
            self.stdout.write('')
            
            # Tenant Information
            if user.tenant:
                tenant = user.tenant
                self.stdout.write(self.style.WARNING('TENANT INFORMATION:'))
                self.stdout.write(f'  ID: {tenant.id}')
                self.stdout.write(f'  Name: {tenant.name}')
                self.stdout.write(f'  Subdomain: {tenant.subdomain or "N/A"}')
                self.stdout.write(f'  Is Active: {tenant.is_active}')
                self.stdout.write(f'  Credits: {tenant.credits}')
                self.stdout.write(f'  Plan: {tenant.plan}')
                self.stdout.write(f'  Created At: {tenant.created_at}')
                self.stdout.write(f'  Last Updated: {tenant.updated_at}')
                
                # Credit Information
                if tenant.last_credit_deducted:
                    self.stdout.write(f'  Last Credit Deducted: {tenant.last_credit_deducted}')
                else:
                    self.stdout.write(f'  Last Credit Deducted: Never')
                
                # Deactivation Status
                if tenant.deactivated_at:
                    self.stdout.write('')
                    self.stdout.write(self.style.ERROR('  ⚠️  TENANT IS DEACTIVATED (SOFT DELETED)'))
                    self.stdout.write(f'  Deactivated At: {tenant.deactivated_at}')
                    
                    # Recovery Information
                    recovery_deadline = tenant.deactivated_at + timedelta(days=30)
                    days_remaining = tenant.get_recovery_days_remaining(recovery_period_days=30)
                    can_recover = tenant.can_recover(recovery_period_days=30)
                    
                    self.stdout.write('')
                    self.stdout.write(self.style.WARNING('  RECOVERY INFORMATION:'))
                    self.stdout.write(f'  Can Recover: {"✓ YES" if can_recover else "✗ NO (Period Expired)"}')
                    self.stdout.write(f'  Days Remaining: {days_remaining} day(s)')
                    self.stdout.write(f'  Recovery Deadline: {recovery_deadline}')
                    
                    if can_recover:
                        self.stdout.write(self.style.SUCCESS(f'  → User can recover by logging in within {days_remaining} day(s)'))
                    else:
                        self.stdout.write(self.style.ERROR(f'  → Recovery period expired. Account is permanently deleted.'))
                else:
                    self.stdout.write('')
                    self.stdout.write(self.style.SUCCESS('  ✓ Tenant is not deactivated (normal status)'))
                
                # Status Summary
                self.stdout.write('')
                self.stdout.write(self.style.WARNING('STATUS SUMMARY:'))
                if not tenant.is_active:
                    if tenant.deactivated_at:
                        if tenant.can_recover(recovery_period_days=30):
                            status = '🔴 DEACTIVATED (Soft Deleted - Can Recover)'
                        else:
                            status = '⚫ PERMANENTLY DELETED (Recovery Period Expired)'
                    else:
                        status = '🔴 INACTIVE (No Credits or Manual Deactivation)'
                elif tenant.credits == 0:
                    status = '⚫ NO CREDITS'
                elif tenant.credits <= 5:
                    status = '🟡 LOW CREDITS'
                else:
                    status = '🟢 ACTIVE'
                
                self.stdout.write(f'  Status: {status}')
                
            else:
                self.stdout.write(self.style.ERROR('  ✗ User has no tenant assigned'))
                self.stdout.write('')
                
        except CustomUser.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'✗ User not found: {email}'))
            self.stdout.write('')
            self.stdout.write('Please check the email address and try again.')
        
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 80))


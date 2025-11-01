from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from excel_data.models import Tenant

User = get_user_model()

class Command(BaseCommand):
    help = 'Create a superuser for the HRMS system'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='Superuser email')
        parser.add_argument('password', type=str, help='Superuser password')
        parser.add_argument('--first-name', type=str, default='Super', help='First name')
        parser.add_argument('--last-name', type=str, default='Admin', help='Last name')

    def handle(self, *args, **options):
        email = options['email']
        password = options['password']
        first_name = options['first_name']
        last_name = options['last_name']

        # Check if superuser already exists
        if User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.ERROR(f'User with email {email} already exists!')
            )
            return

        # Create superuser without tenant (system-wide admin)
        superuser = User.objects.create_superuser(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            tenant=None,  # No tenant for superuser
            is_active=True
        )

        self.stdout.write(
            self.style.SUCCESS(f'Superuser {email} created successfully!')
        )
        self.stdout.write(
            self.style.SUCCESS(f'You can now access Django admin at /admin/')
        ) 
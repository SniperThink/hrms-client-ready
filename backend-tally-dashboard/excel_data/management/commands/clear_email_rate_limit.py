"""
Management command to clear email rate limiter cache
Usage: 
    python manage.py clear_email_rate_limit --all
    python manage.py clear_email_rate_limit --email user@example.com
"""
from django.core.management.base import BaseCommand
from excel_data.services.email_rate_limiter import (
    clear_email_rate_limit,
    clear_all_email_rate_limits,
    CACHE_KEY_PREFIX
)
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Clear email rate limiter cache (all entries or specific email address)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            help='Clear rate limit cache for specific email address'
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Clear all email rate limit cache entries'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be cleared without making changes'
        )

    def handle(self, *args, **options):
        email = options.get('email')
        clear_all = options.get('all', False)
        dry_run = options.get('dry_run', False)

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No cache will be cleared'))

        if clear_all:
            # Clear all email rate limit cache
            if not dry_run:
                try:
                    cleared = clear_all_email_rate_limits()
                    if cleared == -1:
                        self.stdout.write(
                            self.style.SUCCESS('✓ Cleared all email rate limit cache entries')
                        )
                    else:
                        self.stdout.write(
                            self.style.SUCCESS(f'✓ Cleared {cleared} email rate limit cache entries')
                        )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'Error clearing email rate limit cache: {str(e)}')
                    )
            else:
                self.stdout.write(self.style.WARNING('Would clear ALL email rate limit cache'))
        
        elif email:
            # Clear cache for specific email
            if not dry_run:
                try:
                    cleared = clear_email_rate_limit(email)
                    if cleared:
                        self.stdout.write(
                            self.style.SUCCESS(f'✓ Cleared rate limit cache for {email}')
                        )
                    else:
                        self.stdout.write(
                            self.style.WARNING(f'No rate limit cache found for {email}')
                        )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'Error clearing rate limit cache: {str(e)}')
                    )
            else:
                self.stdout.write(
                    self.style.WARNING(f'Would clear rate limit cache for {email}')
                )
        
        else:
            # Show help if no options provided
            self.stdout.write(self.style.ERROR(
                'Please specify either --email <email> or --all to clear cache'
            ))
            self.stdout.write('Examples:')
            self.stdout.write('  python manage.py clear_email_rate_limit --email user@example.com')
            self.stdout.write('  python manage.py clear_email_rate_limit --all')


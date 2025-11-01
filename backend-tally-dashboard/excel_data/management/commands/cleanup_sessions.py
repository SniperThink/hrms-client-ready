"""
Management command to clean up expired sessions
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from excel_data.utils.session_manager import SessionManager


class Command(BaseCommand):
    help = 'Clean up expired user sessions'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be cleaned up without actually doing it',
        )

    def handle(self, *args, **options):
        self.stdout.write('Starting session cleanup...')
        
        if options['dry_run']:
            self.stdout.write('DRY RUN - No changes will be made')
        
        try:
            # Clean up expired sessions
            count = SessionManager.cleanup_expired_sessions()
            
            if options['dry_run']:
                self.stdout.write(
                    self.style.SUCCESS(f'Would clean up {count} expired sessions')
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(f'Successfully cleaned up {count} expired sessions')
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error during cleanup: {str(e)}')
            )
            raise

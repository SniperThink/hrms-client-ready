from django.core.management.base import BaseCommand
from excel_data.models import Tenant
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Process permanent deletion of accounts that have passed the 30-day recovery period'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )
        parser.add_argument(
            '--recovery-period',
            type=int,
            default=30,
            help='Recovery period in days (default: 30)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        recovery_period_days = options['recovery_period']
        
        logger.info("Starting expired account deletion processing")
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No accounts will be deleted'))
        
        # Find tenants that should be permanently deleted
        expired_tenants = []
        from django.utils import timezone
        from datetime import timedelta
        cutoff_date = timezone.now() - timedelta(days=recovery_period_days)
        
        all_soft_deleted = Tenant.objects.filter(deactivated_at__isnull=False)
        
        for tenant in all_soft_deleted:
            if tenant.should_permanently_delete(recovery_period_days=recovery_period_days):
                expired_tenants.append(tenant)
        
        total = len(expired_tenants)
        
        if total == 0:
            self.stdout.write(self.style.SUCCESS('No expired accounts found. All accounts are either active or within recovery period.'))
            logger.info("No expired accounts to delete")
            return
        
        self.stdout.write(f"Found {total} expired account(s) to permanently delete:")
        self.stdout.write("")
        
        for tenant in expired_tenants:
            days_expired = (timezone.now() - tenant.deactivated_at).days
            self.stdout.write(
                f"  - {tenant.name} (ID: {tenant.id}) - "
                f"Deactivated: {tenant.deactivated_at.strftime('%Y-%m-%d %H:%M:%S')} "
                f"({days_expired} days ago)"
            )
        
        if dry_run:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING(f'DRY RUN: Would delete {total} account(s)'))
            return
        
        # Confirm deletion
        self.stdout.write("")
        self.stdout.write(self.style.WARNING(f'⚠️  This will PERMANENTLY DELETE {total} account(s) and all associated data!'))
        confirm = input('Type "DELETE" to confirm: ')
        
        if confirm != 'DELETE':
            self.stdout.write(self.style.ERROR('Deletion cancelled'))
            return
        
        # Process deletions
        deleted = 0
        failed = 0
        
        for tenant in expired_tenants:
            try:
                tenant_name = tenant.name
                tenant_id = tenant.id
                tenant.permanently_delete()
                deleted += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Permanently deleted tenant "{tenant_name}" (ID: {tenant_id})')
                )
            except Exception as e:
                failed += 1
                error_msg = f"Error deleting tenant {tenant.id}: {str(e)}"
                logger.error(error_msg, exc_info=True)
                self.stderr.write(self.style.ERROR(error_msg))
        
        summary = f"Completed account deletion processing. Deleted {deleted}/{total} account(s)."
        if failed > 0:
            summary += f" {failed} failed."
        
        logger.info(summary)
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(summary))


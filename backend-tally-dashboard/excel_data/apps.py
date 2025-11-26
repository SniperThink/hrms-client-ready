from django.apps import AppConfig
from django.conf import settings
import os
import logging

logger = logging.getLogger(__name__)


def apply_pending_migrations():
    """
    Check for and automatically apply pending migrations on server start.
    This ensures the database is always up to date when the server starts.
    Uses threading to defer execution until after Django is fully initialized.
    """
    import threading
    import time
    
    def _apply_migrations():
        # Wait a bit to ensure Django is fully initialized
        print('🔄 Migration check thread started, waiting for Django initialization...')
        logger.info('⏳ Waiting for Django initialization...')
        time.sleep(0.5)
        
        try:
            from django.core.management import call_command
            from django.core.management.base import CommandError
            from django.db import connection
            from io import StringIO
            
            # Ensure database connection is ready
            print('🔌 Checking database connection...')
            logger.info('🔌 Checking database connection...')
            try:
                connection.ensure_connection()
                print('✅ Database connection ready')
                logger.info('✅ Database connection ready')
            except Exception as e:
                print(f'⚠️  Database connection not ready: {str(e)}')
                logger.warning(f'⚠️  Database connection not ready: {str(e)}')
                print('⚠️  Skipping migration check')
                logger.warning('⚠️  Skipping migration check')
                return
            
            # First, check for pending migrations
            output = StringIO()
            try:
                call_command('showmigrations', '--plan', stdout=output, stderr=output)
                output_str = output.getvalue()
                
                # Parse all migrations (both applied and unapplied)
                all_migrations = []
                applied_migrations = []
                unapplied = []
                
                for line in output_str.split('\n'):
                    line = line.strip()
                    if not line:
                        continue
                    # Check for applied migrations [X]
                    if '[X]' in line:
                        applied_migrations.append(line)
                        all_migrations.append(line)
                    # Check for unapplied migrations [ ]
                    elif '[ ]' in line:
                        unapplied.append(line)
                        all_migrations.append(line)
                
                # Find the latest migration (last one in the list)
                latest_migration = None
                if all_migrations:
                    # Get the last migration from the list
                    latest_line = all_migrations[-1]
                    # Extract migration name (format: [X] app_name.migration_name)
                    if '[X]' in latest_line:
                        latest_migration = latest_line.replace('[X]', '').strip()
                    elif '[ ]' in latest_line:
                        latest_migration = latest_line.replace('[ ]', '').strip()
                
                if unapplied:
                    print('🔄 PENDING MIGRATIONS DETECTED - Applying automatically...')
                    logger.info('🔄 PENDING MIGRATIONS DETECTED - Applying automatically...')
                    print(f'Found {len(unapplied)} unapplied migration(s):')
                    logger.info(f'Found {len(unapplied)} unapplied migration(s):')
                    for migration in unapplied[:10]:  # Show first 10
                        print(f'  - {migration.strip()}')
                        logger.info(f'  - {migration.strip()}')
                    if len(unapplied) > 10:
                        print(f'  ... and {len(unapplied) - 10} more')
                        logger.info(f'  ... and {len(unapplied) - 10} more')
                    
                    # Apply migrations
                    try:
                        print('🔄 Running migrations automatically...')
                        logger.info('🔄 Running migrations...')
                        migrate_output = StringIO()
                        call_command('migrate', '--noinput', stdout=migrate_output, stderr=migrate_output)
                        migrate_result = migrate_output.getvalue()
                        
                        # Log migration results
                        if migrate_result:
                            print('📝 Migration output:')
                            logger.info('📝 Migration output:')
                            for line in migrate_result.split('\n'):
                                if line.strip():
                                    print(f'  {line}')
                                    logger.info(f'  {line}')
                        
                        print('✅ Migrations applied successfully!')
                        logger.info('✅ Migrations applied successfully!')
                        
                        # After applying, get the new latest migration
                        output_after = StringIO()
                        call_command('showmigrations', '--plan', stdout=output_after, stderr=output_after)
                        output_after_str = output_after.getvalue()
                        all_migrations_after = [line.strip() for line in output_after_str.split('\n') if line.strip() and ('[X]' in line or '[ ]' in line)]
                        if all_migrations_after:
                            latest_after = all_migrations_after[-1]
                            if '[X]' in latest_after:
                                latest_migration = latest_after.replace('[X]', '').strip()
                            elif '[ ]' in latest_after:
                                latest_migration = latest_after.replace('[ ]', '').strip()
                    except CommandError as e:
                        logger.error(f'❌ Failed to apply migrations: {str(e)}')
                        logger.error('⚠️  Server will continue, but database may be out of sync!')
                        logger.error('⚠️  Please run: python manage.py migrate manually')
                    except Exception as e:
                        logger.error(f'❌ Unexpected error applying migrations: {str(e)}', exc_info=True)
                        logger.error('⚠️  Server will continue, but database may be out of sync!')
                else:
                    print('✅ All migrations are already applied')
                    logger.info('✅ All migrations are already applied')
                    print(f'📊 Total applied migrations: {len(applied_migrations)}')
                    logger.info(f'📊 Total applied migrations: {len(applied_migrations)}')
                    if latest_migration:
                        print(f'📌 Latest migration: {latest_migration}')
                        logger.info(f'📌 Latest migration: {latest_migration}')
                    else:
                        print('📌 No migrations found in the system')
                        logger.info('📌 No migrations found in the system')
            except CommandError as e:
                # If showmigrations fails, it might be a database connection issue
                # Don't fail startup, just log a warning
                logger.warning(f'⚠️  Could not check migrations: {str(e)}')
                logger.warning('⚠️  This might indicate a database connection issue')
                logger.warning('⚠️  Server will continue, but migrations were not checked/applied')
        except Exception as e:
            # Don't fail startup if migration check/apply fails
            logger.error(f'❌ Error checking/applying migrations: {str(e)}', exc_info=True)
            logger.error('⚠️  Server will continue, but migrations were not checked/applied')
    
    # Run in a separate thread to avoid blocking and database access during initialization
    thread = threading.Thread(target=_apply_migrations, daemon=True)
    thread.start()


class ExcelDataConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'excel_data'

    def ready(self):
        # Import signals
        import excel_data.signals  # noqa
        
        # Check for pending migrations (only in main process)
        # In development with reloader, RUN_MAIN='true' indicates the reloaded process
        # In production, we check in the main process
        should_check_migrations = (
            (os.environ.get('RUN_MAIN') == 'true' and settings.DEBUG) or
            (os.environ.get('RUN_MAIN') != 'true' and not settings.DEBUG)
        )
        
        if should_check_migrations:
            print('🔄 Starting automatic migration check on server start...')
            logger.info('🔄 Starting migration check...')
            apply_pending_migrations()
        else:
            print(f'⏭️  Skipping migration check: RUN_MAIN={os.environ.get("RUN_MAIN")}, DEBUG={settings.DEBUG}')
            logger.debug(f'Skipping migration check: RUN_MAIN={os.environ.get("RUN_MAIN")}, DEBUG={settings.DEBUG}')
        
        # Start credit scheduler (only in main process, not in reloader)
        # Check if we're in the main process (not the reloader process)
        if os.environ.get('RUN_MAIN') != 'true' and not settings.DEBUG:
            # Production mode - start schedulers
            from excel_data.credit_scheduler import start_credit_scheduler
            from excel_data.account_deletion_scheduler import start_account_deletion_scheduler
            start_credit_scheduler()
            start_account_deletion_scheduler()
        elif os.environ.get('RUN_MAIN') == 'true' and settings.DEBUG:
            # Development mode with reloader - start in reloaded process
            from excel_data.credit_scheduler import start_credit_scheduler
            from excel_data.account_deletion_scheduler import start_account_deletion_scheduler
            start_credit_scheduler()
            start_account_deletion_scheduler()

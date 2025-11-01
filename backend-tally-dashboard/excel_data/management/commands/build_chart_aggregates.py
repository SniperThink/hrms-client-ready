"""
Management command to build ChartAggregatedData from existing SalaryData and CalculatedSalary records
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from excel_data.models import (
    Tenant, SalaryData, CalculatedSalary, ChartAggregatedData
)


class Command(BaseCommand):
    help = 'Build ChartAggregatedData table from existing SalaryData and CalculatedSalary records'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant',
            type=str,
            help='Tenant subdomain or ID (optional, processes all tenants if not specified)',
        )
        parser.add_argument(
            '--tenant-id',
            type=int,
            help='Tenant ID (alternative to --tenant)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing ChartAggregatedData before building',
        )
        parser.add_argument(
            '--source',
            type=str,
            choices=['excel', 'frontend', 'both'],
            default='both',
            help='Data source to process: excel (SalaryData), frontend (CalculatedSalary), or both',
        )

    def handle(self, *args, **options):
        tenant_identifier = options.get('tenant')
        tenant_id = options.get('tenant_id')
        clear_existing = options.get('clear', False)
        source = options.get('source', 'both')
        
        # Get tenants to process
        if tenant_id:
            # Try by ID first
            try:
                tenants = Tenant.objects.filter(id=tenant_id)
                if not tenants.exists():
                    self.stdout.write(self.style.ERROR(f'Tenant with ID "{tenant_id}" not found'))
                    return
            except ValueError:
                self.stdout.write(self.style.ERROR(f'Invalid tenant ID: "{tenant_id}"'))
                return
        elif tenant_identifier:
            # Try by ID if it's numeric, otherwise try subdomain
            try:
                tenant_id_int = int(tenant_identifier)
                tenants = Tenant.objects.filter(id=tenant_id_int)
                if not tenants.exists():
                    self.stdout.write(self.style.ERROR(f'Tenant with ID "{tenant_identifier}" not found'))
                    return
            except ValueError:
                # Not numeric, try subdomain
                tenants = Tenant.objects.filter(subdomain=tenant_identifier)
                if not tenants.exists():
                    self.stdout.write(self.style.ERROR(f'Tenant with subdomain "{tenant_identifier}" not found'))
                    # Show helpful message
                    all_tenants = Tenant.objects.all()[:5]
                    if all_tenants:
                        self.stdout.write(self.style.WARNING('Available tenants (first 5):'))
                        for t in all_tenants:
                            self.stdout.write(f'  ID: {t.id}, Subdomain: {t.subdomain}, Name: {t.name}')
                    return
        else:
            tenants = Tenant.objects.all()
        
        self.stdout.write(self.style.SUCCESS(f'Processing {tenants.count()} tenant(s)...'))
        
        # Clear existing data if requested
        if clear_existing:
            self.stdout.write(self.style.WARNING('Clearing existing ChartAggregatedData...'))
            deleted_count = ChartAggregatedData.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f'Deleted {deleted_count} existing records'))
        
        total_excel = 0
        total_frontend = 0
        total_errors = 0
        
        for tenant in tenants:
            self.stdout.write(f'\n📊 Processing tenant: {tenant.subdomain}')
            
            # Process Excel data (SalaryData)
            if source in ['excel', 'both']:
                excel_count, excel_errors = self._process_salary_data(tenant)
                total_excel += excel_count
                total_errors += excel_errors
            
            # Process Frontend data (CalculatedSalary)
            if source in ['frontend', 'both']:
                frontend_count, frontend_errors = self._process_calculated_salary(tenant)
                total_frontend += frontend_count
                total_errors += frontend_errors
        
        # Summary
        self.stdout.write(self.style.SUCCESS('\n' + '='*60))
        self.stdout.write(self.style.SUCCESS('✅ Build Complete!'))
        self.stdout.write(self.style.SUCCESS(f'   Excel records: {total_excel}'))
        self.stdout.write(self.style.SUCCESS(f'   Frontend records: {total_frontend}'))
        if total_errors > 0:
            self.stdout.write(self.style.WARNING(f'   Errors: {total_errors}'))
        self.stdout.write(self.style.SUCCESS('='*60))

    def _process_salary_data(self, tenant):
        """Process SalaryData records for a tenant"""
        salary_records = SalaryData.objects.filter(tenant=tenant).select_related('tenant')
        
        if not salary_records.exists():
            self.stdout.write(self.style.WARNING('  No SalaryData found'))
            return 0, 0
        
        self.stdout.write(f'  Processing {salary_records.count()} SalaryData records...')
        
        success_count = 0
        error_count = 0
        
        with transaction.atomic():
            for salary_record in salary_records:
                try:
                    chart_data, created = ChartAggregatedData.aggregate_from_salary_data(salary_record)
                    success_count += 1
                    if created and success_count % 100 == 0:
                        self.stdout.write(f'    Created {success_count} records...', ending='\r')
                except Exception as e:
                    error_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f'    Error processing {salary_record.name} ({salary_record.month} {salary_record.year}): {e}'
                        )
                    )
        
        self.stdout.write(self.style.SUCCESS(f'  ✓ Excel: Created/Updated {success_count} ChartAggregatedData records'))
        return success_count, error_count

    def _process_calculated_salary(self, tenant):
        """Process CalculatedSalary records for a tenant"""
        calc_records = CalculatedSalary.objects.filter(
            tenant=tenant
        ).select_related('tenant', 'payroll_period')
        
        if not calc_records.exists():
            self.stdout.write(self.style.WARNING('  No CalculatedSalary found'))
            return 0, 0
        
        self.stdout.write(f'  Processing {calc_records.count()} CalculatedSalary records...')
        
        success_count = 0
        error_count = 0
        
        with transaction.atomic():
            for calc_record in calc_records:
                try:
                    chart_data, created = ChartAggregatedData.aggregate_from_calculated_salary(calc_record)
                    success_count += 1
                    if created and success_count % 100 == 0:
                        self.stdout.write(f'    Created {success_count} records...', ending='\r')
                except Exception as e:
                    error_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f'    Error processing {calc_record.employee_name} ({calc_record.payroll_period}): {e}'
                        )
                    )
        
        self.stdout.write(self.style.SUCCESS(f'  ✓ Frontend: Created/Updated {success_count} ChartAggregatedData records'))
        return success_count, error_count


import os
from django.conf import settings
import pandas as pd
from django.core.management.base import BaseCommand
from excel_data.models import SalaryData  # Adjust to your actual model

class Command(BaseCommand):
    help = 'Import salary data from Excel'

    def handle(self, *args, **kwargs):
        file_path = os.path.join(settings.BASE_DIR, 'import_files', 'updated.xlsx')
        df = pd.read_excel(file_path)

        for _, row in df.iterrows():
            SalaryData.objects.update_or_create(
                name=row['NAME'],
                defaults={
                    'basic_salary': row['SALARY'],
                    'days_absent': row['ABSENT'],
                    'days_present': row['DAYS'],
                    'ot_hours': row['OT'],
                    'ot_charges': row['OT CHARGES'],
                    'late_minutes': row['LATE'],
                    'late_charges': row['CHARGE'],
                    'salary_wo_advance_deduction': row['SAL+OT'],
                    'adv_paid_on_25th': row['ADVANCE'],
                    'repayment_of_old_adv': row['OLD ADV'],
                    'net_payable': row['NETT SALRY'],
                    'total_old_advance': row['TOTAL OLD ADVANCE'],
                    'final_balance_advance': row['BALANCE ADVANCE'],
                }
            )
        self.stdout.write(self.style.SUCCESS('Data imported successfully!'))
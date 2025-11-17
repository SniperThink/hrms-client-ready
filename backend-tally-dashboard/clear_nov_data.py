#!/usr/bin/env python
"""
Clear ALL November 2025 data for tenant 97 using RAW SQL for speed
(DailyAttendance + Excel Attendance + Salary/Payroll)
"""
import os
import sys
import time
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from django.db import connection, transaction

def print_progress_bar(iteration, total, prefix='', suffix='', decimals=1, length=50, fill='█', print_end="\r"):
    """
    Call in a loop to create terminal progress bar
    """
    percent = ("{0:." + str(decimals) + "f}").format(100 * (iteration / float(total)))
    filled_length = int(length * iteration // total)
    bar = fill * filled_length + '-' * (length - filled_length)
    print(f'\r{prefix} |{bar}| {percent}% {suffix}', end=print_end)
    if iteration == total:
        print()

def clear_november_data():
    start_time = time.time()
    tenant_id = 97
    
    print(f'🗑️  Deleting ALL November 2025 data for tenant ID: {tenant_id}')
    print(f'    (DailyAttendance + Excel Attendance + Salary/Payroll)')
    print()
    
    with connection.cursor() as cursor:
        # First, count records to be deleted using RAW SQL
        print('📊 Counting records...')
        
        cursor.execute("""
            SELECT COUNT(*) FROM excel_data_dailyattendance 
            WHERE tenant_id = %s 
            AND EXTRACT(YEAR FROM date) = 2025 
            AND EXTRACT(MONTH FROM date) = 11
        """, [tenant_id])
        daily_count = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM excel_data_attendance 
            WHERE tenant_id = %s 
            AND EXTRACT(YEAR FROM date) = 2025 
            AND EXTRACT(MONTH FROM date) = 11
        """, [tenant_id])
        att_count = cursor.fetchone()[0]
        
        # Check for PayrollPeriod and CalculatedSalary
        cursor.execute("""
            SELECT id FROM excel_data_payrollperiod 
            WHERE tenant_id = %s 
            AND year = 2025 
            AND month = %s
        """, [tenant_id, 'November'])
        payroll_period_row = cursor.fetchone()
        payroll_period_id = payroll_period_row[0] if payroll_period_row else None
        
        salary_count = 0
        if payroll_period_id:
            cursor.execute("""
                SELECT COUNT(*) FROM excel_data_calculatedsalary 
                WHERE tenant_id = %s 
                AND payroll_period_id = %s
            """, [tenant_id, payroll_period_id])
            salary_count = cursor.fetchone()[0]
        
        total_records = daily_count + att_count + salary_count
        
        print(f'   DailyAttendance: {daily_count} records')
        print(f'   Attendance (Excel): {att_count} records')
        print(f'   CalculatedSalary: {salary_count} records')
        if payroll_period_id:
            print(f'   PayrollPeriod: 1 record')
        print(f'   Total: {total_records} records')
        print()
        
        if total_records == 0:
            print('ℹ️  No records found to delete.')
            return
        
        # Confirm deletion
        print(f'⚠️  This will permanently delete {total_records} records!')
        response = input('Continue? (yes/no): ')
        if response.lower() not in ['yes', 'y']:
            print('❌ Deletion cancelled.')
            return
        
        print()
        
        # Use transaction for atomic deletion
        with transaction.atomic():
            total_deleted = 0
            current_step = 0
            total_steps = (1 if daily_count > 0 else 0) + (1 if att_count > 0 else 0) + (1 if salary_count > 0 else 0) + (1 if payroll_period_id else 0)
            
            # Delete DailyAttendance with RAW SQL
            if daily_count > 0:
                step_start = time.time()
                print_progress_bar(current_step, total_steps, prefix='Deleting', suffix='DailyAttendance...', length=40)
                
                cursor.execute("""
                    DELETE FROM excel_data_dailyattendance 
                    WHERE tenant_id = %s 
                    AND EXTRACT(YEAR FROM date) = 2025 
                    AND EXTRACT(MONTH FROM date) = 11
                """, [tenant_id])
                
                daily_deleted = cursor.rowcount
                total_deleted += daily_deleted
                current_step += 1
                elapsed = time.time() - step_start
                print_progress_bar(current_step, total_steps, prefix='Deleting', suffix=f'DailyAttendance... ✓ ({daily_deleted} in {elapsed:.2f}s)', length=40)
                print()
            
            # Delete Attendance (Excel) with RAW SQL
            if att_count > 0:
                step_start = time.time()
                print_progress_bar(current_step, total_steps, prefix='Deleting', suffix='Attendance (Excel)...', length=40)
                
                cursor.execute("""
                    DELETE FROM excel_data_attendance 
                    WHERE tenant_id = %s 
                    AND EXTRACT(YEAR FROM date) = 2025 
                    AND EXTRACT(MONTH FROM date) = 11
                """, [tenant_id])
                
                att_deleted = cursor.rowcount
                total_deleted += att_deleted
                current_step += 1
                elapsed = time.time() - step_start
                print_progress_bar(current_step, total_steps, prefix='Deleting', suffix=f'Attendance (Excel)... ✓ ({att_deleted} in {elapsed:.2f}s)', length=40)
                print()
            
            # Delete CalculatedSalary
            if salary_count > 0:
                step_start = time.time()
                print_progress_bar(current_step, total_steps, prefix='Deleting', suffix='CalculatedSalary...', length=40)
                
                cursor.execute("""
                    DELETE FROM excel_data_calculatedsalary 
                    WHERE tenant_id = %s 
                    AND payroll_period_id = %s
                """, [tenant_id, payroll_period_id])
                
                salary_deleted = cursor.rowcount
                total_deleted += salary_deleted
                current_step += 1
                elapsed = time.time() - step_start
                print_progress_bar(current_step, total_steps, prefix='Deleting', suffix=f'CalculatedSalary... ✓ ({salary_deleted} in {elapsed:.2f}s)', length=40)
                print()
            
            # Delete PayrollPeriod
            if payroll_period_id:
                step_start = time.time()
                print_progress_bar(current_step, total_steps, prefix='Deleting', suffix='PayrollPeriod...', length=40)
                
                cursor.execute("""
                    DELETE FROM excel_data_payrollperiod 
                    WHERE tenant_id = %s 
                    AND id = %s
                """, [tenant_id, payroll_period_id])
                
                period_deleted = cursor.rowcount
                total_deleted += period_deleted
                current_step += 1
                elapsed = time.time() - step_start
                print_progress_bar(current_step, total_steps, prefix='Deleting', suffix=f'PayrollPeriod... ✓ ({period_deleted} in {elapsed:.2f}s)', length=40)
                print()
            
            total_time = time.time() - start_time
            print()
            print('✅ DELETION COMPLETED SUCCESSFULLY')
            print(f'   Total records deleted: {total_deleted}')
            print(f'   Total time: {total_time:.2f}s')
            if total_time > 0:
                print(f'   Average: {total_deleted / total_time:.0f} records/sec')

if __name__ == '__main__':
    try:
        clear_november_data()
    except KeyboardInterrupt:
        print('\n\n❌ Operation cancelled by user.')
        sys.exit(1)
    except Exception as e:
        print(f'\n\n❌ Error: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)

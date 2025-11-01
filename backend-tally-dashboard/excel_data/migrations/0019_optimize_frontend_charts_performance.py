# Generated migration for optimizing frontend charts performance

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('excel_data', '0018_optimize_directory_data_indexes'),
    ]

    operations = [
        # Add composite indexes for frontend charts performance
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS excel_data_calculatedsalary_charts_perf ON excel_data_calculatedsalary (tenant_id, payroll_period_id, department);",
            reverse_sql="DROP INDEX IF EXISTS excel_data_calculatedsalary_charts_perf;"
        ),
        
        # Add index for trends aggregation (simplified for compatibility)
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS excel_data_calculatedsalary_trends_agg ON excel_data_calculatedsalary (tenant_id, payroll_period_id, net_payable, ot_hours);",
            reverse_sql="DROP INDEX IF EXISTS excel_data_calculatedsalary_trends_agg;"
        ),
        
        # Add index for salary range distribution queries
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS excel_data_calculatedsalary_salary_range ON excel_data_calculatedsalary (tenant_id, net_payable);",
            reverse_sql="DROP INDEX IF EXISTS excel_data_calculatedsalary_salary_range;"
        ),
        
        # Add index for department aggregations (simplified)
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS excel_data_calculatedsalary_dept_agg ON excel_data_calculatedsalary (tenant_id, department, net_payable);",
            reverse_sql="DROP INDEX IF EXISTS excel_data_calculatedsalary_dept_agg;"
        ),
        
        # Add covering index for top salary queries (simplified)
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS excel_data_calculatedsalary_top_salary ON excel_data_calculatedsalary (tenant_id, net_payable, employee_name);",
            reverse_sql="DROP INDEX IF EXISTS excel_data_calculatedsalary_top_salary;"
        ),
    ] 
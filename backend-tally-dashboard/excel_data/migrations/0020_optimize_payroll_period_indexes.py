from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('excel_data', '0019_optimize_frontend_charts_performance'),
    ]

    operations = [
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS excel_data_payrollperiod_latest_idx
            ON excel_data_payrollperiod (tenant_id, year DESC, month DESC);
            """,
            reverse_sql="DROP INDEX IF EXISTS excel_data_payrollperiod_latest_idx;",
        ),
    ] 
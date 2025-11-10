# Generated migration to add holiday_days field to CalculatedSalary model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('excel_data', '0039_rename_holidays_tenant_date_idx_holidays_tenant__d92347_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='calculatedsalary',
            name='holiday_days',
            field=models.IntegerField(default=0, help_text='Number of paid holidays in this period'),
        ),
    ]

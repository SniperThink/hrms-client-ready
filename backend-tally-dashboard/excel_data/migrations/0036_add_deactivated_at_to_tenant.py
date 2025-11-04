# Generated manually for soft delete with recovery period

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('excel_data', '0035_add_last_credit_deducted'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenant',
            name='deactivated_at',
            field=models.DateTimeField(blank=True, help_text='Timestamp when tenant was deactivated (for soft delete with recovery period)', null=True),
        ),
    ]


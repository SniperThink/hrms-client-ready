from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('excel_data', '0031_add_credits_to_tenant'),
    ]

    # No-op to keep migration history clean; credits handled in 0030
    operations = []

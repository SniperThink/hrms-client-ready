from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('excel_data', '0033_add_credits_field'),
    ]

    # No-op to keep migration history clean; credits handled in 0030
    operations = []

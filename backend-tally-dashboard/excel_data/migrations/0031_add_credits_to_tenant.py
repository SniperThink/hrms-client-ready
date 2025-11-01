from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('excel_data', '0030_tenant_credits_and_more'),
    ]

    # No-op to keep migration history clean; credits added in 0030
    operations = []

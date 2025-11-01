# Generated migration for ChartAggregatedData
# Smart migration that works in both scenarios:
# - Dev: Table already exists (skips creation)
# - Prod: Table doesn't exist (creates it)

from django.db import migrations, models
import django.db.models.deletion


def create_table_if_not_exists(apps, schema_editor):
    """Create table only if it doesn't already exist"""
    with schema_editor.connection.cursor() as cursor:
        # Check if table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name = 'excel_data_chartaggregateddata'
            );
        """)
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            print("Creating excel_data_chartaggregateddata table...")
            # Create the table
            cursor.execute("""
                CREATE TABLE excel_data_chartaggregateddata (
                    id BIGSERIAL PRIMARY KEY,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    year INTEGER NOT NULL,
                    month VARCHAR(20) NOT NULL,
                    period_key VARCHAR(50) NOT NULL,
                    employee_id VARCHAR(50) NOT NULL,
                    employee_name VARCHAR(255) NOT NULL,
                    department VARCHAR(100),
                    basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
                    gross_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
                    net_payable NUMERIC(12,2) NOT NULL DEFAULT 0,
                    total_working_days INTEGER NOT NULL DEFAULT 30,
                    present_days NUMERIC(5,1) NOT NULL DEFAULT 0,
                    absent_days NUMERIC(5,1) NOT NULL DEFAULT 0,
                    attendance_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
                    ot_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
                    ot_charges NUMERIC(12,2) NOT NULL DEFAULT 0,
                    late_minutes INTEGER NOT NULL DEFAULT 0,
                    late_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
                    tds_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
                    advance_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
                    total_advance_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
                    incentive NUMERIC(12,2) NOT NULL DEFAULT 0,
                    data_source VARCHAR(20) NOT NULL DEFAULT 'excel',
                    aggregated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
                    payroll_period_id BIGINT,
                    tenant_id BIGINT NOT NULL,
                    CONSTRAINT excel_data_chartaggregat_tenant_id_employee_id_ye_814a28f8_uniq 
                        UNIQUE (tenant_id, employee_id, year, month)
                );
                
                CREATE INDEX excel_data_chartaggregateddata_employee_id_e6e5f44e 
                    ON excel_data_chartaggregateddata(employee_id);
                CREATE INDEX excel_data_chartaggregateddata_employee_id_e6e5f44e_like 
                    ON excel_data_chartaggregateddata(employee_id varchar_pattern_ops);
                CREATE INDEX excel_data_chartaggregateddata_department_4489fd23 
                    ON excel_data_chartaggregateddata(department);
                CREATE INDEX excel_data_chartaggregateddata_department_4489fd23_like 
                    ON excel_data_chartaggregateddata(department varchar_pattern_ops);
                CREATE INDEX excel_data_chartaggregateddata_year_9b31875e 
                    ON excel_data_chartaggregateddata(year);
                CREATE INDEX excel_data_chartaggregateddata_month_470911e2 
                    ON excel_data_chartaggregateddata(month);
                CREATE INDEX excel_data_chartaggregateddata_month_470911e2_like 
                    ON excel_data_chartaggregateddata(month varchar_pattern_ops);
                CREATE INDEX excel_data_chartaggregateddata_period_key_ca512cba 
                    ON excel_data_chartaggregateddata(period_key);
                CREATE INDEX excel_data_chartaggregateddata_period_key_ca512cba_like 
                    ON excel_data_chartaggregateddata(period_key varchar_pattern_ops);
                CREATE INDEX excel_data_chartaggregateddata_net_payable_06bc10be 
                    ON excel_data_chartaggregateddata(net_payable);
                CREATE INDEX excel_data_chartaggregateddata_tenant_id_c8083913 
                    ON excel_data_chartaggregateddata(tenant_id);
                CREATE INDEX excel_data_chartaggregateddata_payroll_period_id_596e6935 
                    ON excel_data_chartaggregateddata(payroll_period_id);
                
                CREATE INDEX chart_period_idx 
                    ON excel_data_chartaggregateddata(tenant_id, year, month);
                CREATE INDEX chart_period_key_idx 
                    ON excel_data_chartaggregateddata(tenant_id, period_key);
                CREATE INDEX chart_employee_idx 
                    ON excel_data_chartaggregateddata(employee_id, year, month);
                CREATE INDEX chart_dept_period_idx 
                    ON excel_data_chartaggregateddata(tenant_id, department, year, month);
                CREATE INDEX chart_salary_idx 
                    ON excel_data_chartaggregateddata(tenant_id, net_payable);
                CREATE INDEX chart_attendance_idx 
                    ON excel_data_chartaggregateddata(tenant_id, attendance_percentage);
                CREATE INDEX chart_ot_idx 
                    ON excel_data_chartaggregateddata(tenant_id, ot_hours);
                
                ALTER TABLE excel_data_chartaggregateddata
                    ADD CONSTRAINT excel_data_chartaggr_payroll_period_id_596e6935_fk_excel_dat
                    FOREIGN KEY (payroll_period_id) 
                    REFERENCES excel_data_payrollperiod(id) 
                    DEFERRABLE INITIALLY DEFERRED;
                
                ALTER TABLE excel_data_chartaggregateddata
                    ADD CONSTRAINT excel_data_chartaggr_tenant_id_c8083913_fk_excel_dat
                    FOREIGN KEY (tenant_id) 
                    REFERENCES excel_data_tenant(id) 
                    DEFERRABLE INITIALLY DEFERRED;
            """)
            print("✅ Table created successfully")
        else:
            print("✅ Table already exists, skipping creation")


class Migration(migrations.Migration):

    dependencies = [
        ('excel_data', '0028_activesession_is_active'),
    ]

    operations = [
        # Run the smart table creation
        migrations.RunPython(create_table_if_not_exists, reverse_code=migrations.RunPython.noop),
        
        # Register the model in Django's state
        migrations.CreateModel(
            name='ChartAggregatedData',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('employee_id', models.CharField(db_index=True, max_length=50)),
                ('employee_name', models.CharField(max_length=255)),
                ('department', models.CharField(blank=True, db_index=True, max_length=100, null=True)),
                ('year', models.IntegerField(db_index=True)),
                ('month', models.CharField(db_index=True, max_length=20)),
                ('period_key', models.CharField(db_index=True, max_length=50)),
                ('basic_salary', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('gross_salary', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('net_payable', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('present_days', models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ('absent_days', models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ('total_working_days', models.IntegerField(default=30)),
                ('attendance_percentage', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('ot_hours', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('ot_charges', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('late_minutes', models.IntegerField(default=0)),
                ('late_deduction', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('tds_amount', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('advance_deduction', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_advance_balance', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('incentive', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('data_source', models.CharField(default='excel', max_length=20)),
                ('aggregated_at', models.DateTimeField(auto_now=True)),
                ('is_paid', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('payroll_period', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='chart_data', to='excel_data.payrollperiod')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='%(class)s_set', to='excel_data.tenant')),
            ],
            options={
                'verbose_name': 'Chart Aggregated Data',
                'verbose_name_plural': 'Chart Aggregated Data',
                'db_table': 'excel_data_chartaggregateddata',
                'ordering': ['-year', '-month', 'employee_name'],
                'unique_together': {('tenant', 'employee_id', 'year', 'month')},
            },
        ),
    ]

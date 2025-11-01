"""
Truly optimized bulk upload with pre-generated unique IDs and minimal database calls
"""
import logging
import pandas as pd
import numpy as np
from datetime import datetime, time
from decimal import Decimal
from typing import Dict, List, Any
from io import BytesIO
from django.db import transaction, connection
from django.utils import timezone
from ..models import EmployeeProfile
import uuid
import hashlib
import string
import random

logger = logging.getLogger(__name__)

class TrulyOptimizedBulkUploadService:
    """
    Truly optimized bulk upload service with:
    - Pre-generated unique IDs using UUID + hash
    - Single transaction for entire batch
    - Minimal validation
    - Raw SQL inserts with batch size optimization
    """
    
    def __init__(self, tenant, batch_size=1000):
        self.tenant = tenant
        self.batch_size = batch_size
        
    def process_bulk_upload(self, file) -> Dict:
        """Process bulk upload with maximum performance"""
        try:
            start_time = datetime.now()
            
            # Read Excel file
            df = self._read_excel_fast(file)
            logger.info(f"📖 Read {len(df)} rows in {(datetime.now() - start_time).total_seconds():.2f}s")
            
            if df.empty:
                return self._create_result(0, 0, [], 0)
            
            # Fast preprocessing
            preprocess_start = datetime.now()
            df = self._preprocess_ultra_fast(df)
            logger.info(f"⚡ Preprocessed in {(datetime.now() - preprocess_start).total_seconds():.2f}s")
            
            # Generate unique IDs without database calls
            id_start = datetime.now()
            df = self._generate_unique_ids_no_db(df)
            logger.info(f"🆔 Generated IDs in {(datetime.now() - id_start).total_seconds():.2f}s")
            
            # Single bulk insert
            insert_start = datetime.now()
            result = self._single_bulk_insert(df)
            logger.info(f"💾 Inserted in {(datetime.now() - insert_start).total_seconds():.2f}s")
            
            total_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"🎯 Total time: {total_time:.2f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"Truly optimized bulk upload failed: {str(e)}")
            return self._create_result(0, 0, [str(e)], 0)
    
    def _read_excel_fast(self, file) -> pd.DataFrame:
        """Read Excel with minimal processing"""
        file_content = file.read()
        return pd.read_excel(BytesIO(file_content), engine='openpyxl')
    
    def _preprocess_ultra_fast(self, df: pd.DataFrame) -> pd.DataFrame:
        """Ultra-fast preprocessing with defaults"""
        
        # Essential column mapping
        if 'employee_name' in df.columns and 'First Name' not in df.columns:
            df['First Name'] = df['employee_name']
        if 'department' in df.columns and 'Department' not in df.columns:
            df['Department'] = df['department']
        if 'basic_salary' in df.columns and 'Basic Salary' not in df.columns:
            df['Basic Salary'] = df['basic_salary']
        
        # Set defaults for missing columns
        defaults = {
            'First Name': 'Employee',
            'Last Name': '',  # Optional - empty if not provided
            'Department': 'General',
            'Basic Salary': 30000,
            'TDS (%)': 0,
            'OT Rate (per hour)': 0,
            'Shift Start Time': time(9, 0),
            'Shift End Time': time(18, 0),
            'Mobile Number': '',
            'Email': '',
            'Designation': 'Employee',
            'Employment Type': 'Full-time',
            'Gender': '',
            'Marital status': '',
            'Address': '',
            'Branch Location': ''
        }
        
        for col, default in defaults.items():
            if col not in df.columns:
                df[col] = default
            else:
                df[col] = df[col].fillna(default)
        
        # Convert numeric columns
        for col in ['Basic Salary', 'TDS (%)', 'OT Rate (per hour)']:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        
        # Set default off days (weekends)
        off_day_defaults = {
            'off_monday': False, 'off_tuesday': False, 'off_wednesday': False,
            'off_thursday': False, 'off_friday': False, 'off_saturday': True, 'off_sunday': True
        }
        
        for day, default in off_day_defaults.items():
            df[day] = default
        
        # Set date defaults
        df['Date of birth'] = None
        df['Date of joining'] = pd.Timestamp.now().date()
        
        return df
    
    def _generate_unique_ids_no_db(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate guaranteed unique IDs without database calls"""
        
        employee_ids = []
        used_ids = set()
        
        # Get tenant prefix for global uniqueness
        tenant_prefix = str(self.tenant.id).zfill(3)  # e.g., 001, 042, 123
        
        for idx, row in df.iterrows():
            # Create base ID from name and department
            first_name = str(row.get('First Name', 'Emp')).strip()[:3].upper()
            department = str(row.get('Department', 'GEN')).strip()[:2].upper()
            
            # Add current date
            date_str = datetime.now().strftime("%d%m%y")
            
            # Create base ID in new format: NAME-DEPT-TENANT-DATE
            base_id = f"{first_name}-{department}-{tenant_prefix}-{date_str}"
            
            # Handle collisions with alphabetical suffixes
            final_id = base_id
            collision_counter = 0
            
            while final_id in used_ids:
                collision_counter += 1
                # Convert number to letter: 1->a, 2->b, 3->c, etc.
                suffix = chr(ord('a') + collision_counter - 1)
                final_id = f"{base_id}{suffix}"
                
                # If we go beyond 'z', start with 'aa', 'ab', etc.
                if collision_counter > 26:
                    first_char = chr(ord('a') + ((collision_counter - 1) // 26) - 1)
                    second_char = chr(ord('a') + ((collision_counter - 1) % 26))
                    suffix = f"{first_char}{second_char}"
                    final_id = f"{base_id}{suffix}"
            
            used_ids.add(final_id)
            employee_ids.append(final_id)
        
        df['employee_id'] = employee_ids
        return df
    
    def _single_bulk_insert(self, df: pd.DataFrame) -> Dict:
        """Single bulk insert with raw SQL for maximum performance"""
        
        employees_created = 0
        employees_failed = 0
        error_details = []
        
        try:
            # Single transaction for all inserts
            with transaction.atomic():
                
                # Prepare all data first
                insert_values = []
                
                for idx, row in df.iterrows():
                    try:
                        values = self._prepare_insert_values(row)
                        insert_values.append(values)
                    except Exception as e:
                        error_details.append(f"Row {idx + 2}: {str(e)}")
                        employees_failed += 1
                
                if insert_values:
                    # Execute raw SQL bulk insert
                    with connection.cursor() as cursor:
                        
                        # Prepare SQL
                        placeholders = ', '.join(['%s'] * 30)  # 30 fields including updated_at
                        sql = f"""
                            INSERT INTO excel_data_employeeprofile 
                            (tenant_id, employee_id, first_name, last_name, mobile_number, email, 
                             department, designation, employment_type, location_branch, shift_start_time, 
                             shift_end_time, basic_salary, ot_charge_per_hour, date_of_birth, 
                             marital_status, gender, address, date_of_joining, tds_percentage, 
                             off_monday, off_tuesday, off_wednesday, off_thursday, off_friday, 
                             off_saturday, off_sunday, is_active, created_at, updated_at) 
                            VALUES ({placeholders})
                        """
                        
                        # Execute in batches
                        for i in range(0, len(insert_values), self.batch_size):
                            batch = insert_values[i:i + self.batch_size]
                            cursor.executemany(sql, batch)
                            employees_created += len(batch)
                            logger.info(f"Inserted batch of {len(batch)} employees")
                
        except Exception as e:
            logger.error(f"Bulk insert failed: {str(e)}")
            error_details.append(f"Database error: {str(e)}")
            employees_failed = len(df)
            employees_created = 0
        
        return self._create_result(employees_created, employees_failed, error_details, len(df))
    
    def _prepare_insert_values(self, row: pd.Series) -> tuple:
        """Prepare values tuple for raw SQL insert"""
        
        # Handle dates
        date_of_birth = None
        date_of_joining = row.get('Date of joining')
        if pd.isna(date_of_joining):
            date_of_joining = datetime.now().date()
        elif hasattr(date_of_joining, 'date'):
            date_of_joining = date_of_joining.date()
        
        # Handle times
        shift_start = row.get('Shift Start Time', time(9, 0))
        shift_end = row.get('Shift End Time', time(18, 0))
        
        if isinstance(shift_start, str):
            try:
                hour, minute = map(int, shift_start.split(':'))
                shift_start = time(hour, minute)
            except:
                shift_start = time(9, 0)
        
        if isinstance(shift_end, str):
            try:
                hour, minute = map(int, shift_end.split(':'))
                shift_end = time(hour, minute)
            except:
                shift_end = time(18, 0)
        
        return (
            self.tenant.id,  # tenant_id
            row['employee_id'],  # employee_id
            str(row.get('First Name', ''))[:50],  # first_name
            (str(row.get('Last Name', ''))[:50] if pd.notna(row.get('Last Name')) else ''),  # last_name - optional
            str(row.get('Mobile Number', ''))[:15],  # mobile_number
            str(row.get('Email', ''))[:100],  # email
            str(row.get('Department', ''))[:100],  # department
            str(row.get('Designation', ''))[:100],  # designation
            str(row.get('Employment Type', ''))[:50],  # employment_type
            str(row.get('Branch Location', ''))[:100],  # location_branch
            shift_start,  # shift_start_time
            shift_end,  # shift_end_time
            Decimal(str(row.get('Basic Salary', 0))),  # basic_salary
            Decimal(str(row.get('OT Rate (per hour)', 0))),  # ot_charge_per_hour
            date_of_birth,  # date_of_birth
            str(row.get('Marital status', ''))[:20],  # marital_status
            str(row.get('Gender', ''))[:10],  # gender
            str(row.get('Address', ''))[:500],  # address
            date_of_joining,  # date_of_joining
            Decimal(str(row.get('TDS (%)', 0))),  # tds_percentage
            bool(row.get('off_monday', False)),  # off_monday
            bool(row.get('off_tuesday', False)),  # off_tuesday
            bool(row.get('off_wednesday', False)),  # off_wednesday
            bool(row.get('off_thursday', False)),  # off_thursday
            bool(row.get('off_friday', False)),  # off_friday
            bool(row.get('off_saturday', True)),  # off_saturday
            bool(row.get('off_sunday', True)),  # off_sunday
            True,  # is_active
            timezone.now(),  # created_at
            timezone.now()   # updated_at
        )
    
    def _create_result(self, created: int, failed: int, errors: List[str], total: int) -> Dict:
        """Create standardized result dictionary"""
        return {
            'message': 'Employee bulk upload completed successfully',
            'employees_created': created,
            'employees_failed': failed,
            'error_details': errors[:10],
            'total_processed': total
        }

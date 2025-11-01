#!/usr/bin/env python3
"""
Script to upload ALL attendance data from monthly_attendance_fixed directory
"""
import requests
import os
import json
import re
from pathlib import Path

def extract_month_year(filename):
    """Extract month and year from filename like 'January_2022_Attendance.xlsx'"""
    # Remove .xlsx extension
    name = filename.replace('_Attendance.xlsx', '')
    
    # Split by underscore
    parts = name.split('_')
    if len(parts) >= 2:
        month_name = parts[0]
        year = parts[1]
        
        # Convert month name to number
        month_map = {
            'January': '1', 'February': '2', 'March': '3', 'April': '4',
            'May': '5', 'June': '6', 'July': '7', 'August': '8',
            'September': '9', 'October': '10', 'November': '11', 'December': '12'
        }
        
        month_num = month_map.get(month_name, '1')
        return month_num, year
    
    return '1', '2022'  # Default fallback

def upload_all_attendance():
    """Upload all attendance files from monthly_attendance_fixed directory"""
    
    # Step 1: Authenticate
    auth_url = "http://localhost:8000/api/public/login/"
    login_data = {
        "email": "test@client.com",
        "password": "Test@123"
    }
    
    print("🔐 Authenticating...")
    try:
        auth_response = requests.post(auth_url, json=login_data)
        
        if auth_response.status_code == 200:
            auth_result = auth_response.json()
            token = auth_result.get('access')
            
            if not token:
                print("❌ No token found in response")
                return False
                
            print("✅ Authentication successful!")
            
            # Step 2: Get all attendance files
            # Get project root directory (two levels up from scripts/utilities/)
            project_root = Path(__file__).parent.parent.parent
            attendance_dir = project_root / "monthly_attendance_fixed"
            if not attendance_dir.exists():
                print("❌ monthly_attendance_fixed directory not found!")
                return False
            
            # Get all Excel files
            excel_files = list(attendance_dir.glob("*_Attendance.xlsx"))
            excel_files.sort()  # Sort alphabetically for organized upload
            
            print(f"📁 Found {len(excel_files)} attendance files")
            print("=" * 60)
            
            upload_url = "http://localhost:8000/api/upload-attendance/"
            headers = {'Authorization': f'Bearer {token}'}
            
            # Statistics
            total_uploaded = 0
            total_errors = 0
            failed_files = []
            successful_files = []
            
            # Upload each file
            for i, file_path in enumerate(excel_files, 1):
                filename = file_path.name
                month, year = extract_month_year(filename)
                
                print(f"[{i:2d}/{len(excel_files)}] 📤 {filename}")
                print(f"    Month: {month}, Year: {year}")
                
                try:
                    files = {
                        'file': (filename, open(file_path, 'rb'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                    }
                    
                    data = {
                        'month': month,
                        'year': year
                    }
                    
                    upload_response = requests.post(upload_url, files=files, data=data, headers=headers)
                    files['file'][1].close()
                    
                    if upload_response.status_code in [200, 201]:
                        result = upload_response.json()
                        print(f"    ✅ Upload successful!")
                        print(f"    📊 Records: {result.get('created', 0) + result.get('updated', 0)}")
                        print(f"    🔄 Updated: {result.get('updated', 0)}")
                        print(f"    ⚠️ Failed: {result.get('failed', 0)}")
                        
                        if result.get('errors'):
                            error_count = len(result['errors'])
                            total_errors += error_count
                            print(f"    ❌ Errors: {error_count}")
                        
                        successful_files.append(filename)
                        total_uploaded += 1
                    else:
                        print(f"    ❌ Upload failed: {upload_response.status_code}")
                        print(f"    Response: {upload_response.text[:200]}...")
                        failed_files.append(filename)
                        
                except Exception as e:
                    print(f"    ❌ Error: {str(e)}")
                    failed_files.append(filename)
                    total_errors += 1
                
                print()  # Empty line for readability
            
            # Final summary
            print("=" * 60)
            print("🎉 UPLOAD SUMMARY")
            print("=" * 60)
            print(f"📤 Total files processed: {len(excel_files)}")
            print(f"✅ Successfully uploaded: {total_uploaded}")
            print(f"❌ Failed uploads: {len(failed_files)}")
            print(f"⚠️ Total errors encountered: {total_errors}")
            
            if successful_files:
                print(f"\n✅ Successful uploads ({len(successful_files)}):")
                for file in successful_files[:10]:  # Show first 10
                    print(f"   - {file}")
                if len(successful_files) > 10:
                    print(f"   ... and {len(successful_files) - 10} more")
            
            if failed_files:
                print(f"\n❌ Failed uploads ({len(failed_files)}):")
                for file in failed_files:
                    print(f"   - {file}")
            
            print(f"\n🚀 You now have attendance data for {total_uploaded} months!")
            
            return True
                
        else:
            print(f"❌ Authentication failed with status {auth_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    print("📅 COMPREHENSIVE ATTENDANCE UPLOAD")
    print("=" * 60)
    print("This script will upload ALL attendance files from the")
    print("monthly_attendance_fixed directory.")
    print()
    
    # Show what files will be uploaded
    project_root = Path(__file__).parent.parent.parent
    attendance_dir = project_root / "monthly_attendance_fixed"
    if attendance_dir.exists():
        excel_files = list(attendance_dir.glob("*_Attendance.xlsx"))
        excel_files.sort()
        
        print(f"📁 Found {len(excel_files)} files to upload:")
        print("📋 Files by year:")
        
        years = {}
        for file_path in excel_files:
            month, year = extract_month_year(file_path.name)
            if year not in years:
                years[year] = []
            years[year].append(file_path.name.replace('_Attendance.xlsx', ''))
        
        for year in sorted(years.keys()):
            print(f"   {year}: {len(years[year])} months")
            for month in sorted(years[year]):
                print(f"     - {month}")
        
        print()
        print("🚀 Starting automatic upload...")
        upload_all_attendance()
    else:
        print("❌ monthly_attendance_fixed directory not found!")

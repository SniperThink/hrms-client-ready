#!/usr/bin/env python3
"""
Script to upload attendance data for multiple months
"""
import requests
import os
import json

def upload_multiple_months():
    """Upload attendance data for multiple months"""
    
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
            
            # Step 2: Define months to upload
            # Update this list with the months you want to upload
            months_to_upload = [
                {'month': '8', 'year': '2022', 'file': 'August_2022_Attendance.xlsx'},
                {'month': '9', 'year': '2022', 'file': 'September_2022_Attendance.xlsx'},
                {'month': '10', 'year': '2022', 'file': 'October_2022_Attendance.xlsx'},
                {'month': '11', 'year': '2022', 'file': 'November_2022_Attendance.xlsx'},
                {'month': '12', 'year': '2022', 'file': 'December_2022_Attendance.xlsx'},
            ]
            
            upload_url = "http://localhost:8000/api/upload-attendance/"
            headers = {'Authorization': f'Bearer {token}'}
            
            total_uploaded = 0
            total_errors = 0
            
            for upload_info in months_to_upload:
                month = upload_info['month']
                year = upload_info['year']
                file_path = upload_info['file']
                
                # Check if file exists
                if not os.path.exists(file_path):
                    print(f"⚠️ Skipping {file_path} - file not found")
                    continue
                
                print(f"\n📤 Uploading {file_path} for {month}/{year}...")
                
                try:
                    files = {
                        'file': (os.path.basename(file_path), open(file_path, 'rb'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                    }
                    
                    data = {
                        'month': month,
                        'year': year
                    }
                    
                    upload_response = requests.post(upload_url, files=files, data=data, headers=headers)
                    files['file'][1].close()
                    
                    if upload_response.status_code in [200, 201]:
                        result = upload_response.json()
                        print(f"✅ Upload successful!")
                        print(f"   📊 Records processed: {result.get('total_records', 'N/A')}")
                        print(f"   ✅ Created: {result.get('created', 'N/A')}")
                        print(f"   🔄 Updated: {result.get('updated', 'N/A')}")
                        print(f"   ⚠️ Failed: {result.get('failed', 'N/A')}")
                        
                        if result.get('errors'):
                            error_count = len(result['errors'])
                            total_errors += error_count
                            print(f"   ❌ Errors: {error_count}")
                        
                        total_uploaded += 1
                    else:
                        print(f"❌ Upload failed with status {upload_response.status_code}")
                        print(f"   Response: {upload_response.text}")
                        
                except Exception as e:
                    print(f"❌ Error uploading {file_path}: {str(e)}")
                    total_errors += 1
            
            print(f"\n🎉 Upload Summary:")
            print(f"   📤 Total months uploaded: {total_uploaded}")
            print(f"   ❌ Total errors: {total_errors}")
            
            return True
                
        else:
            print(f"❌ Authentication failed with status {auth_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    print("📅 Multiple Month Attendance Upload Tool")
    print("=" * 50)
    print("This script will upload attendance data for multiple months.")
    print("Make sure you have the Excel files ready in the current directory.")
    print()
    
    # List expected files
    expected_files = [
        'August_2022_Attendance.xlsx',
        'September_2022_Attendance.xlsx', 
        'October_2022_Attendance.xlsx',
        'November_2022_Attendance.xlsx',
        'December_2022_Attendance.xlsx'
    ]
    
    print("📋 Expected files:")
    for file in expected_files:
        exists = "✅" if os.path.exists(file) else "❌"
        print(f"   {exists} {file}")
    
    print()
    response = input("Do you want to proceed? (y/n): ")
    
    if response.lower() == 'y':
        upload_multiple_months()
    else:
        print("Upload cancelled.")

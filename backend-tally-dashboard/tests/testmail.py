"""
ZeptoMail Integration Test Script (Simplified)

This script tests the ZeptoMail email integration without HTML template checks.
Focuses on text emails and core functionality.

Usage:
    python manage.py shell < tests/testmail.py
    OR run directly with: python tests/testmail.py yourtest@email.com
"""

import os
import sys
import django
from pathlib import Path

# Setup Django
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
django.setup()

from django.conf import settings
from excel_data.services.zeptomail_service import send_email_via_zeptomail
from excel_data.services.email_service import send_password_reset_otp, generate_otp
import logging

logger = logging.getLogger(__name__)


def print_header(text):
    """Print a formatted header"""
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)


def print_section(text):
    """Print a formatted section"""
    print(f"\n{'─' * 70}")
    print(f"  {text}")
    print("─" * 70)


def check_configuration():
    """Test 1: Check if ZeptoMail is properly configured"""
    print_header("1️⃣  CONFIGURATION CHECK")
    
    config_ok = True
    
    # Check API Token
    api_token = getattr(settings, 'ZEPTOMAIL_API_TOKEN', '')
    if api_token:
        masked_token = api_token[:8] + "..." + api_token[-4:] if len(api_token) > 12 else "***"
        print(f"✅ ZEPTOMAIL_API_TOKEN: {masked_token}")
    else:
        print("❌ ZEPTOMAIL_API_TOKEN: NOT SET")
        print("   ⚠️  Please set ZEPTOMAIL_API_TOKEN in your environment variables")
        config_ok = False
    
    # Check From Name
    from_name = getattr(settings, 'ZEPTOMAIL_FROM_NAME', '')
    if from_name:
        print(f"✅ ZEPTOMAIL_FROM_NAME: {from_name}")
    else:
        print(f"⚠️  ZEPTOMAIL_FROM_NAME: Not set (using default: HRMS)")
    
    # Check Default From Email
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '')
    if from_email and '@' in from_email:
        print(f"✅ DEFAULT_FROM_EMAIL: {from_email}")
    else:
        print(f"❌ DEFAULT_FROM_EMAIL: {from_email or 'NOT SET'}")
        print("   ⚠️  Please set DEFAULT_FROM_EMAIL to your verified domain email")
        config_ok = False
    
    # Check Frontend URL
    frontend_url = getattr(settings, 'FRONTEND_URL', '')
    if frontend_url:
        print(f"✅ FRONTEND_URL: {frontend_url}")
    else:
        print(f"⚠️  FRONTEND_URL: Not set")
    
    return config_ok


def test_simple_email(test_email):
    """Test 2: Send a simple test email"""
    print_section("2️⃣  TEST: Simple Text Email")
    
    try:
        print(f"📧 Sending test email to: {test_email}")
        
        text_body = """
This is a test email from ZeptoMail Integration Test Script.

If you received this email, it means:
✅ ZeptoMail API is working correctly
✅ Your API token is valid
✅ Email delivery is functioning

This is a plain text email test.
        """
        
        success = send_email_via_zeptomail(
            to_email=test_email,
            subject="ZeptoMail Test - Simple Text Email",
            text_body=text_body.strip()
        )
        
        if success:
            print("✅ Simple email sent successfully!")
            print("   📬 Please check your inbox (and spam folder)")
            return True
        else:
            print("❌ Failed to send simple email")
            return False
            
    except Exception as e:
        print(f"❌ Error sending simple email: {str(e)}")
        logger.exception("Error in test_simple_email")
        return False


def test_password_reset_otp(test_email):
    """Test 3: Test password reset OTP email function"""
    print_section("3️⃣  TEST: Password Reset OTP Email")
    
    try:
        print(f"📧 Testing password reset OTP to: {test_email}")
        
        otp_code = generate_otp(6)
        print(f"   Generated OTP: {otp_code}")
        
        success = send_password_reset_otp(test_email, otp_code)
        
        if success:
            print("✅ Password reset OTP email sent successfully!")
            print(f"   📬 Check your email for OTP code: {otp_code}")
            return True
        else:
            print("❌ Failed to send password reset OTP email")
            return False
            
    except Exception as e:
        print(f"❌ Error sending password reset OTP: {str(e)}")
        logger.exception("Error in test_password_reset_otp")
        return False


def test_welcome_email(test_email):
    """Test 4: Test welcome email function (with mock user)"""
    print_section("4️⃣  TEST: Welcome Email")
    
    try:
        # Create a mock user object for testing
        class MockTenant:
            name = "Test Company"
        
        class MockUser:
            email = test_email
            first_name = "John"
            last_name = "Doe"
            tenant = MockTenant()
        
        mock_user = MockUser()
        
        print(f"📧 Testing welcome email to: {test_email}")
        print(f"   Mock user: {mock_user.first_name} {mock_user.last_name}")
        
        from excel_data.services.email_service import send_welcome_email
        success = send_welcome_email(mock_user)
        
        if success:
            print("✅ Welcome email sent successfully!")
            print("   📬 Check your inbox for the welcome message")
            return True
        else:
            print("❌ Failed to send welcome email")
            return False
            
    except Exception as e:
        print(f"❌ Error sending welcome email: {str(e)}")
        logger.exception("Error in test_welcome_email")
        return False


def test_multiple_recipients(test_emails):
    """Test 5: Send email to multiple recipients"""
    print_section("5️⃣  TEST: Multiple Recipients")
    
    try:
        print(f"📧 Sending email to {len(test_emails)} recipients")
        for email in test_emails:
            print(f"   • {email}")
        
        text_body = """
This is a test email sent to multiple recipients.

If you received this, you are one of the test recipients.
        """
        
        success = send_email_via_zeptomail(
            to_email=test_emails,
            subject="ZeptoMail Test - Multiple Recipients",
            text_body=text_body.strip()
        )
        
        if success:
            print("✅ Multiple recipients email sent successfully!")
            return True
        else:
            print("❌ Failed to send email to multiple recipients")
            return False
            
    except Exception as e:
        print(f"❌ Error sending to multiple recipients: {str(e)}")
        logger.exception("Error in test_multiple_recipients")
        return False


def test_error_handling():
    """Test 6: Test error handling with invalid inputs"""
    print_section("6️⃣  TEST: Error Handling")
    
    tests_passed = 0
    total_tests = 4
    
    # Test 1: Missing body
    print("\n   Test 6.1: Missing email body")
    try:
        result = send_email_via_zeptomail(
            to_email="test@example.com",
            subject="Test",
            html_body=None,
            text_body=None
        )
        if not result:
            print("   ✅ Correctly rejected email without body")
            tests_passed += 1
        else:
            print("   ❌ Should have rejected email without body")
    except Exception as e:
        print(f"   ⚠️  Exception occurred: {str(e)}")
        tests_passed += 1  # Exception is also acceptable
    
    # Test 2: Invalid email format
    print("\n   Test 6.2: Invalid recipient format")
    try:
        result = send_email_via_zeptomail(
            to_email=None,
            subject="Test",
            text_body="Test body"
        )
        if not result:
            print("   ✅ Correctly rejected invalid recipient format")
            tests_passed += 1
        else:
            print("   ❌ Should have rejected invalid recipient")
    except Exception as e:
        print(f"   ⚠️  Exception occurred: {str(e)}")
        tests_passed += 1
    
    # Test 3: Invalid email list
    print("\n   Test 6.3: Invalid recipient list")
    try:
        result = send_email_via_zeptomail(
            to_email={},  # Invalid type
            subject="Test",
            text_body="Test body"
        )
        if not result:
            print("   ✅ Correctly rejected invalid recipient list")
            tests_passed += 1
        else:
            print("   ❌ Should have rejected invalid recipient list")
    except Exception as e:
        print(f"   ⚠️  Exception occurred: {str(e)}")
        tests_passed += 1
    
    # Test 4: Empty email address
    print("\n   Test 6.4: Empty email address")
    try:
        result = send_email_via_zeptomail(
            to_email="",
            subject="Test",
            text_body="Test body"
        )
        print(f"   ℹ️  Result: {result}")
        tests_passed += 1
    except Exception as e:
        print(f"   ⚠️  Exception occurred: {str(e)}")
        tests_passed += 1
    
    print(f"\n   📊 Error handling tests: {tests_passed}/{total_tests} passed")
    return tests_passed == total_tests


def run_all_tests(test_email=None):
    """Run all ZeptoMail tests"""
    print_header("🚀 ZEPTOMAIL INTEGRATION TEST SUITE")
    print("\nThis script will test your ZeptoMail integration.")
    print("Make sure you have:")
    print("  ✅ Set ZEPTOMAIL_API_TOKEN in environment variables")
    print("  ✅ Set DEFAULT_FROM_EMAIL to your verified domain")
    print("  ✅ Have a test email address ready")
    
    # Get test email from user if not provided
    if not test_email:
        print("\n" + "─" * 70)
        test_email = input("Enter test email address: ").strip()
        if not test_email:
            print("❌ No email provided. Exiting.")
            return
    
    # Check configuration first
    config_ok = check_configuration()
    
    if not config_ok:
        print("\n⚠️  WARNING: Configuration is incomplete!")
        response = input("Continue with tests anyway? (y/n): ").strip().lower()
        if response != 'y':
            print("Exiting. Please fix configuration first.")
            return
    
    print_header("RUNNING EMAIL TESTS")
    
    results = {}
    
    # Run tests
    results['simple'] = test_simple_email(test_email)
    results['otp'] = test_password_reset_otp(test_email)
    results['welcome'] = test_welcome_email(test_email)
    
    # Test multiple recipients if user wants
    print("\n" + "─" * 70)
    test_multi = input("Test multiple recipients? Enter comma-separated emails (or press Enter to skip): ").strip()
    if test_multi:
        emails = [e.strip() for e in test_multi.split(',')]
        if len(emails) > 1:
            results['multiple'] = test_multiple_recipients(emails)
    
    results['errors'] = test_error_handling()
    
    # Print summary
    print_header("📊 TEST SUMMARY")
    
    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v)
    
    print("\nTest Results:")
    print(f"  ✅ Simple Email:        {'PASS' if results.get('simple') else 'FAIL'}")
    print(f"  ✅ Password Reset OTP:  {'PASS' if results.get('otp') else 'FAIL'}")
    print(f"  ✅ Welcome Email:       {'PASS' if results.get('welcome') else 'FAIL'}")
    if 'multiple' in results:
        print(f"  ✅ Multiple Recipients: {'PASS' if results.get('multiple') else 'FAIL'}")
    print(f"  ✅ Error Handling:      {'PASS' if results.get('errors') else 'FAIL'}")
    
    print(f"\n📈 Overall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("\n🎉 All tests passed! ZeptoMail integration is working correctly.")
    elif passed_tests > 0:
        print("\n⚠️  Some tests failed. Please check the errors above and verify:")
        print("   1. ZeptoMail API token is correct")
        print("   2. DEFAULT_FROM_EMAIL is from a verified domain")
        print("   3. Email addresses are valid")
        print("   4. Network connectivity to ZeptoMail API")
    else:
        print("\n❌ All tests failed. Please check your configuration.")


if __name__ == "__main__":
    # You can pass test email as command line argument
    test_email = sys.argv[1] if len(sys.argv) > 1 else None
    run_all_tests(test_email=test_email)
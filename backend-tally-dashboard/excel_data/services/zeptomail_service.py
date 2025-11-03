import requests
import logging
import json
from django.conf import settings

logger = logging.getLogger(__name__)

# ZeptoMail API Configuration
# Use .in domain for Indian accounts, .com for international
ZEPTOMAIL_API_URL = "https://api.zeptomail.in/v1.1/email"
ZEPTOMAIL_BATCH_API_URL = "https://api.zeptomail.in/v1.1/email/batch"


def send_email_via_zeptomail(
    to_email,
    subject,
    html_body=None,
    text_body=None,
    from_email=None,
    from_name=None,
    reply_to=None
):
    """
    Send email using ZeptoMail API
    
    Args:
        to_email: Recipient email address (string) or list of email addresses
        subject: Email subject
        html_body: HTML email body (optional)
        text_body: Plain text email body (optional, required if html_body not provided)
        from_email: Sender email (defaults to DEFAULT_FROM_EMAIL)
        from_name: Sender name (optional)
        reply_to: Reply-to email address (optional)
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        api_token = getattr(settings, 'ZEPTOMAIL_API_TOKEN', '')
        
        if not api_token:
            logger.error("ZeptoMail API token not configured in settings")
            print("\n❌ ERROR: ZEPTOMAIL_API_TOKEN is not set in settings")
            return False
        
        # Handle API token format - remove prefix if already present
        original_token = api_token
        api_token = api_token.strip()
        
        # Remove common prefixes if present
        prefixes_to_remove = [
            "Zoho-enczapikey ",
            "Zoho-enczapikey",
            "zoho-enczapikey ",
            "zoho-enczapikey",
        ]
        
        for prefix in prefixes_to_remove:
            if api_token.startswith(prefix):
                api_token = api_token[len(prefix):].strip()
                break
        
        if not api_token:
            logger.error("ZeptoMail API token is empty after cleaning")
            print("\n❌ ERROR: API token is empty. Please check your ZEPTOMAIL_API_TOKEN setting.")
            return False
        
        from_email = from_email or getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@yourdomain.com')
        from_name = from_name or getattr(settings, 'ZEPTOMAIL_FROM_NAME', 'HRMS')
        
        # Handle multiple recipients
        if isinstance(to_email, str):
            recipients = [{"email_address": {"address": to_email}}]
        elif isinstance(to_email, list):
            recipients = [{"email_address": {"address": email}} for email in to_email]
        else:
            logger.error(f"Invalid recipient format: {to_email}")
            return False
        
        headers = {
            "Authorization": f"Zoho-enczapikey {api_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Build payload matching the working curl format
        payload = {
            "from": {
                "address": from_email
            },
            "to": recipients,
            "subject": subject,
        }
        
        # Add name to from if provided
        if from_name:
            payload["from"]["name"] = from_name
        
        # Add reply-to if provided
        if reply_to:
            payload["reply_to"] = {
                "address": reply_to
            }
            if from_name:
                payload["reply_to"]["name"] = from_name
        
        # Add email body - ZeptoMail requires either htmlbody or textbody
        if html_body:
            payload["htmlbody"] = html_body
            if text_body:
                payload["textbody"] = text_body
        elif text_body:
            payload["textbody"] = text_body
        else:
            logger.error("Either html_body or text_body must be provided")
            return False
        
        # Debug: Log payload in debug mode
        if settings.DEBUG:
            debug_payload = payload.copy()
            logger.debug(f"ZeptoMail API Request: {json.dumps(debug_payload, indent=2)}")
        
        response = requests.post(ZEPTOMAIL_API_URL, json=payload, headers=headers, timeout=30)
        
                # ZeptoMail returns 201 (Created) for successful email submissions, 200 is also acceptable
        if response.status_code in [200, 201]:
            try:
                result = response.json()
                logger.info(f"Email sent successfully via ZeptoMail to {to_email} (status: {response.status_code})")
                if settings.DEBUG:
                    logger.debug(f"ZeptoMail response: {json.dumps(result, indent=2)}")
                return True
            except ValueError:
                # Response might not be JSON
                logger.info(f"Email sent successfully via ZeptoMail to {to_email} (status: {response.status_code})")
                return True
        else:
            # Enhanced error logging
            error_msg = f"ZeptoMail API error for {to_email}: Status {response.status_code}"
            
            try:
                error_detail = response.json()
                error_msg += f" - {json.dumps(error_detail, indent=2)}"
                logger.error(error_msg)
            except ValueError:
                # Response is not JSON, try text
                error_text = response.text
                if error_text:
                    error_msg += f" - {error_text}"
                else:
                    error_msg += " - (Empty response body)"
                logger.error(error_msg)
            
            # Print detailed error for debugging
            print(f"\n❌ ERROR DETAILS:")
            print(f"   Status Code: {response.status_code}")
            
            # Show token info if 401 (authentication error)
            if response.status_code == 401:
                print(f"   ⚠️  AUTHENTICATION ERROR - Check your API token")
                print(f"      • Token length: {len(api_token)} characters")
                print(f"      • Token starts with: {api_token[:10]}...")
            
            print(f"   Response Text: {response.text[:500]}")
            print(f"   Request URL: {ZEPTOMAIL_API_URL}")
            print(f"   From Email: {from_email}")
            print(f"   To Email: {to_email}")
            if settings.DEBUG:
                print(f"   Payload: {json.dumps(payload, indent=2)}")
            
            return False
            
    except requests.exceptions.RequestException as e:
        error_msg = f"Network error while sending email via ZeptoMail to {to_email}: {str(e)}"
        logger.error(error_msg)
        print(f"\n❌ NETWORK ERROR: {error_msg}")
        return False
    except Exception as e:
        error_msg = f"Failed to send email via ZeptoMail to {to_email}: {str(e)}"
        logger.error(error_msg)
        logger.exception("ZeptoMail exception details")
        print(f"\n❌ EXCEPTION: {error_msg}")
        return False
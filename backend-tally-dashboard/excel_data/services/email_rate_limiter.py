"""
Email Rate Limiting Service
Prevents email abuse by limiting the number of emails sent per email address
"""

import time
from django.core.cache import cache
from decouple import config
import logging

logger = logging.getLogger(__name__)

# Rate limiting configuration
EMAIL_RATE_LIMIT_COUNT = config('EMAIL_RATE_LIMIT_COUNT', default=1000, cast=int)  # Maximum number of emails per time window
EMAIL_RATE_LIMIT_WINDOW = config('EMAIL_RATE_LIMIT_WINDOW', default=7200, cast=int)  # Time window in seconds (2 hours = 7200 seconds)
CACHE_KEY_PREFIX = 'email_rate_limit_'


def can_send_email(email_address):
    """
    Check if an email can be sent to the given email address based on rate limiting rules.
    
    Args:
        email_address: The email address to check
        
    Returns:
        tuple: (can_send: bool, time_remaining: int)
            - can_send: True if email can be sent, False otherwise
            - time_remaining: Seconds remaining until next email can be sent (0 if can_send)
    """
    if not email_address:
        return False, 0
    
    email_address = email_address.lower().strip()
    cache_key = f"{CACHE_KEY_PREFIX}{email_address}"
    
    # Get current send history
    send_history = cache.get(cache_key, [])
    current_time = int(time.time())
    
    # Filter out timestamps older than the time window
    window_start = current_time - EMAIL_RATE_LIMIT_WINDOW
    recent_sends = [timestamp for timestamp in send_history if timestamp > window_start]
    
    # Check if limit has been reached
    if len(recent_sends) >= EMAIL_RATE_LIMIT_COUNT:
        # Calculate time until oldest send expires
        oldest_send = min(recent_sends)
        time_until_expiry = (oldest_send + EMAIL_RATE_LIMIT_WINDOW) - current_time
        return False, max(0, time_until_expiry)
    
    return True, 0


def record_email_sent(email_address):
    """
    Record that an email was sent to the given email address.
    
    Args:
        email_address: The email address that received an email
    """
    if not email_address:
        return
    
    email_address = email_address.lower().strip()
    cache_key = f"{CACHE_KEY_PREFIX}{email_address}"
    current_time = int(time.time())
    
    # Get current send history
    send_history = cache.get(cache_key, [])
    
    # Add current timestamp
    send_history.append(current_time)
    
    # Filter out timestamps older than the time window
    window_start = current_time - EMAIL_RATE_LIMIT_WINDOW
    send_history = [timestamp for timestamp in send_history if timestamp > window_start]
    
    # Store in cache with expiry slightly longer than the window to ensure cleanup
    cache.set(cache_key, send_history, EMAIL_RATE_LIMIT_WINDOW + 300)  # 5 minutes buffer
    
    logger.debug(f"Recorded email send to {email_address}. Total sends in window: {len(send_history)}")


def get_rate_limit_info(email_address):
    """
    Get information about the current rate limit status for an email address.
    
    Args:
        email_address: The email address to check
        
    Returns:
        dict: {
            'can_send': bool,
            'emails_sent': int,
            'emails_remaining': int,
            'time_remaining': int (seconds),
            'reset_at': int (timestamp)
        }
    """
    if not email_address:
        return {
            'can_send': False,
            'emails_sent': 0,
            'emails_remaining': 0,
            'time_remaining': 0,
            'reset_at': 0
        }
    
    email_address = email_address.lower().strip()
    cache_key = f"{CACHE_KEY_PREFIX}{email_address}"
    current_time = int(time.time())
    
    # Get current send history
    send_history = cache.get(cache_key, [])
    
    # Filter out timestamps older than the time window
    window_start = current_time - EMAIL_RATE_LIMIT_WINDOW
    recent_sends = [timestamp for timestamp in send_history if timestamp > window_start]
    
    emails_sent = len(recent_sends)
    emails_remaining = max(0, EMAIL_RATE_LIMIT_COUNT - emails_sent)
    can_send = emails_sent < EMAIL_RATE_LIMIT_COUNT
    
    if recent_sends:
        oldest_send = min(recent_sends)
        reset_at = oldest_send + EMAIL_RATE_LIMIT_WINDOW
        time_remaining = max(0, reset_at - current_time)
    else:
        reset_at = 0
        time_remaining = 0
    
    return {
        'can_send': can_send,
        'emails_sent': emails_sent,
        'emails_remaining': emails_remaining,
        'time_remaining': time_remaining,
        'reset_at': reset_at
    }


def format_time_remaining(seconds):
    """
    Format seconds into a human-readable time string.
    
    Args:
        seconds: Number of seconds
        
    Returns:
        str: Formatted time string (e.g., "1 hour 30 minutes")
    """
    if seconds <= 0:
        return "now"
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    
    if hours > 0 and minutes > 0:
        return f"{hours} hour{'s' if hours > 1 else ''} {minutes} minute{'s' if minutes > 1 else ''}"
    elif hours > 0:
        return f"{hours} hour{'s' if hours > 1 else ''}"
    elif minutes > 0:
        return f"{minutes} minute{'s' if minutes > 1 else ''}"
    else:
        return f"{seconds} second{'s' if seconds > 1 else ''}"


def clear_email_rate_limit(email_address):
    """
    Clear rate limit cache for a specific email address.
    
    Args:
        email_address: The email address to clear rate limit for
        
    Returns:
        bool: True if cache was cleared, False if email address was invalid or cache didn't exist
    """
    if not email_address:
        return False
    
    email_address = email_address.lower().strip()
    cache_key = f"{CACHE_KEY_PREFIX}{email_address}"
    
    try:
        deleted = cache.delete(cache_key)
        if deleted:
            logger.info(f"Cleared rate limit cache for {email_address}")
        return deleted
    except Exception as e:
        logger.error(f"Error clearing rate limit cache for {email_address}: {str(e)}")
        return False


def clear_all_email_rate_limits():
    """
    Clear all email rate limit cache entries.
    Note: This uses pattern deletion which may not be supported by all cache backends.
    If pattern deletion is not supported, it will attempt to clear all cache.
    
    Returns:
        int: Number of cache entries cleared (approximate)
    """
    try:
        # Try to use pattern deletion (works with Redis and some other backends)
        if hasattr(cache, 'delete_pattern'):
            try:
                cache.delete_pattern(f"{CACHE_KEY_PREFIX}*")
                logger.info("Cleared all email rate limit cache entries using pattern deletion")
                return -1  # Count unknown with pattern deletion
            except (AttributeError, NotImplementedError):
                pass
        
        # Fallback: Clear all cache if pattern deletion is not supported
        # This is a more aggressive approach but ensures all rate limit cache is cleared
        cache.clear()
        logger.warning("Pattern deletion not supported. Cleared ALL cache (including non-rate-limit cache)")
        return -1
        
    except Exception as e:
        logger.error(f"Error clearing email rate limit cache: {str(e)}")
        return 0


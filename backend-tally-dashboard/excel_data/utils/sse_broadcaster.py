"""
In-memory SSE broadcaster - No Redis required!
Works great for development and single-server deployments
"""
import json
import logging
import queue
import threading
from typing import Dict, Set

logger = logging.getLogger(__name__)


class InMemorySSEBroadcaster:
    """
    Simple in-memory event broadcaster for SSE
    No external dependencies required - uses only Python standard library
    """
    
    # Class-level storage for listeners (shared across all instances)
    _listeners: Dict[str, Set[queue.Queue]] = {}
    _lock = threading.Lock()
    
    CHANNEL_NAME = 'session_conflicts'
    
    @classmethod
    def subscribe(cls, channel: str = CHANNEL_NAME) -> queue.Queue:
        """
        Subscribe to a channel and return a queue for receiving events
        """
        with cls._lock:
            if channel not in cls._listeners:
                cls._listeners[channel] = set()
            
            # Create a queue for this subscriber
            event_queue = queue.Queue(maxsize=100)
            cls._listeners[channel].add(event_queue)
            
            logger.info(f"New subscriber to channel '{channel}'. Total: {len(cls._listeners[channel])}")
            return event_queue
    
    @classmethod
    def unsubscribe(cls, event_queue: queue.Queue, channel: str = CHANNEL_NAME):
        """
        Unsubscribe from a channel
        """
        with cls._lock:
            if channel in cls._listeners:
                cls._listeners[channel].discard(event_queue)
                logger.info(f"Subscriber removed from channel '{channel}'. Remaining: {len(cls._listeners[channel])}")
    
    @classmethod
    def publish(cls, channel: str, event_type: str, data: dict):
        """
        Publish an event to all subscribers of a channel
        """
        event_data = {
            'event_type': event_type,
            'data': data
        }
        
        logger.info(f"📡 Publishing event: {event_type} to channel: {channel}")
        logger.info(f"📡 Event data: {data}")
        
        with cls._lock:
            if channel not in cls._listeners or not cls._listeners[channel]:
                logger.warning(f"⚠️ No subscribers for channel '{channel}'")
                return
            
            subscriber_count = len(cls._listeners[channel])
            logger.info(f"📡 Sending to {subscriber_count} subscribers")
            
            # Send to all subscribers
            dead_queues = set()
            sent_count = 0
            for event_queue in cls._listeners[channel]:
                try:
                    # Non-blocking put - if queue is full, skip this subscriber
                    event_queue.put_nowait(event_data)
                    sent_count += 1
                except queue.Full:
                    logger.warning(f"Subscriber queue full, skipping event")
                except Exception as e:
                    logger.error(f"Error sending to subscriber: {e}")
                    dead_queues.add(event_queue)
            
            # Clean up dead queues
            for dead_queue in dead_queues:
                cls._listeners[channel].discard(dead_queue)
            
            logger.info(f"✅ Published {event_type} to {sent_count}/{subscriber_count} subscribers")
    
    @classmethod
    def get_subscriber_count(cls, channel: str = CHANNEL_NAME) -> int:
        """
        Get the number of active subscribers for a channel
        """
        with cls._lock:
            return len(cls._listeners.get(channel, set()))


class SSENotifier:
    """Simplified SSE notifier using in-memory broadcasting"""
    
    @staticmethod
    def publish_conflict_event(event_type, data):
        """
        Publish a session conflict event
        
        Args:
            event_type: Type of conflict ('ip_conflict', 'session_conflict', 'login_attempt')
            data: Dictionary containing event details
        """
        try:
            InMemorySSEBroadcaster.publish(
                InMemorySSEBroadcaster.CHANNEL_NAME,
                event_type,
                data
            )
            logger.info(f"Published SSE event: {event_type} for IP: {data.get('ip_address', 'unknown')}")
        except Exception as e:
            logger.error(f"Error publishing SSE event: {e}")
    
    @staticmethod
    def notify_ip_conflict(ip_address, existing_user, attempting_user=None):
        """
        Notify about an IP-based session conflict
        
        Args:
            ip_address: The conflicting IP address
            existing_user: User who has the active session
            attempting_user: User attempting to login (optional)
        """
        data = {
            'ip_address': ip_address,
            'existing_user': {
                'email': existing_user.email,
                'name': f"{existing_user.first_name} {existing_user.last_name}".strip(),
                'role': existing_user.role
            }
        }
        
        if attempting_user:
            data['attempting_user'] = {
                'email': attempting_user.email,
                'name': f"{attempting_user.first_name} {attempting_user.last_name}".strip(),
                'role': attempting_user.role
            }
        
        SSENotifier.publish_conflict_event('ip_conflict', data)
    
    @staticmethod
    def notify_session_conflict(user, ip_address):
        """
        Notify about a session conflict (user already logged in elsewhere)
        
        Args:
            user: User with existing session
            ip_address: IP address attempting to login
        """
        data = {
            'ip_address': ip_address,
            'user': {
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}".strip(),
                'role': user.role
            }
        }
        
        SSENotifier.publish_conflict_event('session_conflict', data)
    
    @staticmethod
    def notify_login_attempt_blocked(user, ip_address, reason):
        """
        Notify about a blocked login attempt
        
        Args:
            user: User attempting to login
            ip_address: IP address of the attempt
            reason: Reason for blocking
        """
        data = {
            'ip_address': ip_address,
            'user': {
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}".strip(),
                'role': user.role
            },
            'reason': reason
        }
        
        SSENotifier.publish_conflict_event('login_attempt_blocked', data)
    
    @staticmethod
    def notify_force_logout(user, ip_address, reason):
        """
        Notify a user that they are being forcefully logged out
        
        Args:
            user: User being logged out
            ip_address: IP address where logout is initiated
            reason: Reason for force logout
        """
        data = {
            'ip_address': ip_address,
            'user': {
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}".strip(),
                'role': user.role
            },
            'reason': reason,
            'action': 'force_logout'
        }
        
        SSENotifier.publish_conflict_event('force_logout', data)


"""
Server-Sent Events (SSE) views - No Redis Required!
Uses simple in-memory broadcasting
"""
import json
import time
import logging
from django.http import StreamingHttpResponse
from django.views import View
from django.shortcuts import render
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from ..utils.sse_broadcaster import InMemorySSEBroadcaster, SSENotifier

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name='dispatch')
class SessionConflictSSEView(View):
    """
    SSE endpoint for streaming session conflict events to clients
    Uses in-memory broadcasting - no external dependencies required
    """
    
    def get(self, request):
        """
        Handle SSE connection
        Streams events from in-memory broadcaster to the client
        """
        def event_stream():
            """Generator that yields SSE formatted messages"""
            event_queue = None
            
            try:
                # Subscribe to events
                event_queue = InMemorySSEBroadcaster.subscribe()
                
                # Send initial connection message
                yield f"event: connected\ndata: {json.dumps({'message': 'Connected to session conflict notifications', 'subscribers': InMemorySSEBroadcaster.get_subscriber_count()})}\n\n"
                
                logger.info(f"SSE client connected from IP: {self._get_client_ip(request)}")
                
                # Send periodic keepalive and listen for events
                while True:
                    try:
                        # Wait for event with timeout (for keepalive)
                        event_data = event_queue.get(timeout=15)
                        
                        event_type = event_data.get('event_type', 'unknown')
                        data = event_data.get('data', {})
                        
                        # Format as SSE event
                        sse_message = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
                        yield sse_message
                        
                    except Exception as e:
                        # Timeout or other error - send keepalive
                        if "Empty" in str(type(e).__name__):
                            # Queue timeout - send keepalive comment
                            yield ": keepalive\n\n"
                        else:
                            logger.error(f"Error in SSE stream: {e}")
                            break
                
            except GeneratorExit:
                # Client disconnected normally
                logger.info(f"SSE client disconnected from IP: {self._get_client_ip(request)}")
            except Exception as e:
                logger.error(f"Error in SSE stream: {e}")
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            finally:
                # Clean up subscription
                if event_queue:
                    InMemorySSEBroadcaster.unsubscribe(event_queue)
        
        response = StreamingHttpResponse(
            event_stream(),
            content_type='text/event-stream'
        )
        
        # SSE headers to prevent caching
        response['Cache-Control'] = 'no-cache, no-transform'
        response['X-Accel-Buffering'] = 'no'  # Disable nginx buffering
        
        return response
    
    def _get_client_ip(self, request):
        """Get client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class SSETestView(View):
    """
    Test endpoint to manually trigger SSE events for testing
    """
    
    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)
    
    def post(self, request):
        """
        Manually trigger a test SSE event
        """
        from django.http import JsonResponse
        
        try:
            event_type = request.POST.get('event_type', 'test')
            ip_address = self._get_client_ip(request)
            
            test_data = {
                'ip_address': ip_address,
                'message': 'Test event',
                'timestamp': time.time(),
                'subscribers': InMemorySSEBroadcaster.get_subscriber_count()
            }
            
            SSENotifier.publish_conflict_event(event_type, test_data)
            
            return JsonResponse({
                'success': True,
                'message': f'Test event published: {event_type}',
                'active_subscribers': InMemorySSEBroadcaster.get_subscriber_count()
            })
            
        except Exception as e:
            logger.error(f"Error publishing test event: {e}")
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)
    
    def _get_client_ip(self, request):
        """Get client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


# Test page function removed - SSE is now integrated in production frontend


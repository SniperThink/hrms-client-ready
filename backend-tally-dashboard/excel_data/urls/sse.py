"""
URL patterns for Server-Sent Events (SSE) endpoints
No Redis required - uses simple in-memory broadcasting
"""
from django.urls import path
from ..views.sse_simple import SessionConflictSSEView, SSETestView

urlpatterns = [
    # SSE endpoint for real-time session conflict notifications
    # Accessible at: /api/sse/session-conflicts/
    path('sse/session-conflicts/', SessionConflictSSEView.as_view(), name='sse-session-conflicts'),
    
    # Test endpoint for manually triggering SSE events
    # Accessible at: /api/sse/test/
    path('sse/test/', SSETestView.as_view(), name='sse-test'),
]


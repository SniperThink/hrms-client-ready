/**
 * React Hook for Session Conflict Detection via SSE
 * Automatically handles force logout events
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { sseService, SSEEventData } from '../services/sseService';
import { logout } from '../services/authService';
import { logger } from '../utils/logger';

export interface SessionConflictModalData {
  show: boolean;
  message: string;
  reason: string;
}

export function useSessionConflict() {
  const [modalData, setModalData] = useState<SessionConflictModalData>({
    show: false,
    message: '',
    reason: '',
  });

  // Use ref to track connection and avoid reconnects
  const isConnectedRef = useRef(false);
  const handlerRef = useRef<((eventType: string, data: SSEEventData) => void) | null>(null);

  const handleLogout = useCallback(() => {
    // Clear everything and redirect to login
    logout();
  }, []);

  const closeModal = useCallback(() => {
    setModalData(prev => ({ ...prev, show: false }));
    // Immediately logout when closing modal
    handleLogout();
  }, [handleLogout]);

  // Create stable handler function that uses ref
  useEffect(() => {
    handlerRef.current = (eventType: string, data: SSEEventData) => {
      logger.info( '🚪 Force Logout Received:', data);
      logger.info( '🚪 Event Type:', eventType);
      
      // CRITICAL: Check if this event is for our session
      // Get current session key from localStorage (stored during login)
      const currentSessionKey = localStorage.getItem('session_key');
      const eventSessionKey = data.session_key || data.target_session_key;
      const targetEmail = data.target_email || data.user?.email;
      const currentUserEmail = JSON.parse(localStorage.getItem('user') || '{}')?.email;
      
      logger.info( '🔍 Session Key Check:', {
        currentSessionKey,
        eventSessionKey,
        targetEmail,
        currentUserEmail,
        shouldLogout: eventSessionKey ? (eventSessionKey === currentSessionKey) : (targetEmail === currentUserEmail)
      });
      
      // Only logout if:
      // 1. The event has a session_key AND it matches our current session_key, OR
      // 2. The event has no session_key BUT the target_email matches our email (fallback for old events)
      const shouldLogout = eventSessionKey 
        ? (eventSessionKey === currentSessionKey)
        : (targetEmail === currentUserEmail);
      
      if (!shouldLogout) {
        logger.info( '✅ Ignoring force_logout event - not for this session', {
          eventSessionKey,
          currentSessionKey,
          targetEmail,
          currentUserEmail
        });
        return; // Don't logout - this event is for a different session
      }
      
      logger.info( '🚪 Setting modal to show...');

      let message = 'Another login was detected. ';
      
      if (data.reason?.includes('same IP')) {
        message += 'Someone else logged in from this IP address.';
      } else if (data.reason?.includes('another location')) {
        message += 'You logged in from another location.';
      } else {
        message += data.reason || 'Your session has been terminated.';
      }

      setModalData({
        show: true,
        message,
        reason: data.reason || 'Session conflict',
      });

      logger.info( '✅ Modal data set:', { show: true, message });

      // Auto logout after showing modal
      setTimeout(() => {
        logger.info( '⏰ Auto logout triggered');
        logout();
      }, 5000);
    };
  });

  // Single effect for SSE connection - runs only once
  useEffect(() => {
    const accessToken = localStorage.getItem('access');
    logger.info( '🔑 Access token:', accessToken ? 'EXISTS' : 'NOT FOUND');
    
    if (!accessToken) {
      logger.info( '❌ No access token, skipping SSE connection');
      return;
    }

    if (isConnectedRef.current) {
      logger.info( '⚠️ SSE already connected, skipping...');
      return;
    }

    logger.info( '🔌 Initializing SSE connection...');
    isConnectedRef.current = true;
    
    // Wrapper function that always calls the latest handler
    const eventHandler = (eventType: string, data: SSEEventData) => {
      if (handlerRef.current) {
        handlerRef.current(eventType, data);
      }
    };
    
    // Connect to SSE
    sseService.connect();

    // Register wrapper handler
    sseService.on('force_logout', eventHandler);
    logger.info( '✅ Force logout handler registered');

    // Cleanup on unmount only
    return () => {
      logger.info( '🔌 Cleaning up SSE connection (unmount)...');
      isConnectedRef.current = false;
      sseService.off('force_logout', eventHandler);
      sseService.disconnect();
    };
  }, []); // Empty deps - only run once

  // Manual test function for debugging
  const testModal = useCallback(() => {
    logger.info( '🧪 Testing modal manually...');
    setModalData({
      show: true,
      message: 'This is a test message. You logged in from another location.',
      reason: 'Manual test',
    });
  }, []);

  return {
    modalData,
    closeModal,
    testModal, // For debugging
  };
}


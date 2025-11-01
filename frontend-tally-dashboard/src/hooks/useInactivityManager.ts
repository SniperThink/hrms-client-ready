import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inactivityManager } from '../services/inactivityManager';

export const useInactivityManager = () => {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Set up warning callback
    inactivityManager.setWarningCallback(() => {
      setShowWarning(true);
    });

    // Set up logout callback
    inactivityManager.setLogoutCallback(() => {
      setShowWarning(false);
      navigate('/login', { replace: true });
    });

    // Start the inactivity manager
    inactivityManager.start();

    // Cleanup on unmount
    return () => {
      inactivityManager.destroy();
    };
  }, [navigate]);

  const extendSession = () => {
    setShowWarning(false);
    inactivityManager.extendSession();
  };

  const logout = () => {
    setShowWarning(false);
    inactivityManager.stop();
    navigate('/login', { replace: true });
  };

  return {
    showWarning,
    extendSession,
    logout
  };
}; 
import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

/** BR-16: Auto idle logout — tracks mouse/keyboard activity */
export function useIdleTimeout() {
  const { user, logout } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleSeconds = user?.idle || 0;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (idleSeconds > 0) {
      timerRef.current = setTimeout(() => {
        logout();
        alert('Session expired due to inactivity.');
      }, idleSeconds * 1000);
    }
  }, [idleSeconds, logout]);

  useEffect(() => {
    if (idleSeconds <= 0) return;

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [idleSeconds, resetTimer]);
}
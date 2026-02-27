import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

/** Socket.IO hook for real-time dashboard updates — BR-15 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('dashboard:status', (data: any) => setDashboardData(data));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const refresh = useCallback(() => {
    socketRef.current?.emit('dashboard:refresh');
  }, []);

  return { dashboardData, connected, refresh };
}
'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Ticket } from '@/lib/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';

export function useSocket(
  branchId: string | null,
  serviceId?: string | null,
  onQueueUpdate?: () => void,
  onTicketUpdate?: (ticket: Ticket | null) => void,
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!branchId) return;

    // Initialize socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    // Listen for queue updates
    if (onQueueUpdate) {
      const channel = serviceId ? `queue-update:${branchId}:${serviceId}` : `queue-update:${branchId}`;
      socket.on(channel, () => {
        console.log('Queue update received');
        onQueueUpdate();
      });
    }

    // Listen for ticket updates (e.g. "now serving")
    if (onTicketUpdate) {
      const channel = serviceId ? `ticket-update:${branchId}:${serviceId}` : `ticket-update:${branchId}`;
      socket.on(channel, (ticket: Ticket | null) => {
        console.log('Ticket update received');
        onTicketUpdate(ticket);
      });
    }

    return () => {
      if (socket) {
        socket.off(serviceId ? `queue-update:${branchId}:${serviceId}` : `queue-update:${branchId}`);
        socket.off(serviceId ? `ticket-update:${branchId}:${serviceId}` : `ticket-update:${branchId}`);
        socket.disconnect();
      }
    };
  }, [branchId, serviceId, onQueueUpdate, onTicketUpdate]);

  return socketRef.current;
}


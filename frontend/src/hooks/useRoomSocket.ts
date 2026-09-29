'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  RoomPublicState,
  WSServerMessage,
  WSClientMessage,
  RoomSettings,
} from '@/types/room';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export function useRoomSocket(
  pin: string | null,
  playerId: string | null,
  options?: {
    onKicked?: (reason: string) => void;
  }
) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<RoomPublicState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isKicked, setIsKicked] = useState<boolean>(false);
  const [kickReason, setKickReason] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const onKickedRef = useRef(options?.onKicked);
  onKickedRef.current = options?.onKicked;

  const sendMessage = useCallback((message: WSClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  const kickPlayerAction = useCallback(
    (targetPlayerId: string) => {
      if (!pin || !playerId) return;
      sendMessage({
        type: 'KICK_PLAYER',
        payload: {
          pin,
          hostId: playerId,
          targetPlayerId,
        },
      });
    },
    [pin, playerId, sendMessage]
  );

  const updateSettingsAction = useCallback(
    (settings: Partial<RoomSettings>) => {
      if (!pin || !playerId) return;
      sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: {
          pin,
          hostId: playerId,
          settings,
        },
      });
    },
    [pin, playerId, sendMessage]
  );

  useEffect(() => {
    if (!pin || !playerId) return;

    let isMounted = true;
    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      if (!isMounted) return;
      setIsConnected(true);
      setError(null);

      // Sincronizar jugador con la sala en el backend
      const joinMsg: WSClientMessage = {
        type: 'JOIN_ROOM',
        payload: { pin, playerId },
      };
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (event) => {
      if (!isMounted) return;
      try {
        const msg = JSON.parse(event.data) as WSServerMessage;
        if (msg.type === 'ROOM_STATE') {
          setRoomState(msg.payload);
        } else if (msg.type === 'KICKED') {
          setIsKicked(true);
          setKickReason(msg.payload.reason);
          onKickedRef.current?.(msg.payload.reason);
        } else if (msg.type === 'ERROR') {
          setError(msg.payload.message);
        }
      } catch (e) {
        console.error('Error parseando mensaje WS en frontend:', e);
      }
    };

    ws.onerror = () => {
      if (!isMounted) return;
      setError('Error en la conexión con el servidor en tiempo real.');
    };

    ws.onclose = () => {
      if (!isMounted) return;
      setIsConnected(false);
    };

    return () => {
      isMounted = false;
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
    };
  }, [pin, playerId]);

  return {
    isConnected,
    roomState,
    error,
    isKicked,
    kickReason,
    sendMessage,
    kickPlayer: kickPlayerAction,
    updateSettings: updateSettingsAction,
  };
}

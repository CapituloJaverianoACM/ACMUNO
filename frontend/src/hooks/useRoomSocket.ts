'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  RoomPublicState,
  WSServerMessage,
  WSClientMessage,
  RoomSettings,
  PlayerGameState,
  CardColor,
} from '@/types/room';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export function useRoomSocket(
  pin: string | null,
  playerId: string | null,
  options?: {
    onKicked?: () => void;
  }
) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<RoomPublicState | null>(null);
  const [gameState, setGameState] = useState<PlayerGameState | null>(null);
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

  const startGameAction = useCallback(() => {
    if (!pin || !playerId) return;
    sendMessage({
      type: 'START_GAME',
      payload: {
        pin,
        hostId: playerId,
      },
    });
  }, [pin, playerId, sendMessage]);

  const playCardAction = useCallback(
    (cardId: string, chosenColor?: CardColor) => {
      if (!pin || !playerId) return;
      sendMessage({
        type: 'PLAY_CARD',
        payload: {
          pin,
          playerId,
          cardId,
          chosenColor,
        },
      });
    },
    [pin, playerId, sendMessage]
  );

  const drawCardAction = useCallback(() => {
    if (!pin || !playerId) return;
    sendMessage({
      type: 'DRAW_CARD',
      payload: {
        pin,
        playerId,
      },
    });
  }, [pin, playerId, sendMessage]);

  const sayUnoAction = useCallback(() => {
    if (!pin || !playerId) return;
    sendMessage({
      type: 'SAY_UNO',
      payload: {
        pin,
        playerId,
      },
    });
  }, [pin, playerId, sendMessage]);

  const restartGameAction = useCallback(() => {
    if (!pin || !playerId) return;
    sendMessage({
      type: 'RESTART_GAME',
      payload: {
        pin,
        hostId: playerId,
      },
    });
  }, [pin, playerId, sendMessage]);

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
          if (msg.payload.status === 'LOBBY') {
            setGameState(null); // Limpiar estado al reiniciar partida
          }
        } else if (msg.type === 'GAME_STATE') {
          setGameState(msg.payload);
        } else if (msg.type === 'KICKED') {
          setIsKicked(true);
          setKickReason(msg.payload.reason);
          onKickedRef.current?.();
        } else if (msg.type === 'ERROR') {
          setError(msg.payload.message);
          // Borrar error tras 4 segundos
          setTimeout(() => setError(null), 4000);
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
    gameState,
    error,
    isKicked,
    kickReason,
    sendMessage,
    startGame: startGameAction,
    playCard: playCardAction,
    drawCard: drawCardAction,
    sayUno: sayUnoAction,
    restartGame: restartGameAction,
    kickPlayer: kickPlayerAction,
    updateSettings: updateSettingsAction,
  };
}

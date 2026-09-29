import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { roomManager } from './modules/rooms/room.manager';
import type {
  WSClientMessage,
  WSServerMessage,
} from './modules/rooms/room.types';

// Metadatos asociados a cada conexión activa
interface ConnectionMeta {
  pin?: string;
  playerId?: string;
  ws?: unknown;
}

const connections = new Map<unknown, ConnectionMeta>();
const playerSockets = new Map<string, unknown>();

/**
 * Difunde de forma segura el estado de juego a cada jugador.
 * Cada cliente recibe su propia mano y solo el conteo de cartas de los rivales.
 */
function broadcastGameState(pin: string) {
  const room = roomManager.getRoom(pin);
  if (!room || !room.game) return;

  for (const player of room.players.values()) {
    const targetWs = playerSockets.get(player.id) as
      | { send: (msg: string) => void }
      | undefined;

    if (targetWs) {
      const playerGameState = room.game.getPlayerState(player.id, room.players);
      targetWs.send(
        JSON.stringify({
          type: 'GAME_STATE',
          payload: playerGameState,
        } satisfies WSServerMessage)
      );
    }
  }

  // Sincronizar el estado público de la sala
  const roomTopic = `room:${pin.toUpperCase()}`;
  const roomStateMessage: WSServerMessage = {
    type: 'ROOM_STATE',
    payload: roomManager.toPublicState(room),
  };
  app.server?.publish(roomTopic, JSON.stringify(roomStateMessage));
}

const roomTurnTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function clearTurnTimer(pin: string) {
  const normalizedPin = pin.toUpperCase();
  const existingTimer = roomTurnTimers.get(normalizedPin);
  if (existingTimer) {
    clearTimeout(existingTimer);
    roomTurnTimers.delete(normalizedPin);
  }
}

export function scheduleTurnTimer(pin: string) {
  clearTurnTimer(pin);
  const normalizedPin = pin.toUpperCase();
  const room = roomManager.getRoom(normalizedPin);
  if (!room || !room.game || room.status !== 'PLAYING' || room.game.winner) {
    return;
  }

  const timeLimit = room.game.turnTimeLimit;
  if (timeLimit <= 0) return; // 0 = sin límite de tiempo

  const timer = setTimeout(() => {
    const activeRoom = roomManager.getRoom(normalizedPin);
    if (
      !activeRoom ||
      !activeRoom.game ||
      activeRoom.status !== 'PLAYING' ||
      activeRoom.game.winner
    ) {
      clearTurnTimer(normalizedPin);
      return;
    }

    const timeoutResult = activeRoom.game.handleTurnTimeout(activeRoom.players);
    if (timeoutResult) {
      broadcastGameState(normalizedPin);
      scheduleTurnTimer(normalizedPin);
    }
  }, timeLimit * 1000);

  roomTurnTimers.set(normalizedPin, timer);
}

export const app = new Elysia()
  .use(
    cors({
      origin: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    })
  )
  .get('/health', () => ({
    status: 'ok',
    activeRooms: roomManager.countRooms(),
    timestamp: Date.now(),
  }))
  .post(
    '/api/rooms',
    ({ body, set }) => {
      const { hostName } = body;
      const trimmedName = hostName?.trim();

      if (!trimmedName) {
        set.status = 400;
        return { error: 'El nombre del anfitrión es requerido' };
      }

      const result = roomManager.createRoom(trimmedName);
      return result;
    },
    {
      body: t.Object({
        hostName: t.String(),
      }),
    }
  )
  .get('/api/rooms/:pin', ({ params, set }) => {
    const room = roomManager.getRoom(params.pin);
    if (!room) {
      set.status = 404;
      return { error: 'Sala no encontrada' };
    }

    return {
      exists: true,
      room: roomManager.toPublicState(room),
    };
  })
  .post(
    '/api/rooms/:pin/join',
    ({ params, body, set }) => {
      try {
        const { playerName } = body;
        const result = roomManager.addPlayer(params.pin, playerName);
        return result;
      } catch (err: unknown) {
        set.status = 400;
        return {
          error:
            err instanceof Error ? err.message : 'Error al unirse a la sala',
        };
      }
    },
    {
      body: t.Object({
        playerName: t.String(),
      }),
    }
  )
  .post(
    '/api/rooms/:pin/start',
    ({ params, body, set }) => {
      try {
        const { hostId } = body;
        roomManager.startGame(params.pin, hostId);
        broadcastGameState(params.pin);
        scheduleTurnTimer(params.pin);
        const room = roomManager.getRoom(params.pin)!;
        return { success: true, room: roomManager.toPublicState(room) };
      } catch (err: unknown) {
        set.status = 400;
        return {
          error:
            err instanceof Error ? err.message : 'Error al iniciar la partida',
        };
      }
    },
    {
      body: t.Object({
        hostId: t.String(),
      }),
    }
  )
  .post(
    '/api/rooms/:pin/play',
    ({ params, body, set }) => {
      try {
        const { playerId, cardId, chosenColor } = body;
        const room = roomManager.getRoom(params.pin);
        if (!room || !room.game) {
          set.status = 400;
          return { error: 'Partida no iniciada' };
        }
        const player = room.players.get(playerId);
        if (!player) {
          set.status = 400;
          return { error: 'Jugador no encontrado' };
        }

        const result = room.game.playCard(
          playerId,
          cardId,
          player.name,
          chosenColor as any,
          room.players
        );
        if (result.winner) {
          room.status = 'FINISHED';
          clearTurnTimer(params.pin);
        } else {
          scheduleTurnTimer(params.pin);
        }
        broadcastGameState(params.pin);
        return { success: true, result };
      } catch (err: unknown) {
        set.status = 400;
        return {
          error: err instanceof Error ? err.message : 'Error al jugar carta',
        };
      }
    },
    {
      body: t.Object({
        playerId: t.String(),
        cardId: t.String(),
        chosenColor: t.Optional(t.String()),
      }),
    }
  )
  .post(
    '/api/rooms/:pin/draw',
    ({ params, body, set }) => {
      try {
        const { playerId } = body;
        const room = roomManager.getRoom(params.pin);
        if (!room || !room.game) {
          set.status = 400;
          return { error: 'Partida no iniciada' };
        }
        const player = room.players.get(playerId);
        if (!player) {
          set.status = 400;
          return { error: 'Jugador no encontrado' };
        }

        const result = room.game.drawCard(playerId, player.name);
        broadcastGameState(params.pin);
        scheduleTurnTimer(params.pin);
        return { success: true, result };
      } catch (err: unknown) {
        set.status = 400;
        return {
          error: err instanceof Error ? err.message : 'Error al robar carta',
        };
      }
    },
    {
      body: t.Object({
        playerId: t.String(),
      }),
    }
  )
  .post(
    '/api/rooms/:pin/timeout',
    ({ params, set }) => {
      try {
        const room = roomManager.getRoom(params.pin);
        if (!room || !room.game) {
          set.status = 400;
          return { error: 'Partida no iniciada' };
        }
        const result = room.game.handleTurnTimeout(room.players);
        if (result) {
          broadcastGameState(params.pin);
          scheduleTurnTimer(params.pin);
          return { success: true, result };
        }
        return { success: false, message: 'No hay turno para timeout' };
      } catch (err: unknown) {
        set.status = 400;
        return {
          error: err instanceof Error ? err.message : 'Error en timeout',
        };
      }
    }
  )
  .post(
    '/api/rooms/:pin/uno',
    ({ params, body, set }) => {
      try {
        const { playerId } = body;
        const room = roomManager.getRoom(params.pin);
        if (!room || !room.game) {
          set.status = 400;
          return { error: 'Partida no iniciada' };
        }
        const player = room.players.get(playerId);
        if (!player) {
          set.status = 400;
          return { error: 'Jugador no encontrado' };
        }

        const result = room.game.sayUno(playerId, player.name, room.players);
        broadcastGameState(params.pin);
        return { success: true, result };
      } catch (err: unknown) {
        set.status = 400;
        return {
          error: err instanceof Error ? err.message : 'Error al cantar UNO',
        };
      }
    },
    {
      body: t.Object({
        playerId: t.String(),
      }),
    }
  )
  .post(
    '/api/rooms/:pin/restart',
    ({ params, body, set }) => {
      try {
        const { hostId } = body;
        const room = roomManager.getRoom(params.pin);
        if (!room) {
          set.status = 404;
          return { error: 'Sala no encontrada' };
        }
        if (room.hostId !== hostId) {
          set.status = 403;
          return { error: 'Solo el anfitrión puede reiniciar' };
        }

        room.status = 'LOBBY';
        room.game = undefined;

        const roomTopic = `room:${params.pin.toUpperCase()}`;
        const stateMessage: WSServerMessage = {
          type: 'ROOM_STATE',
          payload: roomManager.toPublicState(room),
        };
        app.server?.publish(roomTopic, JSON.stringify(stateMessage));

        return { success: true, room: roomManager.toPublicState(room) };
      } catch (err: unknown) {
        set.status = 400;
        return {
          error:
            err instanceof Error ? err.message : 'Error al reiniciar la sala',
        };
      }
    },
    {
      body: t.Object({
        hostId: t.String(),
      }),
    }
  )
  .post(
    '/api/rooms/:pin/kick',
    ({ params, body, set }) => {
      try {
        const { hostId, targetPlayerId } = body;
        const result = roomManager.kickPlayer(
          params.pin,
          hostId,
          targetPlayerId
        );

        const targetWs = playerSockets.get(targetPlayerId) as
          | { send: (msg: string) => void; close: () => void }
          | undefined;

        if (targetWs) {
          try {
            targetWs.send(
              JSON.stringify({
                type: 'KICKED',
                payload: {
                  reason: 'Has sido expulsado de la sala por el anfitrión.',
                },
              } satisfies WSServerMessage)
            );
            targetWs.close();
          } catch (e) {
            console.error('Error cerrando socket de jugador expulsado:', e);
          }
          playerSockets.delete(targetPlayerId);
        }

        const roomTopic = `room:${params.pin.toUpperCase()}`;
        const stateMessage: WSServerMessage = {
          type: 'ROOM_STATE',
          payload: result.room,
        };
        app.server?.publish(roomTopic, JSON.stringify(stateMessage));

        return result;
      } catch (err: unknown) {
        set.status = 400;
        return {
          error:
            err instanceof Error ? err.message : 'Error al expulsar al jugador',
        };
      }
    },
    {
      body: t.Object({
        hostId: t.String(),
        targetPlayerId: t.String(),
      }),
    }
  )
  .post(
    '/api/rooms/:pin/settings',
    ({ params, body, set }) => {
      try {
        const { hostId, settings } = body;
        const updatedRoom = roomManager.updateSettings(
          params.pin,
          hostId,
          settings
        );

        const roomTopic = `room:${params.pin.toUpperCase()}`;
        const stateMessage: WSServerMessage = {
          type: 'ROOM_STATE',
          payload: updatedRoom,
        };
        app.server?.publish(roomTopic, JSON.stringify(stateMessage));

        return { success: true, room: updatedRoom };
      } catch (err: unknown) {
        set.status = 400;
        return {
          error:
            err instanceof Error
              ? err.message
              : 'Error al actualizar configuración',
        };
      }
    },
    {
      body: t.Object({
        hostId: t.String(),
        settings: t.Object({
          turnTimeLimit: t.Optional(t.Number()),
          maxPlayers: t.Optional(t.Number()),
        }),
      }),
    }
  )
  .ws('/ws', {
    open(ws) {
      connections.set(ws.raw, { ws });
    },
    message(ws, rawData) {
      try {
        const data = (
          typeof rawData === 'string' ? JSON.parse(rawData) : rawData
        ) as WSClientMessage;
        const meta = connections.get(ws.raw) || { ws };

        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG' } satisfies WSServerMessage));
          return;
        }

        if (data.type === 'JOIN_ROOM') {
          const { pin, playerId } = data.payload;
          const room = roomManager.getRoom(pin);

          if (!room) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                payload: { message: `La sala con PIN ${pin} no existe` },
              } satisfies WSServerMessage)
            );
            return;
          }

          const player = room.players.get(playerId);
          if (!player) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                payload: { message: 'El jugador no pertenece a esta sala' },
              } satisfies WSServerMessage)
            );
            return;
          }

          meta.pin = room.pin;
          meta.playerId = player.id;
          connections.set(ws.raw, meta);
          playerSockets.set(player.id, ws);

          const roomTopic = `room:${room.pin}`;
          ws.subscribe(roomTopic);

          roomManager.setPlayerConnection(room.pin, player.id, true);

          const publicState = roomManager.toPublicState(room);
          const stateMessage: WSServerMessage = {
            type: 'ROOM_STATE',
            payload: publicState,
          };

          ws.send(JSON.stringify(stateMessage));
          app.server?.publish(roomTopic, JSON.stringify(stateMessage));

          // Si la partida está en curso, sincronizarle su mano y tablero
          if (room.status === 'PLAYING' && room.game) {
            const playerGameState = room.game.getPlayerState(
              player.id,
              room.players
            );
            ws.send(
              JSON.stringify({
                type: 'GAME_STATE',
                payload: playerGameState,
              } satisfies WSServerMessage)
            );
          }
        }

        if (data.type === 'START_GAME') {
          const { pin, hostId } = data.payload;
          try {
            roomManager.startGame(pin, hostId);
            broadcastGameState(pin);
            scheduleTurnTimer(pin);
          } catch (err: unknown) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                payload: {
                  message:
                    err instanceof Error
                      ? err.message
                      : 'Error al iniciar la partida',
                },
              } satisfies WSServerMessage)
            );
          }
        }

        if (data.type === 'PLAY_CARD') {
          const { pin, playerId, cardId, chosenColor } = data.payload;
          const room = roomManager.getRoom(pin);
          if (!room || !room.game) return;
          const player = room.players.get(playerId);
          if (!player) return;

          try {
            const result = room.game.playCard(
              playerId,
              cardId,
              player.name,
              chosenColor,
              room.players
            );
            if (result.winner) {
              room.status = 'FINISHED';
              clearTurnTimer(pin);
            } else {
              scheduleTurnTimer(pin);
            }
            broadcastGameState(pin);
          } catch (err: unknown) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                payload: {
                  message:
                    err instanceof Error ? err.message : 'Jugada inválida',
                },
              } satisfies WSServerMessage)
            );
          }
        }

        if (data.type === 'DRAW_CARD') {
          const { pin, playerId } = data.payload;
          const room = roomManager.getRoom(pin);
          if (!room || !room.game) return;
          const player = room.players.get(playerId);
          if (!player) return;

          try {
            room.game.drawCard(playerId, player.name);
            broadcastGameState(pin);
            scheduleTurnTimer(pin);
          } catch (err: unknown) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                payload: {
                  message:
                    err instanceof Error ? err.message : 'Error al robar carta',
                },
              } satisfies WSServerMessage)
            );
          }
        }

        if (data.type === 'SAY_UNO') {
          const { pin, playerId } = data.payload;
          const room = roomManager.getRoom(pin);
          if (!room || !room.game) return;
          const player = room.players.get(playerId);
          if (!player) return;

          try {
            room.game.sayUno(playerId, player.name, room.players);
            broadcastGameState(pin);
          } catch (err: unknown) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                payload: {
                  message:
                    err instanceof Error ? err.message : 'Error al cantar UNO',
                },
              } satisfies WSServerMessage)
            );
          }
        }

        if (data.type === 'RESTART_GAME') {
          const { pin, hostId } = data.payload;
          const room = roomManager.getRoom(pin);
          if (room && room.hostId === hostId) {
            clearTurnTimer(pin);
            room.status = 'LOBBY';
            room.game = undefined;
            const roomTopic = `room:${pin.toUpperCase()}`;
            const stateMessage: WSServerMessage = {
              type: 'ROOM_STATE',
              payload: roomManager.toPublicState(room),
            };
            app.server?.publish(roomTopic, JSON.stringify(stateMessage));
          }
        }

        if (data.type === 'KICK_PLAYER') {
          const { pin, hostId, targetPlayerId } = data.payload;
          const result = roomManager.kickPlayer(pin, hostId, targetPlayerId);

          const targetWs = playerSockets.get(targetPlayerId) as
            | { send: (msg: string) => void; close: () => void }
            | undefined;

          if (targetWs) {
            targetWs.send(
              JSON.stringify({
                type: 'KICKED',
                payload: {
                  reason: 'Has sido expulsado de la sala por el anfitrión.',
                },
              } satisfies WSServerMessage)
            );
            targetWs.close();
            playerSockets.delete(targetPlayerId);
          }

          const roomTopic = `room:${pin.toUpperCase()}`;
          const stateMessage: WSServerMessage = {
            type: 'ROOM_STATE',
            payload: result.room,
          };
          app.server?.publish(roomTopic, JSON.stringify(stateMessage));
        }

        if (data.type === 'UPDATE_SETTINGS') {
          const { pin, hostId, settings } = data.payload;
          const updatedRoom = roomManager.updateSettings(
            pin,
            hostId,
            settings
          );

          const roomTopic = `room:${pin.toUpperCase()}`;
          const stateMessage: WSServerMessage = {
            type: 'ROOM_STATE',
            payload: updatedRoom,
          };
          app.server?.publish(roomTopic, JSON.stringify(stateMessage));
        }
      } catch (err) {
        console.error('Error al procesar mensaje WebSocket:', err);
      }
    },
    close(ws) {
      const meta = connections.get(ws.raw);
      if (meta?.pin && meta?.playerId) {
        const { pin, playerId } = meta;
        roomManager.setPlayerConnection(pin, playerId, false);
        playerSockets.delete(playerId);

        const room = roomManager.getRoom(pin);
        if (room) {
          const roomTopic = `room:${pin}`;
          const stateMessage: WSServerMessage = {
            type: 'ROOM_STATE',
            payload: roomManager.toPublicState(room),
          };
          app.server?.publish(roomTopic, JSON.stringify(stateMessage));
        }
      }
      connections.delete(ws.raw);
    },
  })
  .listen(3001);

console.log(
  `🎮 Backend UNO (Elysia) corriendo en: http://localhost:${app.server?.port}`
);

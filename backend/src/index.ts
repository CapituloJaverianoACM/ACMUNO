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
    '/api/rooms/:pin/kick',
    ({ params, body, set }) => {
      try {
        const { hostId, targetPlayerId } = body;
        const result = roomManager.kickPlayer(
          params.pin,
          hostId,
          targetPlayerId
        );

        // Notificar y desconectar al socket del jugador expulsado
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

        // Notificar al resto de la sala
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

        // Notificar a todos en la sala del cambio de configuración
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

          // Asignar datos de la sesión al socket
          meta.pin = room.pin;
          meta.playerId = player.id;
          connections.set(ws.raw, meta);
          playerSockets.set(player.id, ws);

          // Suscribir socket al canal específico de la sala
          const roomTopic = `room:${room.pin}`;
          ws.subscribe(roomTopic);

          // Marcar al jugador como conectado
          roomManager.setPlayerConnection(room.pin, player.id, true);

          const publicState = roomManager.toPublicState(room);
          const stateMessage: WSServerMessage = {
            type: 'ROOM_STATE',
            payload: publicState,
          };

          // Notificar al propio cliente y al resto de la sala
          ws.send(JSON.stringify(stateMessage));
          app.server?.publish(roomTopic, JSON.stringify(stateMessage));
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

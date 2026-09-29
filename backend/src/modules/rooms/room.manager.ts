import type {
  Player,
  Room,
  RoomPublicState,
  RoomSettings,
} from './room.types';
import { UnoGame } from '../game/game.manager';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  /**
   * Genera un código PIN único de 4 caracteres alfanuméricos fácil de leer (sin 0, O, 1, I).
   */
  private generatePin(length = 4): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pin = '';
    do {
      pin = '';
      for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        pin += chars[randomIndex];
      }
    } while (this.rooms.has(pin));

    return pin;
  }

  /**
   * Crea una nueva sala con el anfitrión.
   */
  public createRoom(hostName: string): {
    pin: string;
    hostPlayer: Player;
    room: RoomPublicState;
  } {
    const pin = this.generatePin();
    const hostId = crypto.randomUUID();

    const hostPlayer: Player = {
      id: hostId,
      name: hostName.trim() || 'Anfitrión',
      isHost: true,
      isConnected: false,
    };

    const room: Room = {
      pin,
      hostId,
      status: 'LOBBY',
      createdAt: Date.now(),
      settings: {
        turnTimeLimit: 30, // 30 segundos por turno por defecto
        maxPlayers: 8,     // Hasta 8 jugadores
      },
      players: new Map([[hostId, hostPlayer]]),
    };

    this.rooms.set(pin, room);

    return {
      pin,
      hostPlayer,
      room: this.toPublicState(room),
    };
  }

  /**
   * Obtiene la sala por su PIN.
   */
  public getRoom(pin: string): Room | undefined {
    return this.rooms.get(pin.toUpperCase());
  }

  /**
   * Une a un nuevo jugador a una sala existente en etapa LOBBY.
   */
  public addPlayer(
    pin: string,
    playerName: string
  ): { player: Player; room: RoomPublicState } {
    const room = this.getRoom(pin);
    if (!room) {
      throw new Error(`La sala con PIN ${pin} no existe.`);
    }

    if (room.status !== 'LOBBY') {
      throw new Error('La partida ya ha comenzado.');
    }

    if (room.players.size >= room.settings.maxPlayers) {
      throw new Error('La sala ha alcanzado el límite máximo de jugadores.');
    }

    const playerId = crypto.randomUUID();
    const newPlayer: Player = {
      id: playerId,
      name: playerName.trim() || `Jugador ${room.players.size + 1}`,
      isHost: false,
      isConnected: false,
    };

    room.players.set(playerId, newPlayer);

    return {
      player: newPlayer,
      room: this.toPublicState(room),
    };
  }

  /**
   * Inicia la partida de UNO (exclusivo para el anfitrión).
   */
  public startGame(pin: string, hostId: string): UnoGame {
    const room = this.getRoom(pin);
    if (!room) {
      throw new Error(`La sala con PIN ${pin} no existe.`);
    }

    if (room.hostId !== hostId) {
      throw new Error('Solo el anfitrión puede iniciar la partida.');
    }

    if (room.players.size < 2) {
      throw new Error('Se necesitan al menos 2 jugadores para iniciar la partida.');
    }

    if (room.status === 'PLAYING') {
      throw new Error('La partida ya está en curso.');
    }

    const game = new UnoGame(room.pin, room.settings.turnTimeLimit);
    game.start(Array.from(room.players.values()));

    room.status = 'PLAYING';
    room.game = game;

    return game;
  }

  /**
   * Permite al anfitrión expulsar a un jugador de la sala.
   */
  public kickPlayer(
    pin: string,
    hostId: string,
    targetPlayerId: string
  ): { success: boolean; room: RoomPublicState } {
    const room = this.getRoom(pin);
    if (!room) {
      throw new Error(`La sala con PIN ${pin} no existe.`);
    }

    if (room.hostId !== hostId) {
      throw new Error('Solo el anfitrión puede expulsar jugadores.');
    }

    if (targetPlayerId === hostId) {
      throw new Error('El anfitrión no puede expulsarse a sí mismo.');
    }

    const targetPlayer = room.players.get(targetPlayerId);
    if (!targetPlayer) {
      throw new Error('El jugador no se encuentra en la sala.');
    }

    room.players.delete(targetPlayerId);

    return {
      success: true,
      room: this.toPublicState(room),
    };
  }

  /**
   * Actualiza la configuración de la sala (tiempo de turno, límite de jugadores).
   */
  public updateSettings(
    pin: string,
    hostId: string,
    newSettings: Partial<RoomSettings>
  ): RoomPublicState {
    const room = this.getRoom(pin);
    if (!room) {
      throw new Error(`La sala con PIN ${pin} no existe.`);
    }

    if (room.hostId !== hostId) {
      throw new Error('Solo el anfitrión puede modificar los ajustes.');
    }

    if (newSettings.turnTimeLimit !== undefined) {
      room.settings.turnTimeLimit = newSettings.turnTimeLimit;
    }

    if (newSettings.maxPlayers !== undefined) {
      room.settings.maxPlayers = Math.min(
        10,
        Math.max(2, newSettings.maxPlayers)
      );
    }

    return this.toPublicState(room);
  }

  /**
   * Actualiza el estado de conexión de un jugador.
   */
  public setPlayerConnection(
    pin: string,
    playerId: string,
    isConnected: boolean
  ): boolean {
    const room = this.getRoom(pin);
    if (!room) return false;

    const player = room.players.get(playerId);
    if (!player) return false;

    player.isConnected = isConnected;
    return true;
  }

  /**
   * Convierte la sala a su representación serializable pública.
   */
  public toPublicState(room: Room): RoomPublicState {
    return {
      pin: room.pin,
      hostId: room.hostId,
      status: room.status,
      createdAt: room.createdAt,
      settings: { ...room.settings },
      players: Array.from(room.players.values()),
    };
  }

  /**
   * Elimina una sala en memoria.
   */
  public deleteRoom(pin: string): void {
    this.rooms.delete(pin.toUpperCase());
  }

  /**
   * Cuenta total de salas activas en memoria.
   */
  public countRooms(): number {
    return this.rooms.size;
  }
}

// Instancia única (singleton) en memoria para el servidor
export const roomManager = new RoomManager();

export type RoomStatus = 'LOBBY' | 'PLAYING' | 'FINISHED';

export interface RoomSettings {
  turnTimeLimit: number; // segundos por turno: 0 = sin límite, 15, 30, 45, 60
  maxPlayers: number;    // máximo de jugadores: 2 a 10
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
}

export interface Room {
  pin: string;
  hostId: string;
  status: RoomStatus;
  createdAt: number;
  settings: RoomSettings;
  players: Map<string, Player>;
}

export interface RoomPublicState {
  pin: string;
  hostId: string;
  status: RoomStatus;
  createdAt: number;
  settings: RoomSettings;
  players: Player[];
}

export type WSClientMessage =
  | {
      type: 'JOIN_ROOM';
      payload: {
        pin: string;
        playerId: string;
      };
    }
  | {
      type: 'KICK_PLAYER';
      payload: {
        pin: string;
        hostId: string;
        targetPlayerId: string;
      };
    }
  | {
      type: 'UPDATE_SETTINGS';
      payload: {
        pin: string;
        hostId: string;
        settings: Partial<RoomSettings>;
      };
    }
  | {
      type: 'PING';
    };

export type WSServerMessage =
  | {
      type: 'ROOM_STATE';
      payload: RoomPublicState;
    }
  | {
      type: 'PLAYER_CONNECTED';
      payload: {
        playerId: string;
      };
    }
  | {
      type: 'PLAYER_DISCONNECTED';
      payload: {
        playerId: string;
      };
    }
  | {
      type: 'KICKED';
      payload: {
        reason: string;
      };
    }
  | {
      type: 'ERROR';
      payload: {
        message: string;
      };
    }
  | {
      type: 'PONG';
    };

export type RoomStatus = 'LOBBY' | 'PLAYING' | 'FINISHED';

export interface RoomSettings {
  turnTimeLimit: number; // 0 = sin límite, 15, 30, 45, 60 segundos
  maxPlayers: number;    // 2 a 10
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
}

export interface RoomPublicState {
  pin: string;
  hostId: string;
  status: RoomStatus;
  createdAt: number;
  settings: RoomSettings;
  players: Player[];
}

export type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';

export type CardType =
  | 'number'
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'wild'
  | 'wild4';

export interface Card {
  id: string;
  color: CardColor;
  type: CardType;
  value?: number;
  image: string;
}

export type GameDirection = 'CLOCKWISE' | 'COUNTER_CLOCKWISE';

export interface OpponentState {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  cardCount: number;
}

export interface PlayerGameState {
  pin: string;
  myHand: Card[];
  opponents: OpponentState[];
  topCard: Card;
  currentColor: CardColor;
  currentTurnPlayerId: string;
  direction: GameDirection;
  drawPileCount: number;
  turnTimeLimit: number;
  turnStartedAt?: number;
  turnExpiresAt?: number;
  saidUnoPlayers?: string[];
  winner?: {
    id: string;
    name: string;
  };
  lastActionMessage?: string;
}

export interface CreateRoomResponse {
  pin: string;
  hostPlayer: Player;
  room: RoomPublicState;
}

export interface JoinRoomResponse {
  player: Player;
  room: RoomPublicState;
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
      type: 'START_GAME';
      payload: {
        pin: string;
        hostId: string;
      };
    }
  | {
      type: 'PLAY_CARD';
      payload: {
        pin: string;
        playerId: string;
        cardId: string;
      };
    }
  | {
      type: 'DRAW_CARD';
      payload: {
        pin: string;
        playerId: string;
      };
    }
  | {
      type: 'SAY_UNO';
      payload: {
        pin: string;
        playerId: string;
      };
    }
  | {
      type: 'RESTART_GAME';
      payload: {
        pin: string;
        hostId: string;
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
      type: 'GAME_STATE';
      payload: PlayerGameState;
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

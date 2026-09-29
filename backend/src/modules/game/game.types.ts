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
  value?: number; // 0-9 para cartas numéricas
  image: string;  // Ruta al asset: "/img/red/carta_1.png"
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
  turnStartedAt: number;   // Timestamp en ms de cuándo empezó el turno actual
  turnExpiresAt: number;   // Timestamp en ms de cuándo expira el turno (0 si turnTimeLimit es 0)
  saidUnoPlayers: string[]; // IDs de jugadores con 1 carta que ya dijeron UNO
  winner?: {
    id: string;
    name: string;
  };
  lastActionMessage?: string;
}

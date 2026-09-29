import type {
  Card,
  CardColor,
  GameDirection,
  OpponentState,
  PlayerGameState,
} from './game.types';
import type { Player } from '../rooms/room.types';

export class UnoGame {
  public readonly pin: string;
  public playerOrder: string[] = [];
  public hands: Map<string, Card[]> = new Map();
  public drawPile: Card[] = [];
  public discardPile: Card[] = [];
  public currentColor: CardColor = 'red';
  public currentTurnIndex: number = 0;
  public direction: GameDirection = 'CLOCKWISE';
  public turnTimeLimit: number = 30;
  public winner?: { id: string; name: string };
  public lastActionMessage?: string;

  constructor(pin: string, turnTimeLimit = 30) {
    this.pin = pin;
    this.turnTimeLimit = turnTimeLimit;
  }

  /**
   * Genera el mazo oficial de UNO basado en las cartas disponibles en assets.
   */
  public static createDeck(): Card[] {
    const deck: Card[] = [];
    const colors: CardColor[] = ['red', 'blue', 'green', 'yellow'];

    for (const color of colors) {
      // 1 carta de 0 por color
      deck.push({
        id: crypto.randomUUID(),
        color,
        type: 'number',
        value: 0,
        image: `/img/${color}/carta_0.png`,
      });

      // 2 cartas de 1 al 9 por color
      for (let num = 1; num <= 9; num++) {
        for (let i = 0; i < 2; i++) {
          deck.push({
            id: crypto.randomUUID(),
            color,
            type: 'number',
            value: num,
            image: `/img/${color}/carta_${num}.png`,
          });
        }
      }

      // 2 cartas de +2 por color
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: crypto.randomUUID(),
          color,
          type: 'draw2',
          image: `/img/${color}/carta_masdos.png`,
        });
      }

      // 2 cartas de Revertir por color
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: crypto.randomUUID(),
          color,
          type: 'reverse',
          image: `/img/${color}/carta_revertir.png`,
        });
      }

      // 2 cartas de Saltar por color
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: crypto.randomUUID(),
          color,
          type: 'skip',
          image: `/img/${color}/carta_saltar.png`,
        });
      }
    }

    return UnoGame.shuffle(deck);
  }

  /**
   * Algoritmo Fisher-Yates para barajar el mazo aleatoriamente.
   */
  public static shuffle(cards: Card[]): Card[] {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp;
    }
    return shuffled;
  }

  /**
   * Inicializa la partida, reparte 7 cartas a cada jugador y coloca la primera carta.
   */
  public start(players: Player[]): void {
    if (players.length < 2) {
      throw new Error('Se necesitan al menos 2 jugadores para iniciar.');
    }

    this.playerOrder = players.map((p) => p.id);
    this.hands.clear();
    this.direction = 'CLOCKWISE';
    this.currentTurnIndex = 0;
    this.winner = undefined;

    let deck = UnoGame.createDeck();

    // Repartir 7 cartas a cada jugador
    for (const player of players) {
      const hand = deck.splice(0, 7);
      this.hands.set(player.id, hand);
    }

    // Encontrar una carta inicial numérica para empezar limpiamente
    let initialIndex = deck.findIndex((c) => c.type === 'number');
    if (initialIndex === -1) {
      initialIndex = 0;
    }

    const [firstCard] = deck.splice(initialIndex, 1);
    if (!firstCard) {
      throw new Error('Error al extraer carta inicial.');
    }

    this.discardPile = [firstCard];
    this.drawPile = deck;
    this.currentColor = firstCard.color;
    this.lastActionMessage = `¡Partida iniciada! Carta de salida: ${firstCard.value} ${this.getColorName(firstCard.color)}.`;
  }

  /**
   * Obtiene el jugador cuyo turno está activo.
   */
  public getCurrentTurnPlayerId(): string {
    return this.playerOrder[this.currentTurnIndex] || this.playerOrder[0] || '';
  }

  /**
   * Retorna la carta en la cima de la pila de descarte.
   */
  public getTopCard(): Card {
    return this.discardPile[this.discardPile.length - 1]!;
  }

  /**
   * Determina si una carta puede jugarse legalmente sobre la carta actual.
   */
  public canPlayCard(card: Card): boolean {
    const top = this.getTopCard();
    // 1. Mismo color activo
    if (card.color === this.currentColor) return true;
    // 2. Mismo número
    if (card.type === 'number' && top.type === 'number' && card.value === top.value) {
      return true;
    }
    // 3. Misma acción especial (+2, revertir, saltar)
    if (card.type !== 'number' && card.type === top.type) {
      return true;
    }
    return false;
  }

  /**
   * Avanza el turno un número de posiciones según la dirección actual.
   */
  private advanceTurn(steps = 1): void {
    const total = this.playerOrder.length;
    const dir = this.direction === 'CLOCKWISE' ? 1 : -1;
    this.currentTurnIndex = (((this.currentTurnIndex + (dir * steps)) % total) + total) % total;
  }

  /**
   * Obtiene el ID del jugador siguiente según un desplazamiento.
   */
  private getNextPlayerId(steps = 1): string {
    const total = this.playerOrder.length;
    const dir = this.direction === 'CLOCKWISE' ? 1 : -1;
    const index = (((this.currentTurnIndex + (dir * steps)) % total) + total) % total;
    return this.playerOrder[index]!;
  }

  /**
   * Si el mazo de robo se agota, recicla la pila de descarte barajándola de nuevo.
   */
  private replenishDrawPileIfNeeded(): void {
    if (this.drawPile.length === 0 && this.discardPile.length > 1) {
      const topCard = this.discardPile.pop()!;
      this.drawPile = UnoGame.shuffle(this.discardPile);
      this.discardPile = [topCard];
    }
  }

  /**
   * Realiza la jugada de una carta validando reglas de UNO y aplicando efectos.
   */
  public playCard(
    playerId: string,
    cardId: string,
    playerName: string
  ): { success: boolean; effectMessage: string; winner?: { id: string; name: string } } {
    if (this.winner) {
      throw new Error('La partida ya ha finalizado.');
    }

    if (this.getCurrentTurnPlayerId() !== playerId) {
      throw new Error('No es tu turno para jugar.');
    }

    const hand = this.hands.get(playerId);
    if (!hand) {
      throw new Error('No se encontró la mano del jugador.');
    }

    const cardIndex = hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      throw new Error('La carta no pertenece a tu mano.');
    }

    const [card] = hand.splice(cardIndex, 1);
    if (!card || !this.canPlayCard(card)) {
      if (card) hand.splice(cardIndex, 0, card); // revertir extracción
      throw new Error('Esta carta no coincide en color, número o símbolo con la carta activa.');
    }

    // Colocar en la pila de descarte y actualizar color activo
    this.discardPile.push(card);
    this.currentColor = card.color;

    // Condición de Victoria: Se quedó sin cartas
    if (hand.length === 0) {
      this.winner = { id: playerId, name: playerName };
      this.lastActionMessage = `🏆 ¡${playerName} se ha quedado sin cartas y ha ganado la partida!`;
      return {
        success: true,
        effectMessage: this.lastActionMessage,
        winner: this.winner,
      };
    }

    // Efectos de cartas especiales
    let effectMsg = '';
    const colorName = this.getColorName(card.color);

    if (card.type === 'number') {
      effectMsg = `${playerName} jugó ${card.value} ${colorName}.`;
      this.advanceTurn(1);
    } else if (card.type === 'skip') {
      this.advanceTurn(2);
      effectMsg = `🚫 ${playerName} jugó un SALTO ${colorName}. ¡Se saltó el turno del siguiente jugador!`;
    } else if (card.type === 'reverse') {
      if (this.playerOrder.length === 2) {
        // En 2 jugadores, Revertir actúa como Salto
        this.advanceTurn(2);
        effectMsg = `🔄 ${playerName} jugó REVERTIR ${colorName}. ¡Vuelve a jugar!`;
      } else {
        this.direction =
          this.direction === 'CLOCKWISE' ? 'COUNTER_CLOCKWISE' : 'CLOCKWISE';
        this.advanceTurn(1);
        effectMsg = `🔄 ${playerName} jugó REVERTIR ${colorName}. ¡El sentido cambió a ${
          this.direction === 'CLOCKWISE' ? 'horario' : 'antihorario'
        }!`;
      }
    } else if (card.type === 'draw2') {
      const victimId = this.getNextPlayerId(1);
      this.replenishDrawPileIfNeeded();
      const victimHand = this.hands.get(victimId) || [];
      const drawnCards = this.drawPile.splice(0, Math.min(2, this.drawPile.length));
      victimHand.push(...drawnCards);
      this.hands.set(victimId, victimHand);
      this.advanceTurn(2);
      effectMsg = `💥 ${playerName} jugó un +2 ${colorName}. ¡El siguiente jugador roba 2 cartas y pierde su turno!`;
    }

    if (hand.length === 1) {
      effectMsg += ` ⚠️ ¡${playerName} gritó UNO!`;
    }

    this.lastActionMessage = effectMsg;
    this.replenishDrawPileIfNeeded();

    return {
      success: true,
      effectMessage: effectMsg,
    };
  }

  /**
   * Roba una carta del mazo para el jugador en turno y pasa el turno.
   */
  public drawCard(
    playerId: string,
    playerName: string
  ): { success: boolean; drawnCard: Card; effectMessage: string } {
    if (this.winner) {
      throw new Error('La partida ya ha finalizado.');
    }

    if (this.getCurrentTurnPlayerId() !== playerId) {
      throw new Error('No es tu turno para robar.');
    }

    this.replenishDrawPileIfNeeded();
    if (this.drawPile.length === 0) {
      throw new Error('No quedan más cartas en el mazo de robo.');
    }

    const hand = this.hands.get(playerId);
    if (!hand) {
      throw new Error('Mano del jugador no encontrada.');
    }

    const drawnCard = this.drawPile.shift()!;
    hand.push(drawnCard);

    this.advanceTurn(1);
    this.lastActionMessage = `🃏 ${playerName} robó 1 carta del mazo y pasó turno.`;

    return {
      success: true,
      drawnCard,
      effectMessage: this.lastActionMessage,
    };
  }

  /**
   * Traduce el nombre del color para mensajes amigables.
   */
  private getColorName(color: CardColor): string {
    const map: Record<CardColor, string> = {
      red: 'Rojo',
      blue: 'Azul',
      green: 'Verde',
      yellow: 'Amarillo',
      wild: 'Comodín',
    };
    return map[color] || color;
  }

  /**
   * Construye el estado individual y seguro para un jugador específico.
   */
  public getPlayerState(
    playerId: string,
    allPlayers: Map<string, Player>
  ): PlayerGameState {
    const myHand = this.hands.get(playerId) || [];
    const topCard = this.getTopCard();

    const opponents: OpponentState[] = this.playerOrder
      .filter((id) => id !== playerId)
      .map((id) => {
        const p = allPlayers.get(id);
        const hand = this.hands.get(id) || [];
        return {
          id,
          name: p?.name || 'Jugador',
          isHost: p?.isHost || false,
          isConnected: p?.isConnected || false,
          cardCount: hand.length,
        };
      });

    return {
      pin: this.pin,
      myHand,
      opponents,
      topCard,
      currentColor: this.currentColor,
      currentTurnPlayerId: this.getCurrentTurnPlayerId(),
      direction: this.direction,
      drawPileCount: this.drawPile.length,
      turnTimeLimit: this.turnTimeLimit,
      winner: this.winner,
      lastActionMessage: this.lastActionMessage,
    };
  }
}

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
  public turnStartedAt: number = Date.now();
  public turnExpiresAt: number = 0;
  public winner?: { id: string; name: string };
  public lastActionMessage?: string;
  public saidUno: Set<string> = new Set(); // Jugadores con 1 carta protegidos por cantar UNO

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

    // 4 cartas Comodín +4 (Wild Draw 4)
    for (let i = 0; i < 4; i++) {
      deck.push({
        id: crypto.randomUUID(),
        color: 'wild',
        type: 'wild4',
        image: '/img/carta_mascuatro.png',
      });
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
    this.saidUno.clear();
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
    this.turnStartedAt = Date.now();
    this.turnExpiresAt =
      this.turnTimeLimit > 0 ? this.turnStartedAt + this.turnTimeLimit * 1000 : 0;
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
    // 0. Cartas comodín (+4 y wild) se pueden jugar sobre cualquier carta
    if (card.color === 'wild' || card.type === 'wild4' || card.type === 'wild') {
      return true;
    }

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
   * Avanza el turno un número de posiciones según la dirección actual y reinicia el reloj de turno.
   */
  private advanceTurn(steps = 1): void {
    const total = this.playerOrder.length;
    const dir = this.direction === 'CLOCKWISE' ? 1 : -1;
    this.currentTurnIndex = (((this.currentTurnIndex + (dir * steps)) % total) + total) % total;
    this.turnStartedAt = Date.now();
    this.turnExpiresAt =
      this.turnTimeLimit > 0 ? this.turnStartedAt + this.turnTimeLimit * 1000 : 0;
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
    playerName: string,
    chosenColor?: CardColor,
    allPlayers?: Map<string, Player>
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
    if (card.color === 'wild' || card.type === 'wild4' || card.type === 'wild') {
      const validColors: CardColor[] = ['red', 'blue', 'green', 'yellow'];
      this.currentColor =
        chosenColor && validColors.includes(chosenColor) ? chosenColor : 'red';
    } else {
      this.currentColor = card.color;
    }

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

    // Si queda en 1 carta, debe decir UNO (aún no está protegido)
    this.saidUno.delete(playerId);

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
      const victim = allPlayers?.get(victimId);
      const victimName = victim?.name || 'El siguiente jugador';
      this.replenishDrawPileIfNeeded();
      const victimHand = this.hands.get(victimId) || [];
      const drawnCards = this.drawPile.splice(0, Math.min(2, this.drawPile.length));
      victimHand.push(...drawnCards);
      this.hands.set(victimId, victimHand);
      this.saidUno.delete(victimId);
      this.advanceTurn(2);
      effectMsg = `💥 ${playerName} jugó un +2 ${colorName}. ¡${victimName} roba 2 cartas y pierde su turno!`;
    } else if (card.type === 'wild4') {
      const victimId = this.getNextPlayerId(1);
      const victim = allPlayers?.get(victimId);
      const victimName = victim?.name || 'El siguiente jugador';
      this.replenishDrawPileIfNeeded();
      const victimHand = this.hands.get(victimId) || [];
      const drawnCards = this.drawPile.splice(0, Math.min(4, this.drawPile.length));
      victimHand.push(...drawnCards);
      this.hands.set(victimId, victimHand);
      this.saidUno.delete(victimId);
      this.advanceTurn(2);
      const chosenColorName = this.getColorName(this.currentColor);
      effectMsg = `💥 ¡${playerName} jugó un COMODÍN +4! Cambió el color a ${chosenColorName}. ¡${victimName} roba 4 cartas y pierde su turno!`;
    }

    if (hand.length === 1) {
      effectMsg += ` ⚠️ ¡A ${playerName} le queda 1 carta! (¡Canten UNO!)`;
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
    this.saidUno.delete(playerId);

    this.advanceTurn(1);
    this.lastActionMessage = `🃏 ${playerName} robó 1 carta del mazo y pasó turno.`;

    return {
      success: true,
      drawnCard,
      effectMessage: this.lastActionMessage,
    };
  }

  /**
   * Maneja la acción de cantar UNO:
   * - Si quien lo canta tiene 1 carta y no ha cantado UNO, se protege a sí mismo.
   * - Si quien lo canta denuncia a un rival que tiene 1 carta y no lo ha dicho, el rival roba 2 cartas de penalización.
   */
  public sayUno(
    callerId: string,
    callerName: string,
    allPlayers: Map<string, Player>
  ): { success: boolean; effectMessage: string; penalizedPlayerId?: string } {
    if (this.winner) {
      throw new Error('La partida ya ha finalizado.');
    }

    const callerHand = this.hands.get(callerId) || [];

    // Caso 1: El propio jugador tiene 1 carta y aún no ha cantado UNO -> Se protege a sí mismo
    if (callerHand.length === 1 && !this.saidUno.has(callerId)) {
      this.saidUno.add(callerId);
      const msg = `🎉 ¡${callerName} cantó ¡UNO! a tiempo! Queda protegido.`;
      this.lastActionMessage = msg;
      return { success: true, effectMessage: msg };
    }

    // Caso 2: El jugador denuncia a OTRA persona que tiene 1 carta y NO ha cantado UNO
    const vulnerableId = this.playerOrder.find((id) => {
      const h = this.hands.get(id);
      return h && h.length === 1 && !this.saidUno.has(id) && id !== callerId;
    });

    if (vulnerableId) {
      const victim = allPlayers.get(vulnerableId);
      const victimName = victim?.name || 'El jugador';
      const victimHand = this.hands.get(vulnerableId) || [];

      this.replenishDrawPileIfNeeded();
      const penaltyCards = this.drawPile.splice(0, Math.min(2, this.drawPile.length));
      victimHand.push(...penaltyCards);
      this.hands.set(vulnerableId, victimHand);
      this.saidUno.delete(vulnerableId);

      const msg = `🚨 ¡${callerName} descubrió a ${victimName} sin decir UNO! ${victimName} recibe 2 cartas de penalización.`;
      this.lastActionMessage = msg;
      return { success: true, effectMessage: msg, penalizedPlayerId: vulnerableId };
    }

    if (callerHand.length === 1 && this.saidUno.has(callerId)) {
      throw new Error('Ya habías cantado UNO para tu última carta.');
    }

    throw new Error('No hay ningún jugador con 1 carta vulnerable.');
  }

  /**
   * Maneja el timeout de un turno cuando se agota el tiempo límite.
   * El jugador cuyo turno expiró roba 1 carta del mazo y pasa su turno automáticamente.
   */
  public handleTurnTimeout(allPlayers: Map<string, Player>): {
    timedOutPlayerId: string;
    drawnCard?: Card;
    effectMessage: string;
  } | null {
    if (this.winner || this.turnTimeLimit <= 0) return null;

    const currentTurnId = this.getCurrentTurnPlayerId();
    const player = allPlayers.get(currentTurnId);
    const playerName = player?.name || 'El jugador';

    this.replenishDrawPileIfNeeded();
    const hand = this.hands.get(currentTurnId);
    if (!hand) return null;

    let drawnCard: Card | undefined;
    if (this.drawPile.length > 0) {
      drawnCard = this.drawPile.shift()!;
      hand.push(drawnCard);
    }
    this.saidUno.delete(currentTurnId);

    this.advanceTurn(1);
    this.lastActionMessage = `⏰ ¡Se agotó el tiempo de ${playerName}! Robó 1 carta del mazo y pasó turno.`;

    return {
      timedOutPlayerId: currentTurnId,
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
      turnStartedAt: this.turnStartedAt,
      turnExpiresAt: this.turnExpiresAt,
      saidUnoPlayers: Array.from(this.saidUno),
      winner: this.winner,
      lastActionMessage: this.lastActionMessage,
    };
  }
}

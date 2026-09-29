import { describe, expect, it } from 'bun:test';
import { UnoGame } from '../src/modules/game/game.manager';
import type { Player, Card } from '../src/modules/rooms/room.types';

describe('Jugabilidad de la Carta Comodín +4 (Wild Draw Four)', () => {
  it('el mazo generado incluye 4 cartas de comodín +4', () => {
    const deck = UnoGame.createDeck();
    const wild4Cards = deck.filter((c) => c.type === 'wild4');
    expect(wild4Cards.length).toBe(4);
    for (const c of wild4Cards) {
      expect(c.color).toBe('wild');
      expect(c.image).toBe('/img/carta_mascuatro.png');
    }
  });

  it('un comodín +4 es jugable sobre cualquier color o número', () => {
    const game = new UnoGame('TEST', 30);
    const p1: Player = { id: 'p1', name: 'Alice', isHost: true, isConnected: true };
    const p2: Player = { id: 'p2', name: 'Bob', isHost: false, isConnected: true };
    game.start([p1, p2]);

    const wild4Card: Card = {
      id: 'wild4-1',
      color: 'wild',
      type: 'wild4',
      image: '/img/carta_mascuatro.png',
    };

    expect(game.canPlayCard(wild4Card)).toBe(true);
  });

  it('al jugar un +4, el rival roba 4 cartas, pierde el turno y se cambia el color activo', () => {
    const game = new UnoGame('TEST', 30);
    const p1: Player = { id: 'p1', name: 'Alice', isHost: true, isConnected: true };
    const p2: Player = { id: 'p2', name: 'Bob', isHost: false, isConnected: true };
    const playersMap = new Map<string, Player>([
      ['p1', p1],
      ['p2', p2],
    ]);

    game.start([p1, p2]);

    const wild4Card: Card = {
      id: 'wild4-test',
      color: 'wild',
      type: 'wild4',
      image: '/img/carta_mascuatro.png',
    };

    // Le damos el +4 a Alice (p1)
    const p1Hand = game.hands.get('p1')!;
    p1Hand.push(wild4Card);

    const initialBobHandCount = game.hands.get('p2')!.length; // 7

    // Alice juega el +4 y elige color azul
    const result = game.playCard('p1', wild4Card.id, 'Alice', 'blue', playersMap);

    expect(result.success).toBe(true);
    expect(game.currentColor).toBe('blue');
    expect(result.effectMessage).toContain('COMODÍN +4');
    expect(result.effectMessage).toContain('Azul');
    expect(result.effectMessage).toContain('Bob roba 4 cartas y pierde su turno');

    // Bob ahora tiene 7 + 4 = 11 cartas
    expect(game.hands.get('p2')?.length).toBe(initialBobHandCount + 4);

    // En 2 jugadores, al perder el turno Bob, le toca de nuevo a Alice
    expect(game.getCurrentTurnPlayerId()).toBe('p1');
  });

  it('en partida de 3 jugadores, el siguiente roba 4 y el tercer jugador toma el turno', () => {
    const game = new UnoGame('TEST', 30);
    const p1: Player = { id: 'p1', name: 'Alice', isHost: true, isConnected: true };
    const p2: Player = { id: 'p2', name: 'Bob', isHost: false, isConnected: true };
    const p3: Player = { id: 'p3', name: 'Charlie', isHost: false, isConnected: true };
    const playersMap = new Map<string, Player>([
      ['p1', p1],
      ['p2', p2],
      ['p3', p3],
    ]);

    game.start([p1, p2, p3]);

    const wild4Card: Card = {
      id: 'wild4-test-3p',
      color: 'wild',
      type: 'wild4',
      image: '/img/carta_mascuatro.png',
    };

    game.hands.get('p1')!.push(wild4Card);

    // Alice juega +4 y elige verde
    game.playCard('p1', wild4Card.id, 'Alice', 'green', playersMap);

    expect(game.currentColor).toBe('green');
    // Bob robó 4 (7 + 4 = 11)
    expect(game.hands.get('p2')?.length).toBe(11);
    // Bob fue saltado, así que el turno pasa a Charlie
    expect(game.getCurrentTurnPlayerId()).toBe('p3');
  });
});

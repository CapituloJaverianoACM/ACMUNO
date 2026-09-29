import { describe, expect, it } from 'bun:test';
import { UnoGame } from '../src/modules/game/game.manager';
import type { Player } from '../src/modules/rooms/room.types';

describe('Reglas de Tiempo de Turno y Timeout Automático', () => {
  it('inicializa los timestamps de turno correctamente según el límite configurado', () => {
    const game = new UnoGame('TEST', 15);
    const p1: Player = { id: 'p1', name: 'Alice', isHost: true, isConnected: true };
    const p2: Player = { id: 'p2', name: 'Bob', isHost: false, isConnected: true };

    game.start([p1, p2]);

    expect(game.turnTimeLimit).toBe(15);
    expect(game.turnStartedAt).toBeGreaterThan(0);
    expect(game.turnExpiresAt).toBe(game.turnStartedAt + 15 * 1000);
  });

  it('cuando se agota el tiempo, el jugador de turno roba 1 carta del mazo y pasa el turno', () => {
    const game = new UnoGame('TEST', 15);
    const p1: Player = { id: 'p1', name: 'Alice', isHost: true, isConnected: true };
    const p2: Player = { id: 'p2', name: 'Bob', isHost: false, isConnected: true };

    const playersMap = new Map<string, Player>([
      ['p1', p1],
      ['p2', p2],
    ]);

    game.start([p1, p2]);

    const initialP1HandSize = game.hands.get('p1')!.length; // 7 cartas
    expect(game.getCurrentTurnPlayerId()).toBe('p1');

    // Se agota el tiempo para Alice (p1)
    const result = game.handleTurnTimeout(playersMap);

    expect(result).not.toBeNull();
    expect(result?.timedOutPlayerId).toBe('p1');
    expect(result?.effectMessage).toContain('¡Se agotó el tiempo de Alice!');
    expect(result?.effectMessage).toContain('Robó 1 carta del mazo y pasó turno');

    // Alice ahora tiene 7 + 1 = 8 cartas
    expect(game.hands.get('p1')?.length).toBe(initialP1HandSize + 1);

    // El turno avanzó a Bob (p2)
    expect(game.getCurrentTurnPlayerId()).toBe('p2');

    // El reloj de turno se reinició para Bob
    expect(game.turnExpiresAt).toBeGreaterThan(Date.now() - 100);
  });

  it('si el límite de tiempo es 0 (sin límite), no se ejecuta timeout', () => {
    const game = new UnoGame('TEST', 0);
    const p1: Player = { id: 'p1', name: 'Alice', isHost: true, isConnected: true };
    const p2: Player = { id: 'p2', name: 'Bob', isHost: false, isConnected: true };

    const playersMap = new Map<string, Player>([
      ['p1', p1],
      ['p2', p2],
    ]);

    game.start([p1, p2]);

    expect(game.turnExpiresAt).toBe(0);

    const result = game.handleTurnTimeout(playersMap);
    expect(result).toBeNull();
    expect(game.getCurrentTurnPlayerId()).toBe('p1');
    expect(game.hands.get('p1')?.length).toBe(7);
  });

  it('si un jugador tenía 1 carta y se le agota el tiempo, roba carta y pierde cualquier estado de UNO', () => {
    const game = new UnoGame('TEST', 15);
    const p1: Player = { id: 'p1', name: 'Alice', isHost: true, isConnected: true };
    const p2: Player = { id: 'p2', name: 'Bob', isHost: false, isConnected: true };

    const playersMap = new Map<string, Player>([
      ['p1', p1],
      ['p2', p2],
    ]);

    game.start([p1, p2]);

    // Dejamos a Alice con 1 carta
    const p1Hand = game.hands.get('p1')!;
    game.hands.set('p1', [p1Hand[0]!]);
    game.saidUno.add('p1');

    expect(game.hands.get('p1')?.length).toBe(1);
    expect(game.saidUno.has('p1')).toBe(true);

    // Se agota el tiempo
    game.handleTurnTimeout(playersMap);

    // Alice ahora tiene 2 cartas y ya no está en saidUno
    expect(game.hands.get('p1')?.length).toBe(2);
    expect(game.saidUno.has('p1')).toBe(false);
  });
});

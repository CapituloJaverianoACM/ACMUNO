import { describe, expect, it } from 'bun:test';
import { UnoGame } from '../src/modules/game/game.manager';
import type { Player } from '../src/modules/rooms/room.types';

describe('Regla Oficial de Cantar UNO y Penalizaciones', () => {
  it('un jugador con 1 carta puede cantar UNO y quedar protegido', () => {
    const game = new UnoGame('TEST', 30);
    const p1: Player = { id: 'p1', name: 'Alice', isHost: true, isConnected: true };
    const p2: Player = { id: 'p2', name: 'Bob', isHost: false, isConnected: true };

    const playersMap = new Map<string, Player>([
      ['p1', p1],
      ['p2', p2],
    ]);

    game.start([p1, p2]);

    // Dejamos a Alice con 1 sola carta
    const p1Hand = game.hands.get('p1')!;
    game.hands.set('p1', [p1Hand[0]!]);
    expect(game.hands.get('p1')?.length).toBe(1);
    expect(game.saidUno.has('p1')).toBe(false);

    // Alice canta UNO
    const result = game.sayUno('p1', 'Alice', playersMap);
    expect(result.success).toBe(true);
    expect(game.saidUno.has('p1')).toBe(true);
    expect(result.effectMessage).toContain('Alice cantó ¡UNO! a tiempo');
  });

  it('si otra persona denuncia al jugador con 1 carta antes de que diga UNO, el jugador vulnerable roba 2 cartas', () => {
    const game = new UnoGame('TEST', 30);
    const p1: Player = { id: 'p1', name: 'Alice', isHost: true, isConnected: true };
    const p2: Player = { id: 'p2', name: 'Bob', isHost: false, isConnected: true };

    const playersMap = new Map<string, Player>([
      ['p1', p1],
      ['p2', p2],
    ]);

    game.start([p1, p2]);

    // Alice se queda con 1 carta y NO dice UNO
    const p1Hand = game.hands.get('p1')!;
    game.hands.set('p1', [p1Hand[0]!]);
    expect(game.hands.get('p1')?.length).toBe(1);
    expect(game.saidUno.has('p1')).toBe(false);

    // Bob descubre a Alice sin decir UNO y la denuncia
    const result = game.sayUno('p2', 'Bob', playersMap);
    expect(result.success).toBe(true);
    expect(result.penalizedPlayerId).toBe('p1');
    expect(result.effectMessage).toContain('Bob descubrió a Alice sin decir UNO');
    expect(result.effectMessage).toContain('Alice recibe 2 cartas de penalización');

    // La mano de Alice ahora tiene 1 + 2 = 3 cartas
    expect(game.hands.get('p1')?.length).toBe(3);
    // Alice ya no está en dicho UNO
    expect(game.saidUno.has('p1')).toBe(false);
  });

  it('si el jugador ya cantó UNO, otro rival NO puede denunciarlo', () => {
    const game = new UnoGame('TEST', 30);
    const p1: Player = { id: 'p1', name: 'Alice', isHost: true, isConnected: true };
    const p2: Player = { id: 'p2', name: 'Bob', isHost: false, isConnected: true };

    const playersMap = new Map<string, Player>([
      ['p1', p1],
      ['p2', p2],
    ]);

    game.start([p1, p2]);

    // Alice tiene 1 carta y se protege a sí misma
    const p1Hand = game.hands.get('p1')!;
    game.hands.set('p1', [p1Hand[0]!]);
    game.sayUno('p1', 'Alice', playersMap);
    expect(game.saidUno.has('p1')).toBe(true);

    // Bob intenta denunciar a Alice protegida -> debe fallar
    expect(() => {
      game.sayUno('p2', 'Bob', playersMap);
    }).toThrow('No hay ningún jugador con 1 carta vulnerable.');

    // La mano de Alice sigue siendo de 1 carta
    expect(game.hands.get('p1')?.length).toBe(1);
  });

  it('no permite cantar UNO si nadie tiene 1 carta vulnerable', () => {
    const game = new UnoGame('TEST', 30);
    const p1: Player = { id: 'p1', name: 'Alice', isHost: true, isConnected: true };
    const p2: Player = { id: 'p2', name: 'Bob', isHost: false, isConnected: true };

    const playersMap = new Map<string, Player>([
      ['p1', p1],
      ['p2', p2],
    ]);

    game.start([p1, p2]);
    // Ambos tienen 7 cartas inicialmente
    expect(game.hands.get('p1')?.length).toBe(7);
    expect(game.hands.get('p2')?.length).toBe(7);

    expect(() => {
      game.sayUno('p1', 'Alice', playersMap);
    }).toThrow('No hay ningún jugador con 1 carta vulnerable.');
  });
});

import { describe, expect, it } from 'bun:test';
import { app, clearTurnTimer } from '../src/index';
import { roomManager } from '../src/modules/rooms/room.manager';

describe('Integración API: Temporizador de Turno y Timeout', () => {
  it('aplica el timeout de 15 segundos y hace robar carta al jugador que se le agotó el tiempo', async () => {
    // 1. Crear sala
    const createRes = await app.handle(
      new Request('http://localhost:3001/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: 'HostPlayer' }),
      })
    );
    expect(createRes.status).toBe(200);
    const createData = (await createRes.json()) as any;
    const pin = createData.pin;
    const hostId = createData.hostPlayer.id;

    // 2. Ajustar tiempo de turno a 15s
    const room = roomManager.getRoom(pin)!;
    room.settings.turnTimeLimit = 15;

    // 3. Unir segundo jugador
    const joinRes = await app.handle(
      new Request(`http://localhost:3001/api/rooms/${pin}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: 'GuestPlayer' }),
      })
    );
    expect(joinRes.status).toBe(200);
    const joinData = (await joinRes.json()) as any;
    const guestId = joinData.player.id;

    // 4. Iniciar partida
    const startRes = await app.handle(
      new Request(`http://localhost:3001/api/rooms/${pin}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId }),
      })
    );
    expect(startRes.status).toBe(200);
    expect(room.game).toBeDefined();
    expect(room.game!.turnTimeLimit).toBe(15);
    expect(room.game!.turnExpiresAt).toBeGreaterThan(Date.now() - 50);

    const activePlayerId = room.game!.getCurrentTurnPlayerId();
    const initialHandCount = room.game!.hands.get(activePlayerId)!.length; // 7

    // 5. Ejecutar timeout vía API
    const timeoutRes = await app.handle(
      new Request(`http://localhost:3001/api/rooms/${pin}/timeout`, {
        method: 'POST',
      })
    );
    expect(timeoutRes.status).toBe(200);
    const timeoutData = (await timeoutRes.json()) as any;
    expect(timeoutData.success).toBe(true);
    expect(timeoutData.result.timedOutPlayerId).toBe(activePlayerId);

    // 6. El jugador que perdió su tiempo ahora tiene 8 cartas
    expect(room.game!.hands.get(activePlayerId)?.length).toBe(initialHandCount + 1);

    // 7. El turno cambió al otro jugador
    const newActivePlayerId = room.game!.getCurrentTurnPlayerId();
    expect(newActivePlayerId).not.toBe(activePlayerId);

    // Limpiar timer de fondo para evitar que quede corriendo
    clearTurnTimer(pin);
  });
});

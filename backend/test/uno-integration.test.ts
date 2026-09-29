import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { roomManager } from '../src/modules/rooms/room.manager';

describe('Integración API: Endpoint de Cantar / Denunciar UNO', () => {
  it('permite a un jugador denunciar a un rival por HTTP POST /api/rooms/:pin/uno', async () => {
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

    // 2. Unir segundo jugador
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

    // 3. Iniciar juego
    const startRes = await app.handle(
      new Request(`http://localhost:3001/api/rooms/${pin}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId }),
      })
    );
    expect(startRes.status).toBe(200);

    const room = roomManager.getRoom(pin)!;
    expect(room).toBeDefined();
    expect(room.game).toBeDefined();

    // 4. Modificamos la mano del host para que tenga 1 carta sin haber cantado UNO
    const hostHand = room.game!.hands.get(hostId)!;
    room.game!.hands.set(hostId, [hostHand[0]!]);
    expect(room.game!.hands.get(hostId)?.length).toBe(1);

    // 5. El invitado denuncia al Host vía POST /api/rooms/:pin/uno
    const unoRes = await app.handle(
      new Request(`http://localhost:3001/api/rooms/${pin}/uno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: guestId }),
      })
    );
    expect(unoRes.status).toBe(200);
    const unoData = (await unoRes.json()) as any;
    expect(unoData.success).toBe(true);
    expect(unoData.result.penalizedPlayerId).toBe(hostId);
    expect(unoData.result.effectMessage).toContain('HostPlayer recibe 2 cartas de penalización');

    // 6. El Host ahora tiene 3 cartas (1 original + 2 penalización)
    expect(room.game!.hands.get(hostId)?.length).toBe(3);
  });
});

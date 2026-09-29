import type {
  CreateRoomResponse,
  JoinRoomResponse,
  RoomPublicState,
  RoomSettings,
} from '@/types/room';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function createRoom(
  hostName: string
): Promise<CreateRoomResponse> {
  const res = await fetch(`${API_BASE_URL}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hostName }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al crear la sala');
  }

  return res.json();
}

export async function getRoom(
  pin: string
): Promise<{ exists: boolean; room: RoomPublicState }> {
  const res = await fetch(`${API_BASE_URL}/api/rooms/${pin.toUpperCase()}`);
  if (!res.ok) {
    throw new Error('Sala no encontrada');
  }
  return res.json();
}

export async function joinRoom(
  pin: string,
  playerName: string
): Promise<JoinRoomResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/rooms/${pin.toUpperCase()}/join`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ playerName }),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al unirse a la sala');
  }

  return res.json();
}

export async function kickPlayer(
  pin: string,
  hostId: string,
  targetPlayerId: string
): Promise<{ success: boolean; room: RoomPublicState }> {
  const res = await fetch(
    `${API_BASE_URL}/api/rooms/${pin.toUpperCase()}/kick`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hostId, targetPlayerId }),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al expulsar al jugador');
  }

  return res.json();
}

export async function updateRoomSettings(
  pin: string,
  hostId: string,
  settings: Partial<RoomSettings>
): Promise<{ success: boolean; room: RoomPublicState }> {
  const res = await fetch(
    `${API_BASE_URL}/api/rooms/${pin.toUpperCase()}/settings`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hostId, settings }),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al actualizar configuración');
  }

  return res.json();
}

'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRoomSocket } from '@/hooks/useRoomSocket';
import { joinRoom } from '@/lib/api';
import { QrModal } from '@/components/QrModal';
import { GameBoard } from '@/components/GameBoard';
import type { Player } from '@/types/room';

interface RoomPageProps {
  params: Promise<{
    pin: string;
  }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const pin = resolvedParams.pin.toUpperCase();

  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);

  // Estado para visitantes directos (enlace o QR) que aún no tienen apodo
  const [promptName, setPromptName] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [joiningGuest, setJoiningGuest] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Inicializar o solicitar apodo si el usuario entra por enlace directo / QR
  useEffect(() => {
    const saved = sessionStorage.getItem(`uno_player_${pin}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Player;
        setCurrentPlayer(parsed);
      } catch (e) {
        console.error('Error parseando jugador en sessionStorage:', e);
        setPromptName(true);
      }
    } else {
      setPromptName(true);
    }
  }, [pin]);

  // Manejar el caso de unirse desde el modal de enlace directo
  const handleJoinDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestNameInput.trim()) {
      setJoinError('Por favor ingresa tu apodo');
      return;
    }

    try {
      setJoiningGuest(true);
      setJoinError(null);

      const data = await joinRoom(pin, guestNameInput.trim());
      sessionStorage.setItem(
        `uno_player_${pin}`,
        JSON.stringify(data.player)
      );
      setCurrentPlayer(data.player);
      setPromptName(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setJoinError(err.message);
      } else {
        setJoinError('No se pudo unir a la sala.');
      }
    } finally {
      setJoiningGuest(false);
    }
  };

  // Conexión en tiempo real por WebSocket
  const {
    isConnected,
    roomState,
    gameState,
    error,
    isKicked,
    kickReason,
    startGame,
    playCard,
    drawCard,
    sayUno,
    restartGame,
    kickPlayer,
    updateSettings,
  } = useRoomSocket(pin, currentPlayer?.id || null, {
    onKicked: () => {
      sessionStorage.removeItem(`uno_player_${pin}`);
      setTimeout(() => {
        router.push('/');
      }, 4000);
    },
  });

  const isHost = currentPlayer?.isHost || roomState?.hostId === currentPlayer?.id;

  const copyPin = () => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const copyLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/room/${pin}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Si la partida ya inició y tenemos el estado del jugador, renderizar el tablero de juego
  if (gameState && (roomState?.status === 'PLAYING' || roomState?.status === 'FINISHED' || gameState.myHand.length > 0)) {
    return (
      <main className="min-h-screen bg-transparent text-white flex flex-col items-center justify-center p-2 sm:p-4 relative overflow-hidden select-none">
        <GameBoard
          gameState={gameState}
          currentPlayer={currentPlayer}
          isConnected={isConnected}
          error={error}
          onPlayCard={playCard}
          onDrawCard={drawCard}
          onSayUno={sayUno}
          onRestartGame={restartGame}
          onExit={() => router.push('/')}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent text-white flex flex-col items-center justify-between p-4 sm:p-6 md:p-10 relative overflow-hidden select-none">
      {/* Cartas de fondo */}
      <div className="absolute -top-6 -left-6 sm:top-2 sm:left-2 md:top-8 md:left-6 z-0 pointer-events-none opacity-60 sm:opacity-90">
        <Image
          src="/img/red/carta_1.png"
          alt="Carta 1 Roja"
          width={150}
          height={220}
          className="w-24 sm:w-32 md:w-40 transform -rotate-[14deg] drop-shadow-[0_12px_24px_rgba(229,40,55,0.2)]"
        />
      </div>
      <div className="absolute -bottom-6 -right-6 sm:bottom-2 sm:right-2 md:bottom-6 md:right-6 z-0 pointer-events-none opacity-60 sm:opacity-90">
        <Image
          src="/img/green/carta_revertir.png"
          alt="Carta Revertir Verde"
          width={150}
          height={220}
          className="w-24 sm:w-32 md:w-40 transform -rotate-[16deg] drop-shadow-[0_12px_24px_rgba(34,197,94,0.2)]"
        />
      </div>

      {/* HEADER LOGO */}
      <header className="relative z-10 flex flex-col items-center mt-2 sm:mt-4 mb-3 sm:mb-6">
        <Image
          src="/img/logo.png"
          alt="ACM Computer Society"
          width={360}
          height={120}
          priority
          className="h-auto w-56 sm:w-64 md:w-72 object-contain drop-shadow-[0_0_20px_rgba(0,100,255,0.4)] hover:brightness-110 transition-all select-none"
        />
      </header>

      {/* ============================================================ */}
      {/* MODAL / OVERLAY: SI EL JUGADOR ENTRA POR LINK O QR           */}
      {/* ============================================================ */}
      {promptName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="cyber-card w-full max-w-sm rounded-3xl p-6 sm:p-8 relative border-2 border-[#1e3459] shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#0084ff]/20 border border-[#0084ff]/40 flex items-center justify-center mx-auto mb-4 text-[#00b4d8]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-white mb-1">
              Unirse a la Sala
            </h3>
            <p className="text-xs text-neutral-400 mb-4">
              Has ingresado para unirte a la partida con PIN{' '}
              <strong className="text-cyan-400 font-mono">{pin}</strong>.
            </p>

            <form onSubmit={handleJoinDirect} className="space-y-4">
              <input
                type="text"
                placeholder="Elige tu apodo..."
                value={guestNameInput}
                maxLength={16}
                onChange={(e) => setGuestNameInput(e.target.value)}
                disabled={joiningGuest}
                autoFocus
                className="w-full bg-[#070c17] border-2 border-[#182845] rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white placeholder-neutral-500 focus:border-[#00b4d8] focus:outline-none transition-all"
              />

              {joinError && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 py-1.5 px-3 rounded-lg">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={joiningGuest}
                className="w-full py-3 px-4 btn-retro-blue text-white font-bold rounded-2xl text-sm tracking-wide cursor-pointer shadow-lg shadow-blue-950/40"
              >
                {joiningGuest ? 'Entrando al Lobby...' : '→ Entrar a la Sala'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MENSAJE DE EXPULSIÓN DE SALA (KICKED)                        */}
      {/* ============================================================ */}
      {isKicked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="cyber-card w-full max-w-sm rounded-3xl p-6 border-2 border-red-800 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-950/70 border border-red-700 flex items-center justify-center mx-auto text-red-400 text-2xl">
              ⚠️
            </div>
            <h3 className="text-xl font-bold text-red-400">
              Expulsado de la Sala
            </h3>
            <p className="text-xs text-neutral-300">
              {kickReason || 'El anfitrión de la sala te ha expulsado de la partida.'}
            </p>
            <Link
              href="/"
              className="inline-block w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors"
            >
              Volver al Inicio
            </Link>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TARJETA CENTRAL DE LA SALA / LOBBY                           */}
      {/* ============================================================ */}
      <div className="relative z-10 w-full max-w-xl my-auto">
        <div className="cyber-card rounded-3xl p-5 sm:p-7 relative overflow-hidden">
          {/* Barra superior con navegación y estado del servidor */}
          <div className="flex items-center justify-between pb-4 border-b border-[#16243d]">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Salir al inicio</span>
            </Link>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#070c17] border border-[#182845] text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-[#00e5ff] animate-pulse shadow-[0_0_8px_#00e5ff]' : 'bg-red-500'
                }`}
              />
              <span className={isConnected ? 'text-cyan-400 font-bold tracking-wider' : 'text-red-400'}>
                {isConnected ? 'ONLINE' : 'DESCONECTADO'}
              </span>
            </div>
          </div>

          {/* Sección del PIN y botones de compartir / QR */}
          <div className="text-center py-5">
            <span className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold mb-2 block">
              PIN DE LA SALA
            </span>

            {/* 4 Casillas grandes con el PIN generado */}
            <div className="flex justify-center items-center gap-2 sm:gap-3 my-2">
              {pin.split('').map((char, index) => (
                <div
                  key={index}
                  className="pin-digit-box w-12 h-14 sm:w-16 sm:h-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl font-black text-cyan-400 shadow-[0_0_15px_rgba(0,180,216,0.15)]"
                >
                  {char}
                </div>
              ))}
            </div>

            {/* Barra de acciones para compartir */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              {/* Botón copiar PIN */}
              <button
                onClick={copyPin}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#09101d] border border-[#1d3356] hover:border-[#00b4d8] hover:bg-[#0c1628] text-neutral-200 text-xs font-bold transition-all cursor-pointer"
              >
                {copiedPin ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-emerald-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copiar PIN</span>
                  </>
                )}
              </button>

              {/* Botón copiar enlace directo */}
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#09101d] border border-[#1d3356] hover:border-[#00b4d8] hover:bg-[#0c1628] text-neutral-200 text-xs font-bold transition-all cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-emerald-400">¡Enlace Copiado!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span>Compartir Enlace</span>
                  </>
                )}
              </button>

              {/* Botón Código QR */}
              <button
                onClick={() => setIsQrOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#09101d] border border-[#1d3356] hover:border-[#00b4d8] hover:bg-[#0c1628] text-neutral-200 text-xs font-bold transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-[#00b4d8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="3" height="3" />
                  <rect x="18" y="18" width="3" height="3" />
                </svg>
                <span>Ver QR</span>
              </button>
            </div>
          </div>

          {/* ============================================================ */}
          {/* PANEL DE OPCIONES DE LA PARTIDA (CONFIGURABLE POR HOST)      */}
          {/* ============================================================ */}
          <div className="py-3 px-4 bg-[#070c17] border border-[#16253e] rounded-2xl my-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                Ajustes de Partida {isHost ? '(Eres Anfitrión)' : ''}
              </span>
              <span className="text-[11px] text-cyan-400 font-mono">
                {roomState?.settings?.turnTimeLimit === 0
                  ? 'Sin límite'
                  : `${roomState?.settings?.turnTimeLimit ?? 30}s / turno`}
              </span>
            </div>

            {isHost ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-neutral-400 mr-1">Tiempo:</span>
                {[15, 30, 45, 0].map((seconds) => (
                  <button
                    key={seconds}
                    onClick={() => updateSettings({ turnTimeLimit: seconds })}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      roomState?.settings?.turnTimeLimit === seconds
                        ? 'bg-[#0084ff] text-white shadow-sm'
                        : 'bg-[#09101d] text-neutral-400 hover:text-white border border-[#182845]'
                    }`}
                  >
                    {seconds === 0 ? '∞' : `${seconds}s`}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-neutral-500">
                El anfitrión controla el tiempo por turno y los ajustes de la partida.
              </p>
            )}
          </div>

          {error && (
            <div className="mb-3 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 text-xs text-center font-medium">
              {error}
            </div>
          )}

          {/* ============================================================ */}
          {/* LISTA DE JUGADORES EN EL LOBBY                               */}
          {/* ============================================================ */}
          <div className="pt-4 border-t border-[#16243d]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                Jugadores en la Sala
              </h3>
              <span className="text-[11px] px-2.5 py-0.5 bg-[#070c17] text-cyan-400 border border-[#182845] rounded-full font-bold">
                {roomState?.players.length ?? (currentPlayer ? 1 : 0)} / {roomState?.settings?.maxPlayers ?? 8}
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {(roomState?.players || (currentPlayer ? [currentPlayer] : [])).map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 bg-[#070c17] border border-[#182845] rounded-xl hover:border-[#1e3459] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-600 to-[#f59e0b] flex items-center justify-center font-black text-xs text-neutral-950 shadow-sm">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white tracking-wide">
                          {player.name}
                        </span>
                        {player.isHost && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30">
                            👑 Host
                          </span>
                        )}
                        {player.id === currentPlayer?.id && (
                          <span className="text-[11px] text-neutral-400 font-medium">
                            (Tú)
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-500">
                        {player.isConnected ? 'En línea' : 'Desconectado'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Botón expulsar jugador (solo visible para el host, y no sobre sí mismo) */}
                    {isHost && player.id !== currentPlayer?.id && (
                      <button
                        onClick={() => kickPlayer(player.id)}
                        className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800 text-[10px] font-bold text-red-300 hover:text-white transition-all cursor-pointer"
                        title="Expulsar de la sala"
                      >
                        Expulsar
                      </button>
                    )}

                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        player.isConnected
                          ? 'bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]'
                          : 'bg-neutral-600'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ============================================================ */}
          {/* ACCIÓN PRINCIPAL: INICIAR PARTIDA                            */}
          {/* ============================================================ */}
          <div className="mt-5 pt-4 border-t border-[#16243d]">
            {isHost ? (
              <button
                onClick={startGame}
                disabled={(roomState?.players.length ?? 0) < 2}
                className="w-full py-3.5 px-4 btn-retro-red text-white font-bold rounded-2xl text-base tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-950/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                {(roomState?.players.length ?? 0) < 2 ? (
                  <span>Esperando mínimo 2 jugadores...</span>
                ) : (
                  <span>🚀 Iniciar Partida</span>
                )}
              </button>
            ) : (
              <div className="p-3 bg-[#070c17] border border-[#16253e] rounded-xl text-center text-xs text-neutral-400">
                <span>Esperando a que el anfitrión inicie la partida...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="relative z-10 text-[11px] text-neutral-500 text-center mt-4">
        <span>Capítulo Javeriano ACM • UNO Multiplayer Web</span>
      </footer>

      {/* Modal con el código QR y enlace */}
      <QrModal
        pin={pin}
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
      />
    </main>
  );
}

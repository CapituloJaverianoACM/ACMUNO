'use client';

import Image from 'next/image';
import { UnoCard } from './UnoCard';
import type { Player, PlayerGameState, Card, CardColor } from '@/types/room';

interface GameBoardProps {
  gameState: PlayerGameState;
  currentPlayer: Player | null;
  isConnected: boolean;
  error?: string | null;
  onPlayCard: (cardId: string) => void;
  onDrawCard: () => void;
  onRestartGame: () => void;
  onExit: () => void;
}

export function GameBoard({
  gameState,
  currentPlayer,
  isConnected,
  error,
  onPlayCard,
  onDrawCard,
  onRestartGame,
  onExit,
}: GameBoardProps) {
  const isMyTurn = gameState.currentTurnPlayerId === currentPlayer?.id;
  const isHost = currentPlayer?.isHost;

  const currentTurnOpponent = gameState.opponents.find(
    (o) => o.id === gameState.currentTurnPlayerId
  );
  const currentTurnName = isMyTurn
    ? 'TÚ'
    : currentTurnOpponent?.name || 'Otro jugador';

  // Configuración de colores activos
  const colorMap: Record<
    CardColor,
    { label: string; bg: string; text: string; border: string; glow: string }
  > = {
    red: {
      label: 'Rojo',
      bg: 'bg-[#e52837]',
      text: 'text-red-400',
      border: 'border-red-500',
      glow: 'rgba(229, 40, 55, 0.4)',
    },
    blue: {
      label: 'Azul',
      bg: 'bg-[#0084ff]',
      text: 'text-blue-400',
      border: 'border-blue-500',
      glow: 'rgba(0, 132, 255, 0.4)',
    },
    green: {
      label: 'Verde',
      bg: 'bg-[#22c55e]',
      text: 'text-green-400',
      border: 'border-green-500',
      glow: 'rgba(34, 197, 94, 0.4)',
    },
    yellow: {
      label: 'Amarillo',
      bg: 'bg-[#f59e0b]',
      text: 'text-yellow-400',
      border: 'border-yellow-500',
      glow: 'rgba(245, 158, 11, 0.4)',
    },
    wild: {
      label: 'Comodín',
      bg: 'bg-purple-600',
      text: 'text-purple-400',
      border: 'border-purple-500',
      glow: 'rgba(147, 51, 234, 0.4)',
    },
  };

  const activeColorInfo = colorMap[gameState.currentColor] || colorMap.red;

  /**
   * Determina si una carta en la mano del cliente es jugable en este momento.
   */
  const canPlay = (card: Card) => {
    if (!isMyTurn || gameState.winner) return false;
    if (card.color === gameState.currentColor) return true;
    if (
      card.type === 'number' &&
      gameState.topCard.type === 'number' &&
      card.value === gameState.topCard.value
    ) {
      return true;
    }
    if (card.type !== 'number' && card.type === gameState.topCard.type) {
      return true;
    }
    return false;
  };

  const hasPlayableCard = gameState.myHand.some(canPlay);

  return (
    <div className="w-full max-w-5xl flex flex-col justify-between min-h-[92vh] py-2 sm:py-4 px-2 sm:px-6 relative select-none">
      {/* ============================================================ */}
      {/* BARRA SUPERIOR: ESTADO GENERAL DEL JUEGO                     */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-[#0b1120]/90 border border-[#16243d] backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-1.5 rounded-lg bg-[#070c17] border border-[#1d3356] hover:bg-[#0c1628] text-neutral-400 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1.5"
            title="Salir de la partida"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span className="hidden sm:inline">Salir</span>
          </button>

          <div className="flex items-center gap-2">
            <Image
              src="/img/logo.png"
              alt="ACM"
              width={100}
              height={32}
              className="h-6 w-auto object-contain hidden sm:block"
            />
            <span className="px-2.5 py-1 rounded-lg bg-[#070c17] border border-[#182845] font-mono font-bold text-xs text-cyan-400">
              PIN: {gameState.pin}
            </span>
          </div>
        </div>

        {/* Indicador central del turno actual */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div
            className={`px-4 py-1.5 rounded-xl border flex items-center gap-2 transition-all ${
              isMyTurn
                ? 'bg-emerald-950/80 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse'
                : 'bg-[#070c17] border-[#182845]'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isMyTurn ? 'bg-emerald-400' : 'bg-yellow-400 animate-pulse'
              }`}
            />
            <span className="text-xs sm:text-sm font-bold tracking-wide text-white">
              {isMyTurn ? '🔥 ¡ES TU TURNO!' : `TURNO DE: ${currentTurnName}`}
            </span>
          </div>

          {/* Color actual y dirección */}
          <div className="flex items-center gap-2 bg-[#070c17] border border-[#182845] px-3 py-1.5 rounded-xl text-xs">
            <span
              className={`w-3 h-3 rounded-full ${activeColorInfo.bg} shadow-sm`}
            />
            <span
              className={`font-bold hidden sm:inline ${activeColorInfo.text}`}
            >
              {activeColorInfo.label}
            </span>
            <span
              className="text-neutral-500 font-mono text-base"
              title={`Sentido ${
                gameState.direction === 'CLOCKWISE' ? 'horario' : 'antihorario'
              }`}
            >
              {gameState.direction === 'CLOCKWISE' ? '↻' : '↺'}
            </span>
          </div>
        </div>

        {/* Estado del WebSocket */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#070c17] border border-[#182845] text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? 'bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]'
                : 'bg-red-500'
            }`}
          />
          <span className="text-[11px] text-cyan-400 font-bold hidden md:inline">
            EN VIVO
          </span>
        </div>
      </div>

      {/* Banner de última acción del juego */}
      {gameState.lastActionMessage && (
        <div className="mt-2 text-center">
          <span className="inline-block px-4 py-1 rounded-full bg-[#070c17]/90 border border-[#182845] text-xs text-neutral-300 font-medium tracking-wide animate-fade-in shadow-md">
            {gameState.lastActionMessage}
          </span>
        </div>
      )}

      {/* Alerta de error si el jugador intentó jugada inválida */}
      {error && (
        <div className="mt-2 text-center">
          <span className="inline-block px-4 py-1 rounded-full bg-red-950/80 border border-red-800 text-xs text-red-300 font-bold tracking-wide animate-shake">
            ⚠️ {error}
          </span>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECCIÓN SUPERIOR: JUGADORES RIVALES                          */}
      {/* ============================================================ */}
      <div className="my-3 flex flex-wrap items-center justify-center gap-3 sm:gap-6">
        {gameState.opponents.map((opponent) => {
          const isOpponentTurn = opponent.id === gameState.currentTurnPlayerId;
          const hasUno = opponent.cardCount === 1;

          return (
            <div
              key={opponent.id}
              className={`relative flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl transition-all duration-300 ${
                isOpponentTurn
                  ? 'bg-[#0c1830] border-2 border-yellow-400/80 shadow-[0_0_20px_rgba(250,204,21,0.25)] scale-105'
                  : 'bg-[#070c17]/80 border border-[#182845]'
              }`}
            >
              {/* Avatar con inicial */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0051b3] to-[#00b4d8] flex items-center justify-center font-black text-sm text-neutral-950 shadow-md">
                {opponent.name.charAt(0).toUpperCase()}
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-white max-w-[100px] truncate">
                    {opponent.name}
                  </span>
                  {opponent.isHost && (
                    <span className="text-[10px] text-yellow-400">👑</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    🂠 {opponent.cardCount} cartas
                  </span>
                  {hasUno && (
                    <span className="px-1.5 py-0.2 rounded bg-red-600 text-white font-black text-[9px] animate-pulse">
                      ¡UNO!
                    </span>
                  )}
                </div>
              </div>

              {/* Indicador de turno activo en el rival */}
              {isOpponentTurn && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-yellow-400 text-neutral-950 font-black text-[9px] uppercase tracking-wider animate-bounce">
                  Turno
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* MESA CENTRAL: MAZO DE ROBO Y PILA DE DESCARTE                */}
      {/* ============================================================ */}
      <div className="relative my-2 sm:my-6 flex items-center justify-center">
        {/* Mesa con resplandor circular */}
        <div className="absolute w-80 sm:w-96 h-48 sm:h-56 rounded-full bg-gradient-to-r from-red-600/10 via-blue-600/10 to-green-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-center gap-6 sm:gap-14 p-6 sm:p-10 rounded-3xl bg-[#091122]/70 border-2 border-[#162744] shadow-2xl backdrop-blur-md">
          {/* Mazo de Robo (Interactivo cuando es tu turno) */}
          <div className="flex flex-col items-center gap-2">
            <div
              onClick={isMyTurn && !gameState.winner ? onDrawCard : undefined}
              className={`relative group ${
                isMyTurn && !gameState.winner
                  ? 'cursor-pointer hover:scale-105 active:scale-95'
                  : 'cursor-default opacity-85'
              }`}
              title={
                isMyTurn
                  ? hasPlayableCard
                    ? 'Haz clic para robar 1 carta (o juega una carta válida de tu mano)'
                    : '¡No tienes carta válida! Haz clic para robar del mazo'
                  : 'Espera tu turno para robar'
              }
            >
              {/* Efecto de pila 3D apilada */}
              <div className="absolute top-2 left-2 w-20 h-28 sm:w-24 sm:h-36 rounded-xl bg-[#060a14] border border-[#16253e] -rotate-3" />
              <div className="absolute top-1 left-1 w-20 h-28 sm:w-24 sm:h-36 rounded-xl bg-[#070c17] border border-[#182845] rotate-2" />

              <UnoCard
                isFaceDown
                size="md"
                className={`relative transition-all duration-200 ${
                  isMyTurn && !hasPlayableCard
                    ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#091122] animate-pulse'
                    : ''
                }`}
              />

              {isMyTurn && !gameState.winner && (
                <div className="absolute -bottom-3 inset-x-0 mx-auto w-max px-2 py-0.5 rounded-full bg-[#0084ff] text-white text-[9px] font-black uppercase tracking-wider shadow-md">
                  Robar
                </div>
              )}
            </div>

            <span className="text-[11px] font-bold text-neutral-400 font-mono mt-2">
              Mazo ({gameState.drawPileCount})
            </span>
          </div>

          {/* Pila de Descarte (Carta superior visible) */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              {/* Resplandor del color de la carta actual */}
              <div
                className="absolute inset-0 rounded-2xl filter blur-xl opacity-50"
                style={{ backgroundColor: activeColorInfo.glow }}
              />
              <UnoCard
                card={gameState.topCard}
                size="md"
                className="relative shadow-2xl"
              />
            </div>
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${activeColorInfo.text}`}
            >
              Descarte ({activeColorInfo.label})
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECCIÓN INFERIOR: MANO DEL JUGADOR ACTUAL                    */}
      {/* ============================================================ */}
      <div className="mt-2 flex flex-col items-center">
        <div className="flex items-center justify-between w-full max-w-4xl px-4 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
              Tu Mano
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#070c17] border border-[#182845] text-cyan-400">
              {gameState.myHand.length} cartas
            </span>
            {gameState.myHand.length === 1 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-red-600 text-white animate-bounce">
                ¡UNO!
              </span>
            )}
          </div>

          <span className="text-[11px] text-neutral-400">
            {isMyTurn
              ? hasPlayableCard
                ? '👆 Haz clic en una carta iluminada para jugarla'
                : '🃏 No tienes jugada válida. Haz clic en el mazo para robar'
              : '⏳ Esperando el turno del rival...'}
          </span>
        </div>

        {/* Abanico interactivo de cartas del jugador */}
        <div className="w-full max-w-4xl overflow-x-auto pb-4 pt-2 px-4 flex justify-center items-center gap-1 sm:gap-2">
          {gameState.myHand.map((card) => {
            const playable = canPlay(card);

            return (
              <div
                key={card.id}
                onClick={() => playable && onPlayCard(card.id)}
                className={`transition-all duration-200 transform ${
                  playable
                    ? '-translate-y-2 hover:-translate-y-6 hover:scale-115 cursor-pointer ring-2 ring-cyan-400/80 rounded-xl shadow-[0_8px_20px_rgba(0,180,216,0.35)]'
                    : isMyTurn
                    ? 'opacity-40 cursor-not-allowed hover:opacity-60'
                    : 'opacity-85 cursor-default'
                }`}
              >
                <UnoCard card={card} size="sm" isPlayable={playable} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL DE VICTORIA / FIN DE PARTIDA                           */}
      {/* ============================================================ */}
      {gameState.winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="cyber-card w-full max-w-md rounded-3xl p-6 sm:p-8 text-center relative border-2 border-yellow-500/80 shadow-[0_0_50px_rgba(234,179,8,0.3)]">
            <div className="text-5xl mb-3 animate-bounce">🏆</div>
            <h2 className="text-2xl sm:text-3xl font-black text-yellow-400 tracking-wider mb-2">
              ¡PARTIDA FINALIZADA!
            </h2>
            <p className="text-base text-white font-bold mb-1">
              {gameState.winner.name} se quedó sin cartas.
            </p>
            <p className="text-xs text-neutral-400 mb-6">
              {gameState.winner.id === currentPlayer?.id
                ? '¡Felicidades, ganaste la partida!'
                : 'Buen intento, ¡suerte para la próxima!'}
            </p>

            <div className="flex flex-col gap-2">
              {isHost && (
                <button
                  onClick={onRestartGame}
                  className="w-full py-3 px-4 btn-retro-red text-white font-bold rounded-2xl text-sm cursor-pointer shadow-lg shadow-red-950/40"
                >
                  🔄 Jugar de Nuevo (Volver al Lobby)
                </button>
              )}
              <button
                onClick={onExit}
                className="w-full py-3 px-4 rounded-2xl bg-[#09101d] border border-[#1d3356] hover:bg-[#0c1628] text-white text-xs font-bold transition-all cursor-pointer"
              >
                Salir al Inicio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

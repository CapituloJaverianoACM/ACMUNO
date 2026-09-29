'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { UnoCard } from './UnoCard';
import type { Player, PlayerGameState, Card, CardColor } from '@/types/room';

interface GameBoardProps {
  gameState: PlayerGameState;
  currentPlayer: Player | null;
  isConnected: boolean;
  error?: string | null;
  onPlayCard: (cardId: string, chosenColor?: CardColor) => void;
  onDrawCard: () => void;
  onSayUno?: () => void;
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
  onSayUno,
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
    // Comodines (+4 y wild) se pueden jugar siempre
    if (card.color === 'wild' || card.type === 'wild4' || card.type === 'wild') {
      return true;
    }
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

  // Estados de vulnerabilidad para la regla de cantar UNO
  const saidUnoList = gameState.saidUnoPlayers || [];
  const myId = currentPlayer?.id || '';
  const myHandCount = gameState.myHand.length;

  const iAmVulnerable = myHandCount === 1 && !saidUnoList.includes(myId);
  const iSaidUno = myHandCount === 1 && saidUnoList.includes(myId);

  const vulnerableOpponent = gameState.opponents.find(
    (o) => o.cardCount === 1 && !saidUnoList.includes(o.id)
  );
  const opponentVulnerable = !!vulnerableOpponent;
  const isUnoActionActive = !gameState.winner && (iAmVulnerable || opponentVulnerable);

  // Reloj de turno en tiempo real
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    if (
      !gameState.turnExpiresAt ||
      gameState.turnTimeLimit <= 0 ||
      gameState.winner
    ) {
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 150);

    return () => clearInterval(interval);
  }, [gameState.turnExpiresAt, gameState.turnTimeLimit, gameState.winner]);

  const timeLeft =
    gameState.turnTimeLimit > 0 && gameState.turnExpiresAt
      ? Math.max(0, Math.ceil((gameState.turnExpiresAt - now) / 1000))
      : 0;

  const timePercentage =
    gameState.turnTimeLimit > 0 && gameState.turnExpiresAt
      ? Math.min(100, Math.max(0, (timeLeft / gameState.turnTimeLimit) * 100))
      : 100;

  // Selección de color para comodines (+4 / wild)
  const [pendingWildCardId, setPendingWildCardId] = useState<string | null>(null);

  const handleCardClick = (card: Card) => {
    if (!canPlay(card)) return;
    if (card.color === 'wild' || card.type === 'wild4' || card.type === 'wild') {
      setPendingWildCardId(card.id);
    } else {
      onPlayCard(card.id);
    }
  };

  const handleSelectColor = (color: CardColor) => {
    if (pendingWildCardId) {
      onPlayCard(pendingWildCardId, color);
      setPendingWildCardId(null);
    }
  };

  return (
    <div className="w-full max-w-5xl flex flex-col justify-between min-h-[92vh] py-2 sm:py-4 px-2 sm:px-6 relative select-none">
      {/* ============================================================ */}
      {/* BARRA SUPERIOR: ESTADO GENERAL DEL JUEGO                     */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-2 p-3 sm:p-4 rounded-2xl bg-[#0b1120]/90 border border-[#16243d] backdrop-blur-md shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
                  ? timeLeft <= 5 && gameState.turnTimeLimit > 0
                    ? 'bg-red-950/90 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse'
                    : 'bg-emerald-950/80 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse'
                  : 'bg-[#070c17] border-[#182845]'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isMyTurn
                    ? timeLeft <= 5 && gameState.turnTimeLimit > 0
                      ? 'bg-red-500 animate-ping'
                      : 'bg-emerald-400'
                    : 'bg-yellow-400 animate-pulse'
                }`}
              />
              <span className="text-xs sm:text-sm font-bold tracking-wide text-white">
                {isMyTurn ? '🔥 ¡ES TU TURNO!' : `TURNO DE: ${currentTurnName}`}
              </span>
            </div>

            {/* Reloj digital de turno */}
            {gameState.turnTimeLimit > 0 && gameState.turnExpiresAt ? (
              <div
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-mono text-xs sm:text-sm font-black transition-all ${
                  timeLeft <= 5
                    ? 'bg-red-950/90 border-red-500 text-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                    : timeLeft <= 10
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    : 'bg-[#070c17] border-[#182845] text-cyan-400'
                }`}
                title="Tiempo restante para este turno"
              >
                <span className={timeLeft <= 5 ? 'animate-bounce' : ''}>⏱️</span>
                <span>{timeLeft}s</span>
              </div>
            ) : (
              <div
                className="px-2.5 py-1.5 rounded-xl bg-[#070c17] border border-[#182845] text-neutral-400 font-mono text-xs hidden sm:flex items-center gap-1"
                title="Turno sin límite de tiempo"
              >
                <span>⏱️</span>
                <span>∞</span>
              </div>
            )}

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

        {/* Barra de progreso de tiempo de turno animada */}
        {gameState.turnTimeLimit > 0 && gameState.turnExpiresAt && !gameState.winner && (
          <div className="w-full bg-[#070c17] rounded-full h-1.5 overflow-hidden border border-[#16253e] mt-1 relative shadow-inner">
            <div
              className={`h-full transition-all duration-150 rounded-full ${
                timeLeft <= 5
                  ? 'bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse'
                  : timeLeft <= 10
                  ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                  : 'bg-cyan-400 shadow-[0_0_8px_#00e5ff]'
              }`}
              style={{ width: `${timePercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Banner de última acción del juego */}
      {gameState.lastActionMessage && (
        <div className="mt-2 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#070c17]/95 border border-[#1d3356] text-xs text-neutral-200 font-semibold tracking-wide animate-fade-in shadow-lg">
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
          const opponentProtected = hasUno && saidUnoList.includes(opponent.id);

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
                    opponentProtected ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-black text-[9px] shadow-[0_0_8px_#10b981]">
                        ¡UNO! ✓
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-black text-[9px] animate-pulse shadow-[0_0_10px_#ef4444]">
                        ¡SIN UNO! ⚠️
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* Indicador de turno activo en el rival */}
              {isOpponentTurn && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-yellow-400 text-neutral-950 font-black text-[9px] uppercase tracking-wider animate-bounce flex items-center gap-1 shadow-md">
                  <span>Turno</span>
                  {gameState.turnTimeLimit > 0 && gameState.turnExpiresAt && (
                    <span className="font-mono bg-neutral-950 text-yellow-400 px-1 rounded">
                      {timeLeft}s
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* MESA CENTRAL: MAZO DE ROBO, BOTÓN UNO Y PILA DE DESCARTE     */}
      {/* ============================================================ */}
      <div className="relative my-2 sm:my-6 flex items-center justify-center">
        {/* Mesa con resplandor circular */}
        <div className="absolute w-80 sm:w-96 h-48 sm:h-56 rounded-full bg-gradient-to-r from-red-600/10 via-blue-600/10 to-green-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-center gap-4 sm:gap-10 p-5 sm:p-8 rounded-3xl bg-[#091122]/70 border-2 border-[#162744] shadow-2xl backdrop-blur-md">
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

          {/* BOTÓN CENTRAL: ¡CANTAR UNO! / ¡DENUNCIAR UNO! */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={isUnoActionActive ? onSayUno : undefined}
              disabled={!isUnoActionActive}
              title={
                iAmVulnerable
                  ? '¡Haz clic para cantar UNO y protegerte antes de que te descubran!'
                  : opponentVulnerable
                  ? `¡Haz clic para denunciar a ${vulnerableOpponent?.name}! Le tocarán 2 cartas.`
                  : 'Botón de UNO (Se activa cuando alguien tiene 1 sola carta)'
              }
              className={`relative flex flex-col items-center justify-center w-20 h-28 sm:w-24 sm:h-36 rounded-2xl border-2 transition-all duration-300 select-none ${
                iAmVulnerable
                  ? 'bg-gradient-to-b from-red-600 via-rose-500 to-red-700 border-yellow-300 shadow-[0_0_35px_rgba(239,68,68,0.9)] scale-105 animate-pulse cursor-pointer'
                  : opponentVulnerable
                  ? 'bg-gradient-to-b from-amber-600 via-orange-500 to-red-600 border-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.9)] scale-105 animate-bounce cursor-pointer'
                  : 'bg-[#060b17] border-[#182845] opacity-35 cursor-not-allowed'
              }`}
            >
              <span className="text-2xl sm:text-3xl">
                {iAmVulnerable ? '🔥' : opponentVulnerable ? '🚨' : '🂠'}
              </span>
              <span
                className={`font-black text-xs sm:text-sm tracking-wider uppercase mt-1 ${
                  iAmVulnerable || opponentVulnerable
                    ? 'text-white drop-shadow'
                    : 'text-neutral-500'
                }`}
              >
                ¡UNO!
              </span>
              <span className="text-[8px] sm:text-[9px] font-bold text-center px-1 leading-tight text-white/90">
                {iAmVulnerable
                  ? '¡CÁNTALO!'
                  : opponentVulnerable
                  ? '¡DENUNCIA!'
                  : 'ESPERA'}
              </span>
            </button>

            <span
              className={`text-[10px] font-bold uppercase tracking-wider font-mono ${
                iAmVulnerable
                  ? 'text-red-400 animate-pulse'
                  : opponentVulnerable
                  ? 'text-amber-400 animate-pulse'
                  : 'text-neutral-500'
              }`}
            >
              {iAmVulnerable
                ? '¡PROTÉGETE!'
                : opponentVulnerable
                ? '+2 AL RIVAL'
                : 'REGLA UNO'}
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
              {myHandCount} cartas
            </span>
            {myHandCount === 1 && (
              iSaidUno ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white shadow-[0_0_10px_#10b981]">
                  ¡UNO PROTEGIDO! ✓
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-red-600 text-white animate-bounce shadow-[0_0_12px_#ef4444]">
                  ¡CANTA UNO YA! ⚠️
                </span>
              )
            )}
          </div>

          <span
            className={`text-[11px] font-bold ${
              isMyTurn && timeLeft <= 5 && gameState.turnTimeLimit > 0
                ? 'text-red-400 animate-pulse'
                : 'text-neutral-400'
            }`}
          >
            {isMyTurn
              ? timeLeft <= 5 && gameState.turnTimeLimit > 0
                ? `🚨 ¡Te quedan ${timeLeft}s! Juega o robarás carta automáticamente`
                : hasPlayableCard
                ? '👆 Haz clic en una carta iluminada para jugarla'
                : '🃏 No tienes jugada válida. Haz clic en el mazo para robar'
              : `⏳ Esperando a ${currentTurnName}... ${
                  gameState.turnTimeLimit > 0 && gameState.turnExpiresAt
                    ? `(${timeLeft}s)`
                    : ''
                }`}
          </span>
        </div>

        {/* Abanico interactivo de cartas del jugador */}
        <div className="w-full max-w-4xl overflow-x-auto pb-4 pt-2 px-4 flex justify-center items-center gap-1 sm:gap-2">
          {gameState.myHand.map((card) => {
            const playable = canPlay(card);

            return (
              <div
                key={card.id}
                onClick={() => playable && handleCardClick(card)}
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
      {/* MODAL DE SELECCIÓN DE COLOR PARA COMODÍN +4                  */}
      {/* ============================================================ */}
      {pendingWildCardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="cyber-card w-full max-w-sm rounded-3xl p-6 sm:p-7 text-center relative border-2 border-cyan-500/80 shadow-[0_0_50px_rgba(0,180,216,0.35)]">
            <div className="text-3xl mb-2 animate-bounce">🎨</div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-wider mb-1">
              ELIGE EL COLOR
            </h3>
            <p className="text-xs text-neutral-400 mb-6">
              Selecciona el color que continuará la partida con tu Comodín +4.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => handleSelectColor('red')}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-sm uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shadow-red-950/40 cursor-pointer border border-red-400/40 flex items-center justify-center gap-1.5"
              >
                <span>🔴</span>
                <span>Rojo</span>
              </button>
              <button
                onClick={() => handleSelectColor('blue')}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black text-sm uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-950/40 cursor-pointer border border-blue-400/40 flex items-center justify-center gap-1.5"
              >
                <span>🔵</span>
                <span>Azul</span>
              </button>
              <button
                onClick={() => handleSelectColor('green')}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black text-sm uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shadow-green-950/40 cursor-pointer border border-green-400/40 flex items-center justify-center gap-1.5"
              >
                <span>🟢</span>
                <span>Verde</span>
              </button>
              <button
                onClick={() => handleSelectColor('yellow')}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950 font-black text-sm uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-950/40 cursor-pointer border border-yellow-400/40 flex items-center justify-center gap-1.5"
              >
                <span>🟡</span>
                <span>Amarillo</span>
              </button>
            </div>

            <button
              onClick={() => setPendingWildCardId(null)}
              className="w-full py-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar jugada
            </button>
          </div>
        </div>
      )}

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

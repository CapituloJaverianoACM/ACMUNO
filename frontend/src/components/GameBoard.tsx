'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { UnoCard } from './UnoCard';
import type { Player, PlayerGameState, Card, CardColor, OpponentState } from '@/types/room';

// Helper determinista para rotación de cartas sobre la mesa (-5° a +5°)
function getCardRotation(cardId: string): number {
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = (hash << 5) - hash + cardId.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 11) - 5;
}

// Distribuye los rivales de manera equilibrada alrededor de la mesa (Flanco Izquierdo, Frente/Arriba, Flanco Derecho)
function distributeOpponentsAroundTable<T>(opponents: T[]): {
  left: T[];
  top: T[];
  right: T[];
} {
  const n = opponents.length;
  if (n === 0) return { left: [], top: [], right: [] };
  if (n === 1) return { left: [], top: [opponents[0]], right: [] };
  if (n === 2) return { left: [opponents[0]], top: [], right: [opponents[1]] };
  if (n === 3) return { left: [opponents[0]], top: [opponents[1]], right: [opponents[2]] };
  if (n === 4) return { left: [opponents[0]], top: [opponents[1], opponents[2]], right: [opponents[3]] };
  if (n === 5) return { left: [opponents[0], opponents[1]], top: [opponents[2]], right: [opponents[3], opponents[4]] };
  if (n === 6) return { left: [opponents[0], opponents[1]], top: [opponents[2], opponents[3]], right: [opponents[4], opponents[5]] };
  if (n === 7) return { left: [opponents[0], opponents[1]], top: [opponents[2], opponents[3], opponents[4]], right: [opponents[5], opponents[6]] };
  if (n === 8) return { left: [opponents[0], opponents[1], opponents[2]], top: [opponents[3], opponents[4]], right: [opponents[5], opponents[6], opponents[7]] };
  if (n === 9) return { left: [opponents[0], opponents[1], opponents[2]], top: [opponents[3], opponents[4], opponents[5]], right: [opponents[6], opponents[7], opponents[8]] };

  const sideCount = Math.floor(n / 3);
  return {
    left: opponents.slice(0, sideCount),
    top: opponents.slice(sideCount, n - sideCount),
    right: opponents.slice(n - sideCount),
  };
}

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

  // Referencias físicas del DOM para calcular trayectorias reales en pantalla
  const deckPileRef = useRef<HTMLDivElement>(null);
  const discardPileRef = useRef<HTMLDivElement>(null);
  const handContainerRef = useRef<HTMLDivElement>(null);

  // Estados para animaciones dinámicas de cartas
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);
  const [isDeckSpring, setIsDeckSpring] = useState(false);
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());
  const prevHandIdsRef = useRef<Set<string>>(
    new Set(gameState.myHand.map((c) => c.id))
  );

  // Carta en vuelo físico al jugar (sin clipping por overflow, trayectoria real)
  const [flyingPlayCard, setFlyingPlayCard] = useState<{
    card: Card;
    startX: number;
    startY: number;
    width: number;
    height: number;
    deltaX: number;
    deltaY: number;
    targetRotation: number;
    isTarget: boolean;
  } | null>(null);

  // Carta en vuelo físico al robar (viaja del mazo a la mano)
  const [flyingDrawCard, setFlyingDrawCard] = useState<{
    startX: number;
    startY: number;
    width: number;
    height: number;
    deltaX: number;
    deltaY: number;
    isTarget: boolean;
  } | null>(null);

  // Pila de descarte con profundidad 3D y slam
  const [discardHistory, setDiscardHistory] = useState<Card[]>([]);
  const prevTopCardRef = useRef<Card | null>(null);

  // Oponentes robando cartas (+1, +2, +4)
  const [opponentPops, setOpponentPops] = useState<Record<string, string>>({});
  const prevOpponentsRef = useRef<Map<string, number>>(
    new Map(gameState.opponents.map((o) => [o.id, o.cardCount]))
  );

  // Animación al revertir sentido
  const [isDirectionSpinning, setIsDirectionSpinning] = useState(false);
  const prevDirectionRef = useRef(gameState.direction);

  // Resplandor expansivo al cambiar de color (comodín)
  const [isColorChanging, setIsColorChanging] = useState(false);
  const prevColorRef = useRef(gameState.currentColor);

  // Detectar cambio de carta superior y poblar historial para profundidad 3D
  useEffect(() => {
    if (!prevTopCardRef.current) {
      prevTopCardRef.current = gameState.topCard;
      return;
    }
    if (prevTopCardRef.current.id !== gameState.topCard.id) {
      setDiscardHistory((prev) => [
        prevTopCardRef.current!,
        ...prev.slice(0, 1),
      ]);
      prevTopCardRef.current = gameState.topCard;
    }
  }, [gameState.topCard]);

  // Detectar cartas nuevas en la mano para animación de entrada
  useEffect(() => {
    const currentIds = new Set(gameState.myHand.map((c) => c.id));
    const newlyAdded: string[] = [];

    for (const card of gameState.myHand) {
      if (!prevHandIdsRef.current.has(card.id)) {
        newlyAdded.push(card.id);
      }
    }

    if (newlyAdded.length > 0) {
      setNewCardIds(new Set(newlyAdded));
      const timer = setTimeout(() => {
        setNewCardIds(new Set());
      }, 1200);
      prevHandIdsRef.current = currentIds;
      return () => clearTimeout(timer);
    } else {
      prevHandIdsRef.current = currentIds;
    }
  }, [gameState.myHand]);

  // Detectar robo de cartas de oponentes
  useEffect(() => {
    const newPops: Record<string, string> = {};
    let hasNewPops = false;
    let targetOpponentId: string | null = null;

    gameState.opponents.forEach((opp) => {
      const prevCount = prevOpponentsRef.current.get(opp.id);
      if (prevCount !== undefined && opp.cardCount > prevCount) {
        const diff = opp.cardCount - prevCount;
        newPops[opp.id] = `+${diff} 🂠`;
        hasNewPops = true;
        targetOpponentId = opp.id;
      }
      prevOpponentsRef.current.set(opp.id, opp.cardCount);
    });

    if (hasNewPops) {
      setOpponentPops((prev) => ({ ...prev, ...newPops }));
      setIsDeckSpring(true);
      setTimeout(() => setIsDeckSpring(false), 300);

      if (targetOpponentId && deckPileRef.current) {
        const oppEl = document.getElementById(`opponent-badge-${targetOpponentId}`);
        const deckEl = deckPileRef.current;
        if (oppEl && deckEl) {
          const deckRect = deckEl.getBoundingClientRect();
          const oppRect = oppEl.getBoundingClientRect();
          const deltaX =
            oppRect.left + oppRect.width / 2 - deckRect.left - deckRect.width / 2;
          const deltaY =
            oppRect.top + oppRect.height / 2 - deckRect.top - deckRect.height / 2;

          setFlyingDrawCard({
            startX: deckRect.left,
            startY: deckRect.top,
            width: deckRect.width,
            height: deckRect.height,
            deltaX,
            deltaY,
            isTarget: false,
          });

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setFlyingDrawCard((prev) =>
                prev ? { ...prev, isTarget: true } : null
              );
            });
          });

          setTimeout(() => {
            setFlyingDrawCard(null);
          }, 360);
        }
      }

      const timer = setTimeout(() => {
        setOpponentPops({});
      }, 1300);
      return () => clearTimeout(timer);
    }
  }, [gameState.opponents]);

  // Detectar giro al revertir sentido
  useEffect(() => {
    if (prevDirectionRef.current !== gameState.direction) {
      setIsDirectionSpinning(true);
      prevDirectionRef.current = gameState.direction;
      const timer = setTimeout(() => setIsDirectionSpinning(false), 700);
      return () => clearTimeout(timer);
    }
  }, [gameState.direction]);

  // Detectar cambio de color
  useEffect(() => {
    if (prevColorRef.current !== gameState.currentColor) {
      setIsColorChanging(true);
      prevColorRef.current = gameState.currentColor;
      const timer = setTimeout(() => setIsColorChanging(false), 600);
      return () => clearTimeout(timer);
    }
  }, [gameState.currentColor]);

  // Manejo de robo propio con animación física real desde el mazo hacia la mano
  const handleLocalDraw = () => {
    if (!isMyTurn || gameState.winner || flyingDrawCard) return;

    setIsDeckSpring(true);
    setTimeout(() => setIsDeckSpring(false), 300);

    const deckEl = deckPileRef.current;
    const handEl = handContainerRef.current;

    if (deckEl && handEl) {
      const deckRect = deckEl.getBoundingClientRect();
      const handRect = handEl.getBoundingClientRect();

      // Destino: hacia el centro de la mano del jugador
      const targetX = handRect.left + handRect.width / 2 - deckRect.width / 2;
      const targetY = handRect.bottom - deckRect.height - 10;

      const deltaX = targetX - deckRect.left;
      const deltaY = targetY - deckRect.top;

      setFlyingDrawCard({
        startX: deckRect.left,
        startY: deckRect.top,
        width: deckRect.width,
        height: deckRect.height,
        deltaX,
        deltaY,
        isTarget: false,
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFlyingDrawCard((prev) => (prev ? { ...prev, isTarget: true } : null));
        });
      });

      setTimeout(() => {
        onDrawCard();
        setFlyingDrawCard(null);
      }, 340);
    } else {
      onDrawCard();
    }
  };

  // Manejo de jugar carta con animación física real desde la mano hacia el descarte
  const handleCardClick = (card: Card, e?: React.MouseEvent<HTMLElement>) => {
    if (!canPlay(card) || flyingPlayCard) return;

    if (card.color === 'wild' || card.type === 'wild4' || card.type === 'wild') {
      setPendingWildCardId(card.id);
      return;
    }

    const cardEl = e?.currentTarget || document.getElementById(`hand-card-${card.id}`);
    const discardEl = discardPileRef.current;

    if (cardEl && discardEl) {
      const cardRect = cardEl.getBoundingClientRect();
      const discardRect = discardEl.getBoundingClientRect();

      const deltaX =
        discardRect.left + (discardRect.width - cardRect.width) / 2 - cardRect.left;
      const deltaY =
        discardRect.top + (discardRect.height - cardRect.height) / 2 - cardRect.top;
      const targetRotation = getCardRotation(card.id);

      setPlayingCardId(card.id);
      setFlyingPlayCard({
        card,
        startX: cardRect.left,
        startY: cardRect.top,
        width: cardRect.width,
        height: cardRect.height,
        deltaX,
        deltaY,
        targetRotation,
        isTarget: false,
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFlyingPlayCard((prev) => (prev ? { ...prev, isTarget: true } : null));
        });
      });

      setTimeout(() => {
        onPlayCard(card.id);
        setFlyingPlayCard(null);
        setPlayingCardId(null);
      }, 340);
    } else {
      onPlayCard(card.id);
    }
  };

  const handleSelectColor = (color: CardColor) => {
    if (pendingWildCardId) {
      const targetId = pendingWildCardId;
      setPendingWildCardId(null);

      const card = gameState.myHand.find((c) => c.id === targetId);
      const cardEl = document.getElementById(`hand-card-${targetId}`);
      const discardEl = discardPileRef.current;

      if (card && cardEl && discardEl) {
        const cardRect = cardEl.getBoundingClientRect();
        const discardRect = discardEl.getBoundingClientRect();

        const deltaX =
          discardRect.left + (discardRect.width - cardRect.width) / 2 - cardRect.left;
        const deltaY =
          discardRect.top + (discardRect.height - cardRect.height) / 2 - cardRect.top;
        const targetRotation = getCardRotation(targetId);

        setPlayingCardId(targetId);
        setFlyingPlayCard({
          card,
          startX: cardRect.left,
          startY: cardRect.top,
          width: cardRect.width,
          height: cardRect.height,
          deltaX,
          deltaY,
          targetRotation,
          isTarget: false,
        });

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setFlyingPlayCard((prev) => (prev ? { ...prev, isTarget: true } : null));
          });
        });

        setTimeout(() => {
          onPlayCard(targetId, color);
          setFlyingPlayCard(null);
          setPlayingCardId(null);
        }, 340);
      } else {
        onPlayCard(targetId, color);
      }
    }
  };

  const tableSeats = distributeOpponentsAroundTable(gameState.opponents);

  const renderOpponentSeat = (
    opponent: OpponentState,
    position: 'top' | 'left' | 'right'
  ) => {
    const isOpponentTurn = opponent.id === gameState.currentTurnPlayerId;
    const hasUno = opponent.cardCount === 1;
    const opponentProtected = hasUno && saidUnoList.includes(opponent.id);
    const isFlank = position === 'left' || position === 'right';

    return (
      <div
        id={`opponent-badge-${opponent.id}`}
        key={opponent.id}
        className={`relative flex ${
          isFlank ? 'flex-col sm:flex-row' : 'flex-row'
        } items-center gap-2 sm:gap-2.5 p-2 sm:p-2.5 rounded-2xl transition-all duration-300 ${
          isOpponentTurn
            ? 'bg-[#0c1830] border-2 border-yellow-400 shadow-[0_0_24px_rgba(250,204,21,0.35)] scale-105 sm:scale-110 z-20'
            : 'bg-[#070c17]/90 border border-[#182845] hover:border-[#223960] shadow-md'
        } backdrop-blur-md`}
      >
        {/* Indicador flotante cuando el rival roba cartas */}
        {opponentPops[opponent.id] && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-badge-pop whitespace-nowrap">
            <span className="px-2.5 py-0.5 rounded-full bg-red-600 border border-red-300 text-white font-black text-xs shadow-[0_0_12px_#ef4444]">
              {opponentPops[opponent.id]}
            </span>
          </div>
        )}

        {/* Avatar con inicial y corona */}
        <div className="relative">
          <div
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-[#0051b3] to-[#00b4d8] flex items-center justify-center font-black text-sm sm:text-base text-neutral-950 shadow-md ${
              isOpponentTurn ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#070c17]' : ''
            }`}
          >
            {opponent.name.charAt(0).toUpperCase()}
          </div>
          {opponent.isHost && (
            <span
              className="absolute -top-2 -left-1 text-xs sm:text-sm drop-shadow"
              title="Anfitrión de la sala"
            >
              👑
            </span>
          )}
          {/* Indicador de conexión */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#070c17] ${
              opponent.isConnected ? 'bg-emerald-400' : 'bg-red-500'
            }`}
            title={opponent.isConnected ? 'Conectado' : 'Desconectado'}
          />
        </div>

        {/* Información del Rival */}
        <div
          className={`flex flex-col ${
            isFlank
              ? 'items-center sm:items-start text-center sm:text-left'
              : 'items-start text-left'
          }`}
        >
          <span
            className="text-xs sm:text-sm font-bold text-white max-w-[70px] sm:max-w-[110px] truncate"
            title={opponent.name}
          >
            {opponent.name}
          </span>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] sm:text-xs font-mono font-bold text-cyan-400 flex items-center gap-0.5">
              <span>🂠</span>
              <span>{opponent.cardCount}</span>
              <span className="hidden sm:inline">cartas</span>
            </span>

            {hasUno && (
              opponentProtected ? (
                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-black text-[9px] shadow-[0_0_8px_#10b981] whitespace-nowrap">
                  ¡UNO! ✓
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-black text-[9px] animate-pulse shadow-[0_0_10px_#ef4444] whitespace-nowrap">
                  ¡SIN UNO! ⚠️
                </span>
              )
            )}
          </div>
        </div>

        {/* Indicador de turno activo en el rival */}
        {isOpponentTurn && (
          <div className="absolute -top-2.5 -right-2 px-2 py-0.5 rounded-full bg-yellow-400 text-neutral-950 font-black text-[9px] uppercase tracking-wider animate-bounce flex items-center gap-1 shadow-md z-10">
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
                className={`font-mono text-base inline-block transition-transform duration-300 ${
                  isDirectionSpinning
                    ? 'animate-reverse-spin text-cyan-300'
                    : 'text-neutral-500'
                }`}
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
      {/* MESA DE JUEGO OVALADA: RIVALES ALREDEDOR Y MESA CENTRAL      */}
      {/* ============================================================ */}
      <div className="relative my-auto w-full py-3 sm:py-6 flex flex-col items-center justify-center">
        {/* Mesa de fieltro ovalada con reborde iluminado */}
        <div className="absolute inset-x-0 sm:inset-x-4 inset-y-0 rounded-[36px] sm:rounded-[56px] bg-gradient-to-b from-[#081326]/65 via-[#0a1832]/50 to-[#070e1c]/75 border-2 border-[#16294a]/60 shadow-[inset_0_0_50px_rgba(0,0,0,0.6)] pointer-events-none -z-10" />

        {/* Resplandor ambiental de la mesa */}
        <div className="absolute w-72 sm:w-[500px] h-40 sm:h-64 rounded-full bg-gradient-to-r from-red-600/10 via-cyan-600/15 to-emerald-600/10 blur-3xl pointer-events-none -z-10" />

        {/* 1. SECTOR SUPERIOR: Jugadores al frente de la mesa */}
        {tableSeats.top.length > 0 && (
          <div className="w-full flex items-center justify-center gap-2 sm:gap-5 mb-3 sm:mb-5 px-2 z-10">
            {tableSeats.top.map((opponent) => renderOpponentSeat(opponent, 'top'))}
          </div>
        )}

        {/* 2. SECTOR CENTRAL: Flanco Izquierdo, Mesa de Cartas y Flanco Derecho */}
        <div className="w-full flex items-center justify-between sm:justify-center gap-2 sm:gap-6 lg:gap-10 px-1 sm:px-4 z-10">
          {/* Flanco Izquierdo */}
          {tableSeats.left.length > 0 && (
            <div className="flex flex-col items-center justify-center gap-2 sm:gap-4 min-w-[55px] sm:min-w-[130px] md:min-w-[160px]">
              {tableSeats.left.map((opponent) => renderOpponentSeat(opponent, 'left'))}
            </div>
          )}

          {/* MESA CENTRAL: MAZO DE ROBO, BOTÓN UNO Y PILA DE DESCARTE */}
          <div className="relative z-10 flex items-center justify-center gap-3 sm:gap-8 md:gap-10 p-3.5 sm:p-7 rounded-3xl bg-[#091122]/85 border-2 border-[#162744] shadow-2xl backdrop-blur-md">
            {/* Indicador de sentido de juego sobre la mesa */}
            <div
              className="absolute -top-3 inset-x-0 mx-auto w-max px-3 py-0.5 rounded-full bg-[#070c17] border border-[#1b2b48] text-[9px] sm:text-[10px] font-bold font-mono text-neutral-400 flex items-center gap-1.5 shadow-md"
              title={`Sentido de la ronda: ${gameState.direction === 'CLOCKWISE' ? 'Horario' : 'Antihorario'}`}
            >
              <span
                className={`inline-block transition-transform duration-300 ${
                  isDirectionSpinning ? 'animate-reverse-spin text-cyan-400' : 'text-cyan-400'
                }`}
              >
                {gameState.direction === 'CLOCKWISE' ? '↻' : '↺'}
              </span>
              <span className="hidden sm:inline">
                {gameState.direction === 'CLOCKWISE' ? 'SENTIDO HORARIO' : 'SENTIDO ANTIHORARIO'}
              </span>
            </div>

            {/* Mazo de Robo (Interactivo cuando es tu turno con resorte) */}
            <div className="flex flex-col items-center gap-2">
              <div
                ref={deckPileRef}
                onClick={isMyTurn && !gameState.winner ? handleLocalDraw : undefined}
                className={`relative group ${
                  isDeckSpring ? 'animate-deck-spring' : ''
                } ${
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

            {/* Pila de Descarte (Carta superior visible con slam y profundidad 3D) */}
            <div className="flex flex-col items-center gap-2">
              <div ref={discardPileRef} className="relative">
                {/* Resplandor del color de la carta actual con pulso al cambiar */}
                <div
                  className={`absolute inset-0 rounded-2xl filter blur-xl transition-all duration-500 ${
                    isColorChanging
                      ? 'animate-color-burst opacity-85 scale-125'
                      : 'opacity-50'
                  }`}
                  style={{ backgroundColor: activeColorInfo.glow }}
                />

                {/* Cartas anteriores debajo en la pila de descarte para profundidad física */}
                {discardHistory.map((oldCard, idx) => (
                  <div
                    key={`prev-discard-${oldCard.id}-${idx}`}
                    className="absolute inset-0 pointer-events-none opacity-60"
                    style={{
                      transform: `rotate(${getCardRotation(oldCard.id)}deg) translate(${
                        idx === 0 ? -3 : 3
                      }px, ${idx === 0 ? 2 : -2}px)`,
                    }}
                  >
                    <UnoCard card={oldCard} size="md" />
                  </div>
                ))}

                {/* Carta superior activa con animación de impacto / slam */}
                <div
                  key={gameState.topCard.id}
                  className="relative shadow-2xl animate-card-slam"
                  style={{
                    '--card-rot': `${getCardRotation(gameState.topCard.id)}deg`,
                  } as React.CSSProperties}
                >
                  <UnoCard
                    card={gameState.topCard}
                    size="md"
                    className="relative"
                  />
                </div>
              </div>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${activeColorInfo.text}`}
              >
                Descarte ({activeColorInfo.label})
              </span>
            </div>
          </div>

          {/* Flanco Derecho */}
          {tableSeats.right.length > 0 && (
            <div className="flex flex-col items-center justify-center gap-2 sm:gap-4 min-w-[55px] sm:min-w-[130px] md:min-w-[160px]">
              {tableSeats.right.map((opponent) => renderOpponentSeat(opponent, 'right'))}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECCIÓN INFERIOR: MANO DEL JUGADOR ACTUAL                    */}
      {/* ============================================================ */}
      <div className="mt-2 flex flex-col items-center">
        <div className="flex items-center justify-between w-full max-w-4xl px-4 mb-2">
          {/* Asiento del Jugador Local (Tú) */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-sm sm:text-base text-neutral-950 shadow-md ${
                  isMyTurn ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#070c17]' : ''
                }`}
              >
                {currentPlayer?.name ? currentPlayer.name.charAt(0).toUpperCase() : 'T'}
              </div>
              {isHost && (
                <span
                  className="absolute -top-2 -left-1 text-xs drop-shadow"
                  title="Anfitrión de la sala"
                >
                  👑
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  {currentPlayer?.name || 'Tú'} (Tú)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#070c17] border border-[#182845] text-cyan-400">
                  {myHandCount} cartas
                </span>
              </div>
              {myHandCount === 1 && (
                <div className="mt-0.5">
                  {iSaidUno ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-[0_0_10px_#10b981]">
                      ¡UNO PROTEGIDO! ✓
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white animate-bounce shadow-[0_0_12px_#ef4444]">
                      ¡CANTA UNO YA! ⚠️
                    </span>
                  )}
                </div>
              )}
            </div>
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
        <div
          ref={handContainerRef}
          className="w-full max-w-4xl overflow-x-auto pb-4 pt-4 px-4 flex justify-center items-end gap-1 sm:gap-2 min-h-[145px]"
        >
          {gameState.myHand.map((card, index) => {
            const playable = canPlay(card);
            const isNew = newCardIds.has(card.id);
            const isBeingPlayed = playingCardId === card.id;

            // Dinámica de abanico natural
            const total = gameState.myHand.length;
            const mid = (total - 1) / 2;
            const offset = total > 1 ? index - mid : 0;
            const maxAngle = Math.min(22, total * 2.5);
            const rot =
              total > 1 && total <= 14 ? (offset / (mid || 1)) * (maxAngle / 2) : 0;
            const yOffset = Math.abs(offset) * 1.5;

            return (
              <div
                id={`hand-card-${card.id}`}
                key={card.id}
                onClick={(e) =>
                  playable && !isBeingPlayed && handleCardClick(card, e)
                }
                className={`group relative transition-all duration-200 transform origin-bottom ${
                  isBeingPlayed
                    ? 'invisible pointer-events-none'
                    : isNew
                    ? 'animate-card-enter'
                    : ''
                } ${
                  iAmVulnerable && total === 1
                    ? 'animate-card-vibrate ring-4 ring-red-500 rounded-xl shadow-[0_0_20px_#ef4444]'
                    : playable
                    ? 'cursor-grab active:cursor-grabbing -translate-y-2 hover:-translate-y-8 hover:scale-120 hover:rotate-0 hover:z-40 active:scale-125 active:-translate-y-10 active:brightness-110 ring-2 ring-cyan-400/80 rounded-xl shadow-[0_8px_20px_rgba(0,180,216,0.35)] active:shadow-[0_20px_35px_rgba(0,180,216,0.6)]'
                    : isMyTurn
                    ? 'opacity-40 cursor-not-allowed hover:opacity-60'
                    : 'opacity-85 cursor-default'
                }`}
                style={{
                  transform: isBeingPlayed
                    ? undefined
                    : isNew
                    ? undefined
                    : `translateY(${yOffset}px) rotate(${rot}deg)`,
                  zIndex: index + 5,
                }}
              >
                {/* Indicador de carta recién robada */}
                {isNew && (
                  <span className="absolute -top-3.5 inset-x-0 mx-auto w-max px-1.5 py-0.5 rounded-full bg-cyan-400 text-black text-[8px] font-black uppercase tracking-wider animate-bounce shadow-md pointer-events-none z-50">
                    ¡Nueva!
                  </span>
                )}
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

      {/* ============================================================ */}
      {/* CARTA EN VUELO FÍSICO AL JUGAR DESDE LA MANO A LA MESA       */}
      {/* (Renderizada en fixed root: 100% visible, sin clipping)       */}
      {/* ============================================================ */}
      {flyingPlayCard && (
        <div
          className="fixed pointer-events-none z-[100] transition-all select-none"
          style={{
            left: `${flyingPlayCard.startX}px`,
            top: `${flyingPlayCard.startY}px`,
            width: `${flyingPlayCard.width}px`,
            height: `${flyingPlayCard.height}px`,
            transform: flyingPlayCard.isTarget
              ? `translate(${flyingPlayCard.deltaX}px, ${flyingPlayCard.deltaY}px) scale(1.18) rotate(${flyingPlayCard.targetRotation}deg)`
              : `translate(0px, -24px) scale(1.12) rotate(-5deg)`,
            filter: flyingPlayCard.isTarget
              ? 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))'
              : 'drop-shadow(0 25px 35px rgba(0,0,0,0.85))',
            transitionProperty: 'transform, filter',
            transitionDuration: '340ms',
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <UnoCard card={flyingPlayCard.card} size="sm" />
        </div>
      )}

      {/* ============================================================ */}
      {/* CARTA EN VUELO FÍSICO AL ROBAR DEL MAZO                       */}
      {/* ============================================================ */}
      {flyingDrawCard && (
        <div
          className="fixed pointer-events-none z-[100] transition-all select-none drop-shadow-2xl"
          style={{
            left: `${flyingDrawCard.startX}px`,
            top: `${flyingDrawCard.startY}px`,
            width: `${flyingDrawCard.width}px`,
            height: `${flyingDrawCard.height}px`,
            transform: flyingDrawCard.isTarget
              ? `translate(${flyingDrawCard.deltaX}px, ${flyingDrawCard.deltaY}px) scale(0.9) rotate(0deg)`
              : `translate(0px, 0px) scale(1.08) rotate(-4deg)`,
            transitionProperty: 'transform, filter',
            transitionDuration: '340ms',
            transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.25, 1)',
          }}
        >
          <UnoCard isFaceDown size="md" />
        </div>
      )}
    </div>
  );
}

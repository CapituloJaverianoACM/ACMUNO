'use client';

import Image from 'next/image';
import type { Card } from '@/types/room';

interface UnoCardProps {
  card?: Card;
  isFaceDown?: boolean;
  isPlayable?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function UnoCard({
  card,
  isFaceDown = false,
  isPlayable = false,
  onClick,
  className = '',
  size = 'md',
}: UnoCardProps) {
  // Dimensiones según el tamaño
  const sizeClasses = {
    sm: 'w-14 h-20 sm:w-16 sm:h-24',
    md: 'w-20 h-28 sm:w-24 sm:h-36',
    lg: 'w-28 h-40 sm:w-32 sm:h-48',
  }[size];

  // Carta boca abajo (Reverso de carta oficial / estilo cyberpunk)
  if (isFaceDown || !card) {
    return (
      <div
        className={`${sizeClasses} ${className} relative rounded-xl bg-gradient-to-br from-[#0c1322] via-[#070b16] to-[#04070d] border-2 border-[#1f365d] shadow-lg flex flex-col items-center justify-center overflow-hidden transition-all select-none`}
      >
        {/* Borde interior con resplandor */}
        <div className="absolute inset-1 rounded-lg border border-[#00b4d8]/30 flex flex-col items-center justify-center bg-[#070d1a]/50">
          <div className="w-8 h-8 rounded-full bg-[#0084ff]/20 border border-[#00b4d8]/40 flex items-center justify-center transform -rotate-12">
            <span className="text-[10px] font-black text-[#00b4d8] font-mono">UNO</span>
          </div>
          <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
            ACM
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={isPlayable ? onClick : undefined}
      className={`${sizeClasses} ${className} relative rounded-xl transition-all duration-200 select-none ${
        isPlayable
          ? 'cursor-pointer hover:-translate-y-3 hover:scale-105 hover:shadow-[0_10px_20px_rgba(0,180,216,0.35)]'
          : 'cursor-default'
      }`}
    >
      <Image
        src={card.image}
        alt={`Carta ${card.color} ${card.type}`}
        fill
        sizes="(max-width: 640px) 80px, 128px"
        className="rounded-xl object-contain drop-shadow-md pointer-events-none"
        priority
      />
    </div>
  );
}

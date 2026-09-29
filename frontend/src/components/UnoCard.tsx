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

  // Carta boca abajo (Reverso de carta oficial ACM Computer Society)
  if (isFaceDown || !card) {
    return (
      <div
        className={`${sizeClasses} ${className} relative rounded-xl shadow-lg overflow-hidden transition-all select-none`}
      >
        <Image
          src="/img/card_back.png"
          alt="Reverso de carta UNO"
          fill
          sizes="(max-width: 640px) 80px, 128px"
          className="rounded-xl object-contain drop-shadow-md pointer-events-none"
          priority
        />
      </div>
    );
  }

  return (
    <div
      onClick={isPlayable ? onClick : undefined}
      className={`${sizeClasses} ${className} relative rounded-xl transition-all duration-200 select-none ${
        isPlayable
          ? 'cursor-grab active:cursor-grabbing hover:-translate-y-3 hover:scale-105 hover:shadow-[0_10px_20px_rgba(0,180,216,0.35)]'
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

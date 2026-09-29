'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createRoom, joinRoom } from '@/lib/api';
import { QrScannerModal } from '@/components/QrScannerModal';

export default function Home() {
  const router = useRouter();

  // Estado para crear partida
  const [hostName, setHostName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Estado para unirse a partida
  const [joinPlayerName, setJoinPlayerName] = useState('');
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Modal para escanear QR
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const pinInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Manejador de creación de sala
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) {
      setCreateError('Ingresa tu apodo para crear la partida');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);

      const data = await createRoom(hostName.trim());

      // Guardar jugador host en la sesión
      sessionStorage.setItem(
        `uno_player_${data.pin}`,
        JSON.stringify(data.hostPlayer)
      );

      // Redirigir a la sala
      router.push(`/room/${data.pin}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setCreateError(err.message);
      } else {
        setCreateError('Error al conectar con el servidor.');
      }
    } finally {
      setCreating(false);
    }
  };

  // Manejo de entrada de PIN casilla por casilla
  const handlePinChange = (index: number, value: string) => {
    const val = value.slice(-1).toUpperCase();
    const newDigits = [...pinDigits];
    newDigits[index] = val;
    setPinDigits(newDigits);
    if (joinError) setJoinError(null);

    if (val && index < 3) {
      pinInputRefs[index + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputRefs[index - 1].current?.focus();
    }
  };

  // Manejador para unirse a partida
  const handleJoinClick = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredPin = pinDigits.join('').toUpperCase();

    if (enteredPin.length < 4) {
      setJoinError('Ingresa el PIN completo de 4 dígitos/letras.');
      return;
    }

    if (!joinPlayerName.trim()) {
      setJoinError('Ingresa tu apodo para entrar a la partida.');
      return;
    }

    try {
      setJoining(true);
      setJoinError(null);

      const data = await joinRoom(enteredPin, joinPlayerName.trim());

      // Guardar el jugador invitado en el almacenamiento de sesión
      sessionStorage.setItem(
        `uno_player_${enteredPin}`,
        JSON.stringify(data.player)
      );

      // Redirigir a la sala
      router.push(`/room/${enteredPin}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setJoinError(err.message);
      } else {
        setJoinError('No se pudo unir a la sala.');
      }
    } finally {
      setJoining(false);
    }
  };

  // Callback cuando se escanea un código QR exitosamente
  const handleQrScanned = (scannedPin: string) => {
    const cleanPin = scannedPin.trim().toUpperCase().slice(0, 4);
    const chars = cleanPin.split('');
    setPinDigits([
      chars[0] || '',
      chars[1] || '',
      chars[2] || '',
      chars[3] || '',
    ]);

    if (!joinPlayerName.trim()) {
      setJoinError('¡PIN detectado! Ingresa tu apodo y haz clic en Unirse.');
    }
  };

  return (
    <main className="min-h-screen bg-[#060913] text-white flex flex-col items-center justify-between p-4 sm:p-6 md:p-10 relative overflow-hidden select-none">
      {/* ============================================================ */}
      {/* DETALLES DECORATIVOS CIBERNÉTICOS & ESQUINAS                */}
      {/* ============================================================ */}

      {/* Esquina superior izquierda con matriz de puntos ::: */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex flex-col gap-1 pointer-events-none opacity-60">
        <div className="w-8 h-8 border-t-2 border-l-2 border-[#1f365d]" />
        <div className="grid grid-cols-3 gap-1 w-6 mt-1 ml-1">
          <div className="w-1 h-1 bg-[#1f365d] rounded-full" />
          <div className="w-1 h-1 bg-[#1f365d] rounded-full" />
          <div className="w-1 h-1 bg-[#1f365d] rounded-full" />
          <div className="w-1 h-1 bg-[#1f365d] rounded-full" />
          <div className="w-1 h-1 bg-[#1f365d] rounded-full" />
          <div className="w-1 h-1 bg-[#1f365d] rounded-full" />
        </div>
      </div>

      {/* Esquina superior derecha */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 pointer-events-none opacity-60">
        <div className="w-8 h-8 border-t-2 border-r-2 border-[#1f365d]" />
      </div>

      {/* Esquina inferior izquierda */}
      <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 pointer-events-none opacity-60">
        <div className="w-8 h-8 border-b-2 border-l-2 border-[#1f365d]" />
      </div>

      {/* Esquina inferior derecha con puntos ... */}
      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 pointer-events-none opacity-60 flex flex-col items-end gap-1">
        <div className="flex gap-1 mb-1 mr-1">
          <div className="w-1 h-1 bg-[#1f365d] rounded-full" />
          <div className="w-1 h-1 bg-[#1f365d] rounded-full" />
          <div className="w-1 h-1 bg-[#1f365d] rounded-full" />
        </div>
        <div className="w-8 h-8 border-b-2 border-r-2 border-[#1f365d]" />
      </div>

      {/* Cubos de píxeles de colores flotantes */}
      <div className="absolute top-28 left-[13%] flex flex-col gap-1 pointer-events-none">
        <div className="w-2.5 h-2.5 bg-[#e52837] shadow-[0_0_8px_#e52837]" />
        <div className="w-2.5 h-2.5 bg-[#f59e0b] ml-3 shadow-[0_0_8px_#f59e0b]" />
      </div>
      <div className="absolute top-1/2 left-[14%] flex flex-col gap-1 pointer-events-none">
        <div className="w-2.5 h-2.5 bg-[#0084ff] shadow-[0_0_8px_#0084ff]" />
        <div className="w-2.5 h-2.5 bg-[#22c55e] ml-2 shadow-[0_0_8px_#22c55e]" />
      </div>
      <div className="absolute top-40 right-[15%] w-2.5 h-2.5 bg-[#f59e0b] shadow-[0_0_8px_#f59e0b] pointer-events-none" />
      <div className="absolute bottom-28 right-[17%] w-2.5 h-2.5 bg-[#f59e0b] shadow-[0_0_8px_#f59e0b] pointer-events-none" />

      {/* ============================================================ */}
      {/* 4 CARTAS DE UNO EN LAS ESQUINAS                             */}
      {/* ============================================================ */}

      <div className="absolute -top-6 -left-6 sm:top-2 sm:left-2 md:top-8 md:left-6 z-0 pointer-events-none">
        <Image
          src="/img/red/carta_1.png"
          alt="Carta 1 Roja"
          width={180}
          height={260}
          priority
          className="w-28 sm:w-36 md:w-44 lg:w-48 transform -rotate-[14deg] drop-shadow-[0_12px_24px_rgba(229,40,55,0.25)] filter brightness-95"
        />
      </div>

      <div className="absolute -bottom-6 -left-6 sm:bottom-2 sm:left-2 md:bottom-6 md:left-6 z-0 pointer-events-none">
        <Image
          src="/img/yellow/carta_masdos.png"
          alt="Carta +2 Amarilla"
          width={180}
          height={260}
          priority
          className="w-28 sm:w-36 md:w-44 lg:w-48 transform rotate-[16deg] drop-shadow-[0_12px_24px_rgba(245,158,11,0.25)] filter brightness-95"
        />
      </div>

      <div className="absolute -top-6 -right-6 sm:top-2 sm:right-2 md:top-8 md:right-6 z-0 pointer-events-none">
        <Image
          src="/img/blue/carta_7.png"
          alt="Carta 7 Azul"
          width={180}
          height={260}
          priority
          className="w-28 sm:w-36 md:w-44 lg:w-48 transform rotate-[14deg] drop-shadow-[0_12px_24px_rgba(0,132,255,0.25)] filter brightness-95"
        />
      </div>

      <div className="absolute -bottom-6 -right-6 sm:bottom-2 sm:right-2 md:bottom-6 md:right-6 z-0 pointer-events-none">
        <Image
          src="/img/green/carta_revertir.png"
          alt="Carta Revertir Verde"
          width={180}
          height={260}
          priority
          className="w-28 sm:w-36 md:w-44 lg:w-48 transform -rotate-[16deg] drop-shadow-[0_12px_24px_rgba(34,197,94,0.25)] filter brightness-95"
        />
      </div>

      {/* ============================================================ */}
      {/* LOGO SUPERIOR ACM COMPUTER SOCIETY                           */}
      {/* ============================================================ */}
      <header className="relative z-10 flex flex-col items-center mt-2 sm:mt-4 mb-3 sm:mb-6">
        <Image
          src="/img/logo.png"
          alt="ACM Computer Society"
          width={420}
          height={140}
          priority
          className="h-auto w-64 sm:w-80 md:w-[360px] object-contain drop-shadow-[0_0_25px_rgba(0,100,255,0.4)] hover:brightness-110 transition-all select-none"
        />
      </header>

      {/* ============================================================ */}
      {/* PANELES PRINCIPALES: CREAR PARTIDA & UNIRSE A PARTIDA        */}
      {/* ============================================================ */}
      <div className="relative z-10 w-full max-w-3xl my-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {/* -------------------------------------------------------- */}
          {/* PANEL IZQUIERDO: CREAR PARTIDA                           */}
          {/* -------------------------------------------------------- */}
          <div className="cyber-card rounded-2xl p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-[#2a4570]" />
            <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-[#2a4570]" />

            <div>
              {/* Icono de Personas pixel art */}
              <div className="flex justify-center mb-4">
                <svg
                  className="w-12 h-10 text-white"
                  viewBox="0 0 32 24"
                  fill="currentColor"
                >
                  <rect x="13" y="1" width="6" height="6" rx="1" />
                  <path d="M 10 9 H 22 V 15 H 10 Z" />
                  <rect x="4" y="4" width="5" height="5" rx="1" />
                  <path d="M 2 11 H 8 V 16 H 2 Z" />
                  <rect x="23" y="4" width="5" height="5" rx="1" />
                  <path d="M 24 11 H 30 V 16 H 24 Z" />
                </svg>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-center text-white mb-2 tracking-wide">
                Crear partida
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 text-center mb-5 leading-relaxed">
                Genera un PIN y comparte el enlace con tus amigos.
              </p>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Tu apodo o nombre..."
                  value={hostName}
                  maxLength={16}
                  onChange={(e) => {
                    setHostName(e.target.value);
                    if (createError) setCreateError(null);
                  }}
                  disabled={creating}
                  className="w-full bg-[#070c17] border-2 border-[#182845] rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white placeholder-neutral-500 focus:border-[#00b4d8] focus:outline-none transition-all"
                />
              </div>

              {createError && (
                <div className="text-xs text-red-400 text-center font-medium bg-red-950/40 border border-red-900/50 py-1.5 px-3 rounded-lg">
                  {createError}
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                className="w-full py-3 sm:py-3.5 px-4 btn-retro-red text-white font-bold rounded-2xl text-base tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <span>Generando sala...</span>
                ) : (
                  <>
                    <span className="text-lg leading-none">+</span>
                    <span>Crear partida</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* -------------------------------------------------------- */}
          {/* PANEL DERECHO: UNIRSE A PARTIDA (100% OPERACIONAL)       */}
          {/* -------------------------------------------------------- */}
          <div className="cyber-card rounded-2xl p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-[#2a4570]" />
            <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-[#2a4570]" />

            <div>
              {/* Icono de Enlace / Cadena pixel art */}
              <div className="flex justify-center mb-4">
                <svg
                  className="w-10 h-10 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-center text-white mb-2 tracking-wide">
                Unirse a partida
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 text-center mb-4 leading-relaxed">
                Ingresa el PIN de la partida para unirte.
              </p>
            </div>

            <form onSubmit={handleJoinClick} className="space-y-3">
              {/* 4 Casillas para dígitos del PIN */}
              <div className="flex justify-center items-center gap-2 sm:gap-3">
                {pinDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={pinInputRefs[idx]}
                    type="text"
                    maxLength={1}
                    value={digit}
                    placeholder="0"
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(idx, e)}
                    className="pin-digit-box w-11 h-12 sm:w-12 sm:h-14 rounded-xl text-center text-xl sm:text-2xl uppercase placeholder:text-[#223554] cursor-text"
                  />
                ))}
              </div>

              {/* Campo para ingresar apodo de invitado */}
              <div>
                <input
                  type="text"
                  placeholder="Tu apodo para unirte..."
                  value={joinPlayerName}
                  maxLength={16}
                  onChange={(e) => {
                    setJoinPlayerName(e.target.value);
                    if (joinError) setJoinError(null);
                  }}
                  disabled={joining}
                  className="w-full bg-[#070c17] border-2 border-[#182845] rounded-xl px-4 py-2 text-center text-xs sm:text-sm font-semibold text-white placeholder-neutral-500 focus:border-[#00b4d8] focus:outline-none transition-all"
                />
              </div>

              {joinError && (
                <div className="text-xs text-red-400 text-center font-medium bg-red-950/40 border border-red-900/50 py-1.5 px-3 rounded-lg">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={joining}
                className="w-full py-3 sm:py-3.5 px-4 btn-retro-blue text-white font-bold rounded-2xl text-base tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joining ? (
                  <span>Conectando a la sala...</span>
                ) : (
                  <>
                    <span>→</span>
                    <span>Unirse</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECCIÓN INFERIOR: SEPARADOR Y BOTÓN QR                       */}
        {/* ============================================================ */}
        <div className="flex flex-col items-center mt-6">
          <div className="flex items-center gap-4 w-full max-w-xs mb-4 opacity-75">
            <div className="h-[1px] bg-[#16243d] flex-1" />
            <span className="text-xs text-neutral-500 font-mono">0</span>
            <div className="h-[1px] bg-[#16243d] flex-1" />
          </div>

          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl bg-[#09101d] border border-[#1d3356] hover:border-[#00b4d8] hover:bg-[#0c1628] text-neutral-300 hover:text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer"
          >
            <svg
              className="w-4 h-4 text-[#00b4d8]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="3" height="3" />
              <rect x="18" y="18" width="3" height="3" />
            </svg>
            <span>Escanear código QR</span>
          </button>
        </div>
      </div>

      <footer className="relative z-10 text-[11px] text-neutral-500 text-center mt-4">
        <span>Capítulo Javeriano ACM • UNO Multiplayer Web</span>
      </footer>

      {/* Modal de escáner QR */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleQrScanned}
      />
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrModalProps {
  pin: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QrModal({ pin, isOpen, onClose }: QrModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/room/${pin.toUpperCase()}`;
      setShareUrl(url);

      QRCode.toDataURL(url, {
        width: 280,
        margin: 2,
        color: {
          dark: '#00b4d8', // Cyan tecnológico
          light: '#070c17', // Fondo oscuro cibernético
        },
      })
        .then((dataUrl) => {
          setQrDataUrl(dataUrl);
        })
        .catch((err) => {
          console.error('Error generando código QR:', err);
        });
    }
  }, [pin]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="cyber-card w-full max-w-sm rounded-3xl p-6 relative border-2 border-[#1e3459] shadow-2xl shadow-cyan-950/40 text-center">
        {/* Esquinas decorativas */}
        <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#00b4d8]" />
        <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#00b4d8]" />
        <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-[#00b4d8]" />
        <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-[#00b4d8]" />

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-lg font-bold text-white tracking-wide mb-1">
          Código QR de la Partida
        </h3>
        <p className="text-xs text-neutral-400 mb-4">
          Escanea con tu cámara o celular para unirte directamente a la sala.
        </p>

        {/* Imagen del QR */}
        <div className="flex justify-center my-3">
          <div className="p-3 bg-[#070c17] border-2 border-[#16253e] rounded-2xl shadow-inner">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`Código QR para unirse a la sala ${pin}`}
                className="w-56 h-56 rounded-xl object-contain mx-auto"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-neutral-500">
                Generando QR...
              </div>
            )}
          </div>
        </div>

        {/* PIN destacado */}
        <div className="inline-block px-3 py-1 bg-[#0b1424] border border-[#1d355b] rounded-lg text-xs font-mono font-bold text-cyan-400 my-2">
          PIN: {pin.toUpperCase()}
        </div>

        {/* Botón Copiar Enlace Directo */}
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={handleCopyLink}
            className="w-full py-2.5 px-4 rounded-xl bg-[#09101d] border border-[#1d3356] hover:border-[#00b4d8] hover:bg-[#0c1628] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-emerald-400">¡Enlace copiado!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copiar Enlace de Invitación</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

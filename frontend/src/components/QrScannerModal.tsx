'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (pin: string) => void;
}

export function QrScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
}: QrScannerModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
            setIsScanning(false);
          });
      }
      return;
    }

    const scannerId = 'reader';
    const html5QrCode = new Html5Qrcode(scannerId);
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
        },
        (decodedText) => {
          // Extraer PIN si es URL completa tipo http://localhost:3000/room/ABCD o solo texto "ABCD"
          let pin = decodedText.trim();
          const match = decodedText.match(/\/room\/([a-zA-Z0-9]+)/i);
          if (match && match[1]) {
            pin = match[1];
          }

          html5QrCode
            .stop()
            .catch(() => {})
            .finally(() => {
              onScanSuccess(pin.toUpperCase());
              onClose();
            });
        },
        () => {
          // ignore scan frame errors
        }
      )
      .then(() => {
        setIsScanning(true);
        setErrorMessage(null);
      })
      .catch((err) => {
        console.error('Error al iniciar la cámara para QR:', err);
        setErrorMessage(
          'No se pudo acceder a la cámara. Asegúrate de otorgar permisos o ingresa el PIN manualmente.'
        );
      });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, [isOpen, onClose, onScanSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="cyber-card w-full max-w-sm rounded-3xl p-6 relative border-2 border-[#1e3459] shadow-2xl text-center">
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
          Escanear Código QR
        </h3>
        <p className="text-xs text-neutral-400 mb-4">
          Apunta la cámara al código QR de la partida.
        </p>

        {/* Contenedor del video escáner */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-[#16253e] bg-[#070c17] min-h-[260px] flex items-center justify-center">
          <div id="reader" className="w-full" />
          {!isScanning && !errorMessage && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
              Iniciando cámara...
            </div>
          )}
          {errorMessage && (
            <div className="p-4 text-xs text-red-400 bg-red-950/40 rounded-xl m-2 border border-red-900/50">
              {errorMessage}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 px-4 rounded-xl bg-[#09101d] border border-[#1d3356] hover:bg-[#0c1628] text-neutral-300 text-xs font-semibold cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

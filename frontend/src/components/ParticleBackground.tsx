'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  wobbleAngle: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  alpha: number;
  pulseAngle: number;
  pulseSpeed: number;
  isPixel: boolean;
}

const UNO_PARTICLE_COLORS = [
  '#00e5ff', // Neon Cyan / Azul
  '#0084ff', // Cyan profundo
  '#ff3355', // Neon Rojo
  '#ffd000', // Neon Amarillo
  '#00ff88', // Neon Verde
  '#a855f7', // Neon Púrpura (Comodín)
];

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Ajustar número de partículas según el tamaño de pantalla
    const isMobile = width < 768;
    const particleCount = isMobile ? 32 : 65;

    // Crear partículas
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 3 + 1.2,
        color:
          UNO_PARTICLE_COLORS[
            Math.floor(Math.random() * UNO_PARTICLE_COLORS.length)
          ],
        speedX: (Math.random() - 0.5) * 0.35,
        speedY: -(Math.random() * 0.45 + 0.2), // Flotar suavemente hacia arriba
        wobbleAngle: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.02 + 0.01,
        wobbleAmp: Math.random() * 0.6 + 0.2,
        alpha: Math.random() * 0.5 + 0.3,
        pulseAngle: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.025 + 0.01,
        isPixel: Math.random() > 0.45, // 55% cubos/píxeles, 45% orbes circulares
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Bucle de animación continuo a 60fps
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Actualizar física y balanceo continuo
        p.wobbleAngle += p.wobbleSpeed;
        p.pulseAngle += p.pulseSpeed;

        p.x += p.speedX + Math.sin(p.wobbleAngle) * p.wobbleAmp;
        p.y += p.speedY;

        // Recirculación infinita en los bordes
        if (p.y < -20) {
          p.y = height + 15;
          p.x = Math.random() * width;
        } else if (p.y > height + 20) {
          p.y = -15;
          p.x = Math.random() * width;
        }

        if (p.x < -20) {
          p.x = width + 15;
        } else if (p.x > width + 20) {
          p.x = -15;
        }

        // Opacidad pulsante para brillo vivo
        const currentAlpha = Math.max(
          0.15,
          Math.min(0.9, p.alpha + Math.sin(p.pulseAngle) * 0.25)
        );

        ctx.save();
        ctx.globalAlpha = currentAlpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 2.8;

        if (p.isPixel) {
          // Píxel cibernético cuadrado/diamante
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.PI / 4); // Rotación diamante de 45°
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          // Orbe de luz circular
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 select-none opacity-85"
    />
  );
}

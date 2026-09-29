// Gestor de efectos de sonido para ACM UNO (HTML5 Audio Pool)

const CARD_SOUND_PATH = '/sound/cards.wav';
const POOL_SIZE = 6;

class SoundManager {
  private audioPool: HTMLAudioElement[] = [];
  private poolIndex = 0;
  private isMuted = false;
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('acm_uno_muted');
        if (saved !== null) {
          this.isMuted = saved === 'true';
        }
      } catch {
        // Fallback silencioso en caso de bloqueo de localStorage
      }
    }
  }

  private initPool() {
    if (this.isInitialized || typeof window === 'undefined') return;
    try {
      for (let i = 0; i < POOL_SIZE; i++) {
        const audio = new Audio(CARD_SOUND_PATH);
        audio.preload = 'auto';
        audio.volume = 0.75;
        this.audioPool.push(audio);
      }
      this.isInitialized = true;
    } catch (e) {
      console.warn('No se pudo inicializar el pool de audio:', e);
    }
  }

  /**
   * Reproduce el sonido de movimiento / deslizamiento / golpe de carta.
   * Utiliza una cola cíclica (pool) para permitir sonidos simultáneos o rápidos sin cortes.
   */
  public playCardMove() {
    if (typeof window === 'undefined' || this.isMuted) return;

    if (!this.isInitialized) {
      this.initPool();
    }

    if (this.audioPool.length === 0) return;

    try {
      const audio = this.audioPool[this.poolIndex];
      this.poolIndex = (this.poolIndex + 1) % this.audioPool.length;

      audio.currentTime = 0;
      audio.volume = 0.75;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // El navegador puede rechazar la reproducción si el usuario aún no interactuó
        });
      }
    } catch {
      // Ignorar fallback
    }
  }

  /**
   * Alterna entre silenciado y con sonido
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('acm_uno_muted', String(this.isMuted));
      } catch {
        // Ignorar
      }
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}

export const soundManager = new SoundManager();

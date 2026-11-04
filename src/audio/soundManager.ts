// Procedural Sci-Fi Web Audio SFX Generator & Custom URL Audio Manager for "شطرنج راكان"

export interface SoundUrls {
  move?: string;
  capture?: string;
  checkmate?: string;
  select?: string;
  click?: string;
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private customUrls: SoundUrls = {};
  private audioElements: Record<string, HTMLAudioElement> = {};

  constructor() {
    // AudioContext will be initialized on first user interaction
    const savedMute = localStorage.getItem('rakan_chess_muted');
    if (savedMute !== null) {
      this.isMuted = savedMute === 'true';
    }
  }

  private initContext(): AudioContext | null {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    } catch (e) {
      console.warn('AudioContext not supported or blocked:', e);
    }
    return this.ctx;
  }

  public setCustomUrls(urls: SoundUrls) {
    this.customUrls = { ...this.customUrls, ...urls };
    // Pre-cache HTMLAudioElements if valid URLs provided
    Object.entries(urls).forEach(([key, url]) => {
      if (url && typeof url === 'string') {
        try {
          const audio = new Audio(url);
          audio.preload = 'auto';
          this.audioElements[key] = audio;
        } catch (e) {
          console.warn(`Failed to preload audio for ${key}:`, e);
        }
      }
    });
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('rakan_chess_muted', String(muted));
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  // Helper to play custom URL or fallback to synthesizer
  private playOrSynthesize(type: keyof SoundUrls, synthFn: (ctx: AudioContext) => void) {
    if (this.isMuted) return;

    // Check if custom audio URL exists
    if (this.customUrls[type] && this.audioElements[type]) {
      try {
        const el = this.audioElements[type].cloneNode() as HTMLAudioElement;
        el.volume = 0.85;
        el.play().catch(() => {
          // If playback fails, fallback to Web Audio synthesis
          const ctx = this.initContext();
          if (ctx) synthFn(ctx);
        });
        return;
      } catch (e) {
        console.warn('Fallback to procedural synthesis:', e);
      }
    }

    const ctx = this.initContext();
    if (ctx) {
      synthFn(ctx);
    }
  }

  // 1. Move Sound: Futuristic smooth magnetic laser glide
  public playMove() {
    this.playOrSynthesize('move', (ctx) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.22);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    });
  }

  // 2. Capture Sound: Cosmic plasma impact & resonant disintegration burst
  public playCapture() {
    this.playOrSynthesize('capture', (ctx) => {
      const now = ctx.currentTime;

      // Deep sub boom
      const boomOsc = ctx.createOscillator();
      const boomGain = ctx.createGain();
      boomOsc.type = 'triangle';
      boomOsc.frequency.setValueAtTime(140, now);
      boomOsc.frequency.exponentialRampToValueAtTime(38, now + 0.35);

      boomGain.gain.setValueAtTime(0.35, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      boomOsc.connect(boomGain);
      boomGain.connect(ctx.destination);
      boomOsc.start(now);
      boomOsc.stop(now + 0.4);

      // Energy fizz / white noise burst
      const bufferSize = ctx.sampleRate * 0.25;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1800, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(450, now + 0.25);
      noiseFilter.Q.value = 3.0;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.28, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      whiteNoise.start(now);

      // Sci-fi metallic chime
      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(880, now);
      chime.frequency.exponentialRampToValueAtTime(220, now + 0.32);
      chimeGain.gain.setValueAtTime(0.2, now);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      chime.connect(chimeGain);
      chimeGain.connect(ctx.destination);
      chime.start(now);
      chime.stop(now + 0.36);
    });
  }

  // 3. Checkmate Sound: Triumphant sci-fi royal fanfare chord progression
  public playCheckmate() {
    this.playOrSynthesize('checkmate', (ctx) => {
      const now = ctx.currentTime;
      // Majestic 4-chord cosmic progression: D4, F#4, A4, D5 -> E5 -> G#5 -> A5
      const notes = [
        { freq: 293.66, time: 0, dur: 0.8 },
        { freq: 369.99, time: 0, dur: 0.8 },
        { freq: 440.0, time: 0, dur: 0.8 },
        { freq: 587.33, time: 0.25, dur: 1.0 },
        { freq: 659.25, time: 0.5, dur: 1.2 },
        { freq: 880.0, time: 0.8, dur: 1.6 },
        { freq: 1174.66, time: 0.8, dur: 1.6 }
      ];

      notes.forEach(({ freq, time, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);

        gain.gain.setValueAtTime(0.001, now + time);
        gain.gain.linearRampToValueAtTime(0.18, now + time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + time);
        osc.stop(now + time + dur + 0.05);
      });
    });
  }

  // 4. Selection Sound: Holographic crystal chime
  public playSelect() {
    this.playOrSynthesize('select', (ctx) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.06); // B5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    });
  }

  // 5. Mic Toggle Sound: Electronic communicator blip
  public playMicToggle(enabled: boolean) {
    const ctx = this.initContext();
    if (!ctx || this.isMuted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    if (enabled) {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
    } else {
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(330, now + 0.08);
    }

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }
}

export const soundManager = new SoundManager();

// Expose sound hook on window so external callers or wizardChessEngine can trigger SFX easily
declare global {
  interface Window {
    rakanChessAudio?: typeof soundManager;
  }
}

if (typeof window !== 'undefined') {
  window.rakanChessAudio = soundManager;
}

import { Peer, DataConnection, MediaConnection } from 'peerjs';

export interface GameMovePayload {
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
  color: 'w' | 'b';
}

export type PeerMessage =
  | { type: 'move'; move: GameMovePayload }
  | { type: 'reset'; hostColor?: 'w' | 'b' }
  | { type: 'sync_request' }
  | { type: 'sync_state'; fen?: string; currentTurn: 'w' | 'b'; scores: { white: number; black: number } }
  | { type: 'score_update'; white: number; black: number }
  | { type: 'voice_status'; isSpeaking: boolean; isMuted: boolean }
  | { type: 'reaction'; emoji: string; text?: string };

export interface PeerEvents {
  onConnected?: (remotePeerId: string, isHost: boolean) => void;
  onDisconnected?: () => void;
  onMoveReceived?: (move: GameMovePayload) => void;
  onResetReceived?: () => void;
  onScoreReceived?: (scores: { white: number; black: number }) => void;
  onReactionReceived?: (reaction: { emoji: string; text?: string }) => void;
  onRemoteVoiceStream?: (stream: MediaStream) => void;
  onRemoteVoiceEnded?: () => void;
  onError?: (err: string) => void;
}

export class MultiplayerService {
  private peer: Peer | null = null;
  private dataConn: DataConnection | null = null;
  private mediaCall: MediaConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudioEl: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number = 0;

  public roomCode: string = '';
  public isHost: boolean = false;
  public isConnected: boolean = false;
  public remotePeerId: string = '';
  public isMicActive: boolean = false;
  public isLocalSpeaking: boolean = false;
  public isRemoteSpeaking: boolean = false;
  public events: PeerEvents = {};

  constructor() {
    if (typeof window !== 'undefined') {
      this.remoteAudioEl = document.createElement('audio');
      this.remoteAudioEl.autoplay = true;
      document.body.appendChild(this.remoteAudioEl);
    }
  }

  // Generate a clean 6-character room code (e.g. RAKAN-A9B2)
  public static generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `RK-${code}`;
  }

  // Clean room code helper
  public static sanitizeRoomCode(raw: string): string {
    return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
  }

  // Create a Room as Host
  public async createRoom(customCode?: string): Promise<string> {
    this.disconnect();
    const code = customCode ? MultiplayerService.sanitizeRoomCode(customCode) : MultiplayerService.generateRoomCode();
    this.roomCode = code;
    this.isHost = true;

    const hostPeerId = `rkch-${code.toLowerCase()}-host`;

    return new Promise((resolve, reject) => {
      try {
        const peer = new Peer(hostPeerId, {
          debug: 1
        });

        this.peer = peer;

        peer.on('open', (id) => {
          this.remotePeerId = '';
          resolve(code);
        });

        peer.on('connection', (conn) => {
          this.setupDataConnection(conn);
        });

        peer.on('call', (call) => {
          this.setupMediaCall(call);
        });

        peer.on('error', (err) => {
          // If ID is already taken, try appending a unique random suffix
          if (err.type === 'unavailable-id') {
            const fallbackCode = `${code}-${Math.floor(Math.random() * 90 + 10)}`;
            this.createRoom(fallbackCode).then(resolve).catch(reject);
            return;
          }
          console.warn('PeerJS host error:', err);
          this.events.onError?.(err.message || 'خطأ في الاتصال بالشبكة');
          reject(err);
        });
      } catch (err: unknown) {
        reject(err);
      }
    });
  }

  // Join a Room as Guest
  public async joinRoom(codeToJoin: string): Promise<boolean> {
    this.disconnect();
    const code = MultiplayerService.sanitizeRoomCode(codeToJoin);
    this.roomCode = code;
    this.isHost = false;

    const guestPeerId = `rkch-${code.toLowerCase()}-guest-${Math.floor(Math.random() * 9000 + 1000)}`;
    const targetHostId = `rkch-${code.toLowerCase()}-host`;

    return new Promise((resolve, reject) => {
      try {
        const peer = new Peer(guestPeerId, {
          debug: 1
        });

        this.peer = peer;

        peer.on('open', () => {
          const conn = peer.connect(targetHostId, {
            reliable: true
          });
          this.setupDataConnection(conn);
          resolve(true);
        });

        peer.on('call', (call) => {
          this.setupMediaCall(call);
        });

        peer.on('error', (err) => {
          console.warn('PeerJS join error:', err);
          this.events.onError?.('تعذر العثور على الغرفة أو لم يبدأ المضيف بعد');
          reject(err);
        });
      } catch (err: unknown) {
        reject(err);
      }
    });
  }

  // Setup Data Channel Connection
  private setupDataConnection(conn: DataConnection) {
    this.dataConn = conn;

    conn.on('open', () => {
      this.isConnected = true;
      this.remotePeerId = conn.peer;
      this.events.onConnected?.(conn.peer, this.isHost);

      // If we already had mic active, initiate voice call
      if (this.localStream && this.peer) {
        this.startVoiceCall();
      }
    });

    conn.on('data', (data: unknown) => {
      try {
        const msg = data as PeerMessage;
        if (!msg || !msg.type) return;

        switch (msg.type) {
          case 'move':
            this.events.onMoveReceived?.(msg.move);
            break;
          case 'reset':
            this.events.onResetReceived?.();
            break;
          case 'score_update':
            this.events.onScoreReceived?.({ white: msg.white, black: msg.black });
            break;
          case 'reaction':
            this.events.onReactionReceived?.({ emoji: msg.emoji, text: msg.text });
            break;
        }
      } catch (e) {
        console.warn('Failed to parse peer message:', e);
      }
    });

    conn.on('close', () => {
      this.isConnected = false;
      this.events.onDisconnected?.();
    });

    conn.on('error', (err) => {
      console.warn('Data connection error:', err);
    });
  }

  // Send a chess move to peer
  public sendMove(move: GameMovePayload) {
    if (!this.dataConn || !this.isConnected) return;
    this.dataConn.send({ type: 'move', move });
  }

  // Send a reset / rematch request
  public sendReset(hostColor?: 'w' | 'b') {
    if (!this.dataConn || !this.isConnected) return;
    this.dataConn.send({ type: 'reset', hostColor });
  }

  // Send updated score
  public sendScore(white: number, black: number) {
    if (!this.dataConn || !this.isConnected) return;
    this.dataConn.send({ type: 'score_update', white, black });
  }

  // Send emoji reaction
  public sendReaction(emoji: string, text?: string) {
    if (!this.dataConn || !this.isConnected) return;
    this.dataConn.send({ type: 'reaction', emoji, text });
  }

  // WebRTC Voice Chat Methods
  public async toggleMicrophone(onVolumeChange?: (vol: number) => void): Promise<boolean> {
    if (this.isMicActive && this.localStream) {
      // Stop or mute microphone
      this.stopVoice();
      return false;
    } else {
      // Start microphone
      const success = await this.startMicrophone(onVolumeChange);
      return success;
    }
  }

  private async startMicrophone(onVolumeChange?: (vol: number) => void): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.events.onError?.('المتصفح لا يدعم الوصول للميكروفون');
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      this.localStream = stream;
      this.isMicActive = true;

      // Setup audio level analyzer
      this.setupVolumeAnalyzer(stream, onVolumeChange);

      // If connected to remote peer, initiate media call
      if (this.isConnected && this.remotePeerId && this.peer) {
        this.startVoiceCall();
      }

      return true;
    } catch (err: unknown) {
      console.warn('Microphone permission error:', err);
      this.events.onError?.('يرجى منح الإذن للوصول للميكروفون في المتصفح');
      this.isMicActive = false;
      return false;
    }
  }

  private startVoiceCall() {
    if (!this.peer || !this.remotePeerId || !this.localStream) return;
    try {
      const call = this.peer.call(this.remotePeerId, this.localStream);
      this.setupMediaCall(call);
    } catch (e) {
      console.warn('Failed to call remote peer audio:', e);
    }
  }

  private setupMediaCall(call: MediaConnection) {
    this.mediaCall = call;

    if (this.localStream) {
      call.answer(this.localStream);
    } else {
      // Answer even without local audio so we can hear remote peer
      call.answer();
    }

    call.on('stream', (remoteStream) => {
      if (this.remoteAudioEl) {
        this.remoteAudioEl.srcObject = remoteStream;
        this.remoteAudioEl.play().catch(() => {});
      }
      this.events.onRemoteVoiceStream?.(remoteStream);
    });

    call.on('close', () => {
      this.events.onRemoteVoiceEnded?.();
    });

    call.on('error', (err) => {
      console.warn('Voice call error:', err);
    });
  }

  private setupVolumeAnalyzer(stream: MediaStream, onVolumeChange?: (vol: number) => void) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!this.analyser || !this.isMicActive) return;
        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        this.isLocalSpeaking = normalized > 14;
        onVolumeChange?.(normalized);
        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn('Failed to setup volume analyzer:', e);
    }
  }

  public stopVoice() {
    this.isMicActive = false;
    this.isLocalSpeaking = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.mediaCall) {
      this.mediaCall.close();
      this.mediaCall = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  // Complete cleanup
  public disconnect() {
    this.stopVoice();
    if (this.dataConn) {
      this.dataConn.close();
      this.dataConn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isConnected = false;
    this.roomCode = '';
    this.remotePeerId = '';
  }
}

export const peerService = new MultiplayerService();

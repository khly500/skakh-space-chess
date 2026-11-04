import { useEffect, useRef, useState } from 'react';
import CosmicBackground from './components/CosmicBackground';
import { initWizardChess } from './wizardChessEngine.js';
import { soundManager } from './audio/soundManager';
import { peerService, GameMovePayload } from './multiplayer/peerService';
import { ScoreState } from './types';
import {
  Mic,
  MicOff,
  UserPlus,
  RotateCcw,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Users,
  Eye,
  Camera,
  Bot
} from 'lucide-react';

export default function App() {
  const initializedRef = useRef(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Scoreboard State
  const [scores, setScores] = useState<ScoreState>(() => {
    try {
      const saved = localStorage.getItem('rakan_chess_scores');
      return saved ? JSON.parse(saved) : { whiteWins: 0, blackWins: 0, draws: 0 };
    } catch {
      return { whiteWins: 0, blackWins: 0, draws: 0 };
    }
  });

  // Audio SFX state
  const [isAudioMuted, setIsAudioMuted] = useState(soundManager.getMuted());

  // Multiplayer & Voice State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [joinInputCode, setJoinInputCode] = useState('');
  const [isPeerConnected, setIsPeerConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Initialize Wizard Chess Engine
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initWizardChess();

    // Check for ?room= in URL to auto-join
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      const cleanCode = roomParam.trim().toUpperCase();
      setRoomCode(cleanCode);
      setShowInviteModal(true);
      handleJoinRoom(cleanCode);
    }
  }, []);

  // Sync Score Changes to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('rakan_chess_scores', JSON.stringify(scores));
    } catch (e) {
      console.warn('Failed to save score:', e);
    }
  }, [scores]);

  // Hook into wizardChess Engine events
  useEffect(() => {
    const win = window as unknown as {
      wizardChess?: {
        onLocalMoveMade?: (move: GameMovePayload) => void;
        onCheckmateOccurred?: (data: { winner: 'w' | 'b'; defeated: 'w' | 'b' }) => void;
        applyRemoteMove?: (fromR: number, fromC: number, toR: number, toC: number) => boolean;
        resetChessBoard?: (skipCam?: boolean, instant?: boolean) => void;
        setMultiplayerMode?: (isMulti: boolean, side?: 'w' | 'b') => void;
      };
    };

    if (win.wizardChess) {
      // When local player executes a move, transmit over P2P
      win.wizardChess.onLocalMoveMade = (move: GameMovePayload) => {
        if (peerService.isConnected) {
          peerService.sendMove(move);
        }
      };

      // When checkmate occurs, increment winner's scoreboard
      win.wizardChess.onCheckmateOccurred = (data) => {
        setScores((prev) => {
          const next = {
            ...prev,
            whiteWins: data.winner === 'w' ? prev.whiteWins + 1 : prev.whiteWins,
            blackWins: data.winner === 'b' ? prev.blackWins + 1 : prev.blackWins
          };
          if (peerService.isConnected) {
            peerService.sendScore(next.whiteWins, next.blackWins);
          }
          return next;
        });
      };
    }

    // Bind PeerService Events
    peerService.events.onConnected = (remotePeerId, asHost) => {
      setIsPeerConnected(true);
      setStatusNotice('تم الاتصال بالصديق بنجاح! يمكنكما اللعب والتحدث بالصوت مباشرة.');
      const engine = (window as unknown as { wizardChess?: { setMultiplayerMode?: (m: boolean, s?: 'w' | 'b') => void } }).wizardChess;
      if (engine?.setMultiplayerMode) {
        // Host plays as White, Guest plays as Black
        engine.setMultiplayerMode(true, asHost ? 'w' : 'b');
      }
    };

    peerService.events.onDisconnected = () => {
      setIsPeerConnected(false);
      setStatusNotice('انقطع الاتصال بالصديق.');
    };

    peerService.events.onMoveReceived = (move) => {
      const engine = (window as unknown as { wizardChess?: { applyRemoteMove?: (fromR: number, fromC: number, toR: number, toC: number) => boolean } }).wizardChess;
      if (engine?.applyRemoteMove) {
        engine.applyRemoteMove(move.fromR, move.fromC, move.toR, move.toC);
      }
    };

    peerService.events.onResetReceived = () => {
      const engine = (window as unknown as { wizardChess?: { resetChessBoard?: () => void } }).wizardChess;
      if (engine?.resetChessBoard) {
        engine.resetChessBoard();
      }
      setStatusNotice('بدأ الخصم لعبة جديدة.');
    };

    peerService.events.onScoreReceived = (newScores) => {
      setScores((prev) => ({
        ...prev,
        whiteWins: newScores.white,
        blackWins: newScores.black
      }));
    };

    peerService.events.onError = (err) => {
      setStatusNotice(`تنبيه: ${err}`);
    };
  }, []);

  // Keyboard and Window Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileSheetOpen(false);
        setShowInviteModal(false);
      }
    };
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileSheetOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Restore UI handler
  const handleRestoreUI = () => {
    const win = window as unknown as { wizardChess?: { toggleUI?: (force?: boolean) => void } };
    if (win.wizardChess?.toggleUI) {
      win.wizardChess.toggleUI(false);
    } else {
      document.body.classList.remove('cinematic-ui-hidden');
      const btnHide = document.getElementById('btn-hide-ui');
      if (btnHide) btnHide.textContent = 'إخفاء الواجهة [H]';
    }
  };

  // Create Room handler
  const handleCreateRoom = async () => {
    try {
      setStatusNotice('جاري إنشاء غرفة لعب P2P...');
      const code = await peerService.createRoom();
      setRoomCode(code);
      setIsHost(true);
      setShowInviteModal(true);
      setStatusNotice('تم إنشاء الغرفة! شارك الكود أو الرابط مع صديقك.');
    } catch (e) {
      console.warn('Create room failed:', e);
      setStatusNotice('تعذر إنشاء الغرفة، يرجى المحاولة مرة أخرى.');
    }
  };

  // Join Room handler
  const handleJoinRoom = async (codeToJoin?: string) => {
    const code = (codeToJoin || joinInputCode).trim().toUpperCase();
    if (!code) return;
    try {
      setStatusNotice(`جاري الاتصال بالغرفة ${code}...`);
      await peerService.joinRoom(code);
      setRoomCode(code);
      setIsHost(false);
      setStatusNotice(`متصل بالغرفة ${code}. بانتظار بدء اللعب.`);
    } catch (e) {
      console.warn('Join room failed:', e);
      setStatusNotice('تعذر الانضمام للغرفة، تأكد من صحة الكود ووجود المضيف.');
    }
  };

  // Toggle Voice Chat Mic
  const handleToggleMic = async () => {
    const active = await peerService.toggleMicrophone((vol) => {
      setVoiceVolume(vol);
    });
    setIsMicActive(active);
    soundManager.playMicToggle(active);
  };

  // Toggle Audio Mute
  const handleToggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsAudioMuted(muted);
  };

  // Copy Room Link
  const handleCopyLink = () => {
    if (!roomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2400);
    });
  };

  // Copy Room Code
  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2400);
    });
  };

  // Reset Scoreboard
  const handleResetScores = () => {
    const resetState = { whiteWins: 0, blackWins: 0, draws: 0 };
    setScores(resetState);
    if (peerService.isConnected) {
      peerService.sendScore(0, 0);
    }
  };

  return (
    <>
      {/* Deep Space Background with Earth, Atmosphere, Moon, Stars & Solar Lighting */}
      <CosmicBackground />

      {/* 3D Loading Screen */}
      <div id="loading-overlay">
        <div className="loader-title">شطرنج راكان</div>
        <div className="loader-bar-wrap">
          <div className="loader-bar" id="loader-bar"></div>
        </div>
        <div id="loader-text">استدعاء بيئة الفضاء والكواكب والقطع الكريستالية...</div>
      </div>

      {/* Three.js Canvas Container */}
      <div id="canvas-container"></div>

      {/* Mobile Restore UI Button */}
      <button
        type="button"
        className="hud-btn mobile-only-restore-ui"
        id="btn-mobile-show-ui"
        onClick={handleRestoreUI}
        title="إظهار الواجهة"
      >
        <Eye size={15} /> إظهار الواجهة
      </button>

      {/* Floating Top Navigation & Status Bar */}
      <div id="hud-top">
        <div className="hud-group" id="hud-left">
          {/* Neon Title: شطرنج راكان */}
          <div className="brand-pill">
            <span className="brand-title">
              <span className="brand-sparkle">✦</span>
              شطرنج راكان
            </span>
          </div>

          {/* Turn and Mode Status */}
          <div className="status-pill" id="status-pill">
            <span className="turn-dot" id="turn-dot"></span>
            <span id="turn-text">دور الأبيض للتحرك</span>
            <span className="mode-badge" id="mode-badge">تلعب بالقطع البيضاء</span>
          </div>

          {/* Scoreboard (لوحة النتائج) */}
          <div className="scoreboard-pill" title="لوحة نتائج الانتصارات">
            <div className="score-item">
              <span>الأبيض:</span>
              <span className="score-badge white">{scores.whiteWins}</span>
            </div>
            <div className="score-item">
              <span>الأسود:</span>
              <span className="score-badge black">{scores.blackWins}</span>
            </div>
            {scores.draws > 0 && (
              <div className="score-item">
                <span>تعادل:</span>
                <span className="score-badge draw">{scores.draws}</span>
              </div>
            )}
            <button
              className="hud-btn"
              style={{ padding: '2px 8px', fontSize: '0.72rem' }}
              onClick={handleResetScores}
              title="تصفير عداد النتائج"
            >
              تصفير
            </button>
          </div>
        </div>

        {/* Mobile controls toggle */}
        <button
          type="button"
          className={`hud-btn mobile-controls-trigger ${mobileSheetOpen ? 'active' : ''}`}
          id="btn-mobile-controls"
          aria-expanded={mobileSheetOpen}
          aria-controls="hud-right"
          onClick={() => setMobileSheetOpen((prev) => !prev)}
        >
          {mobileSheetOpen ? 'إغلاق' : 'التحكم'}
        </button>

        {/* Mobile Sheet Backdrop */}
        <div
          className={`mobile-sheet-backdrop ${mobileSheetOpen ? 'open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setMobileSheetOpen(false);
          }}
          aria-hidden="true"
        ></div>

        {/* Right HUD: Controls, P2P Multiplayer, Mic, and Views */}
        <div className={`hud-group ${mobileSheetOpen ? 'mobile-sheet-open' : ''}`} id="hud-right">
          <div
            className="mobile-sheet-handle-wrap"
            onClick={(e) => {
              e.stopPropagation();
              setMobileSheetOpen(false);
            }}
            aria-hidden="true"
          >
            <div className="mobile-sheet-handle"></div>
          </div>

          <div className="mobile-sheet-header">
            <span className="mobile-sheet-title">لوحة التحكم</span>
            <button
              type="button"
              className="mobile-sheet-close"
              id="btn-mobile-sheet-close"
              onClick={(e) => {
                e.stopPropagation();
                setMobileSheetOpen(false);
              }}
              aria-label="إغلاق لوحة التحكم"
            >
              إغلاق ✕
            </button>
          </div>

          {/* Multiplayer & Voice Controls */}
          <button
            type="button"
            className={`hud-btn ${isPeerConnected ? 'active' : 'accent-btn'}`}
            onClick={() => {
              if (!roomCode) handleCreateRoom();
              setShowInviteModal(true);
              setMobileSheetOpen(false);
            }}
            title="دعوة صديق للعب المباشر P2P"
          >
            <UserPlus size={15} />
            {isPeerConnected ? 'متصل بصديق' : 'دعوة للعب'}
          </button>

          {/* Voice Chat Button */}
          <button
            type="button"
            className={`hud-btn ${isMicActive ? 'mic-btn-active' : ''}`}
            onClick={handleToggleMic}
            title={isMicActive ? 'كتم المايك' : 'تشغيل المايك للتحدث مع الخصم'}
          >
            {isMicActive ? <Mic size={15} /> : <MicOff size={15} />}
            {isMicActive ? 'المايك يعمل' : 'تشغيل المايك'}
            {isMicActive && (
              <div className="voice-level-bar" title="مستوى الصوت">
                <div
                  className="voice-level-fill"
                  style={{ height: `${Math.max(10, voiceVolume)}%` }}
                ></div>
              </div>
            )}
          </button>

          {/* Sound FX Mute Toggle */}
          <button
            type="button"
            className="hud-btn"
            onClick={handleToggleMute}
            title={isAudioMuted ? 'تشغيل المؤثرات الصوتية' : 'كتم المؤثرات الصوتية'}
          >
            {isAudioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          <div className="hud-divider" aria-hidden="true"></div>

          {/* Standard Game Actions */}
          <button
            className="hud-btn"
            id="btn-side-toggle"
            title="تبديل اللعب بين الأبيض والأسود"
            onClick={() => setMobileSheetOpen(false)}
          >
            اللعب بالأسود
          </button>
          <button
            className="hud-btn"
            id="btn-ai-move"
            title="طلب حركة من الذكاء الاصطناعي فوراً"
            onClick={() => setMobileSheetOpen(false)}
          >
            <Bot size={15} /> حركة الذكاء الاصطناعي
          </button>
          <button
            className="hud-btn"
            id="btn-reset"
            title="بدء لعبة جديدة على الرقعة"
            onClick={() => {
              setMobileSheetOpen(false);
              if (peerService.isConnected) {
                peerService.sendReset();
              }
            }}
          >
            <RotateCcw size={15} /> لعبة جديدة
          </button>

          <div className="hud-divider" aria-hidden="true"></div>

          {/* Camera Views */}
          <button
            className="hud-btn active"
            id="btn-cam-player"
            title="كاميرا منظور اللاعب (انقر للتبديل بين الأبيض والأسود)"
          >
            <Camera size={14} /> منظور اللاعب
          </button>
          <button
            className="hud-btn"
            id="btn-cam-top"
            title="منظور علوي مباشر للرقعة"
          >
            من الأعلى
          </button>
          <button
            className="hud-btn"
            id="btn-cam-side"
            title="منظور جانبي للرقعة"
          >
            جانبي
          </button>
          <button
            className="hud-btn"
            id="btn-cam-wide"
            title="بانوراما الفضاء الكوني الواسع"
          >
            بانوراما الفضاء
          </button>

          <div className="hud-divider" aria-hidden="true"></div>

          {/* Hide UI */}
          <button
            className="hud-btn"
            id="btn-hide-ui"
            title="إخفاء الواجهة لمشاهدة سينمائية (اختصار: H)"
            onClick={() => setMobileSheetOpen(false)}
          >
            إخفاء الواجهة [H]
          </button>
        </div>
      </div>

      {/* Bottom Information and Hints Bar */}
      <div id="hud-bottom">
        <div className="hint-pill" id="controls-hint">
          <strong>التحكم:</strong> انقر على أي قطعة لإضاءة حركاتها &nbsp;•&nbsp; سحب بالزر الأيسر: تدوير الرؤية &nbsp;•&nbsp; سحب بالأيمن: إزاحة &nbsp;•&nbsp; عجلة الفأرة: تقريب &nbsp;•&nbsp; H: إخفاء الواجهة
        </div>
        <div className="captured-pill" id="captured-tray"></div>
      </div>

      {/* P2P Multiplayer & Voice Invite Modal */}
      {showInviteModal && (
        <div className="modal-backdrop" onClick={() => setShowInviteModal(false)}>
          <div className="p2p-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Users size={20} className="text-cyan-400" />
                <span>اللعب الجماعي والمحادثة الصوتية (P2P)</span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowInviteModal(false)}
                aria-label="إغلاق النافذة"
              >
                ✕
              </button>
            </div>

            {/* Room code section */}
            <div className="p2p-section">
              <div className="p2p-label">كود الغرفة الخاصة بك (شارك الكود مع صديقك):</div>
              <div className="room-code-display">
                <span className="room-code-text">{roomCode || 'جاري الإنشاء...'}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="copy-btn" onClick={handleCopyCode} title="نسخ الكود">
                    {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                    {copiedCode ? 'تم النسخ!' : 'نسخ الكود'}
                  </button>
                  <button className="copy-btn" onClick={handleCopyLink} title="نسخ رابط الدعوة المباشر">
                    {copiedLink ? <Check size={14} /> : <UserPlus size={14} />}
                    {copiedLink ? 'تم نسخ الرابط!' : 'نسخ الرابط'}
                  </button>
                </div>
              </div>
            </div>

            {/* Join Room section */}
            <div className="p2p-section">
              <div className="p2p-label">أو أدخل كود غرفة صديقك للانضمام:</div>
              <div className="p2p-input-row">
                <input
                  type="text"
                  className="p2p-input"
                  placeholder="مثال: RK-AB12"
                  value={joinInputCode}
                  onChange={(e) => setJoinInputCode(e.target.value.toUpperCase())}
                />
                <button
                  type="button"
                  className="p2p-join-btn"
                  onClick={() => handleJoinRoom()}
                >
                  انضمام
                </button>
              </div>
            </div>

            {/* Connection Status Box */}
            <div className="p2p-status-box">
              <div
                className={`status-indicator ${
                  isPeerConnected ? 'connected' : roomCode ? 'waiting' : 'disconnected'
                }`}
              ></div>
              <div>
                {isPeerConnected ? (
                  <span>
                    متصل بالصديق عبر اتصال Peer-to-Peer مباشر. أنت تلعب كـ{' '}
                    <strong>{isHost ? 'القطع البيضاء' : 'القطع السوداء'}</strong>.
                  </span>
                ) : roomCode ? (
                  <span>في انتظار انضمام الصديق عبر الكود أو الرابط...</span>
                ) : (
                  <span>جاهز لإنشاء غرفة أو الانضمام.</span>
                )}
              </div>
            </div>

            {/* Voice chat hint */}
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: '1.5' }}>
              💡 <strong>المحادثة الصوتية:</strong> يمكنك النقر على زر <strong>تشغيل المايك</strong> أعلى الشاشة لبث صوتك مباشرة إلى صديقك أثناء اللعب في أي وقت.
            </div>

            {statusNotice && (
              <div style={{ fontSize: '0.82rem', color: 'var(--neon-cyan)', textAlign: 'center' }}>
                {statusNotice}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkmate & Victory Overlay */}
      <div id="checkmate-overlay" role="status" aria-live="polite">
        <div className="checkmate-card">
          <div className="checkmate-crown" id="checkmate-crown">♔</div>
          <div className="checkmate-title" id="checkmate-title">كش مـــات!</div>
          <div className="checkmate-subtitle" id="checkmate-subtitle">
            القطع البيضاء تنتصر • سقط الملك الأسود
          </div>
          <div className="checkmate-actions">
            <button
              className="checkmate-btn-main"
              id="btn-checkmate-newgame"
              onClick={() => {
                const win = window as unknown as { wizardChess?: { resetChessBoard?: () => void } };
                if (win.wizardChess?.resetChessBoard) {
                  win.wizardChess.resetChessBoard();
                }
                const overlay = document.getElementById('checkmate-overlay');
                if (overlay) overlay.classList.remove('visible');
              }}
            >
              بدء جولة جديدة
            </button>
            <button
              className="hud-btn"
              id="btn-checkmate-dismiss"
              onClick={() => {
                const overlay = document.getElementById('checkmate-overlay');
                if (overlay) overlay.classList.remove('visible');
              }}
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

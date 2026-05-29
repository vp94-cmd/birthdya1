import { useState, useEffect, useCallback } from 'react';
import TrollSequence from './components/TrollSequence';
import MainBirthdayScreen from './components/MainBirthdayScreen';
import AdminPanel from './components/AdminPanel';

// ── Crash-safe audio initialisation ──────────────────────────────────────────
let _audio: HTMLAudioElement;
try {
  _audio = new Audio('/troll.mp3');
  _audio.loop = false;
  _audio.preload = 'auto';

  _audio.addEventListener('error', () => {
    if (_audio.src.endsWith('troll.mp3')) {
      _audio.src = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
      _audio.play().catch(() => {});
    }
  });
} catch (e) {
  console.warn('[App] Audio API unavailable, using no-op fallback.', e);
  _audio = {
    play: () => Promise.resolve(),
    pause: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    get paused() { return true; },
    currentTime: 0,
    volume: 1,
    loop: false,
    preload: 'auto',
    src: '',
  } as unknown as HTMLAudioElement;
}

export const globalAudio = _audio;

// ── Route helpers ─────────────────────────────────────────────────────────────
function isAdminRoute(): boolean {
  try {
    const pathname = window.location.pathname;
    const hash = window.location.hash;
    const isAdminPath = pathname === '/admin' || pathname.endsWith('/admin');
    const isAdminHash = hash === '#admin';
    console.log('[App] Route check:', { pathname, hash, isAdminPath, isAdminHash });
    return isAdminPath || isAdminHash;
  } catch (e) {
    console.error('[App] isAdminRoute error:', e);
    return false;
  }
}

export default function App() {
  const [showMain, setShowMain] = useState(() => {
    const adminRoute = isAdminRoute();
    if (adminRoute) return true;
    try {
      return localStorage.getItem('chaarYaarSequenceDone') === 'true';
    } catch {
      return false;
    }
  });

  const [adminOpen, setAdminOpen] = useState(() => isAdminRoute());
  const [adminTaps, setAdminTaps] = useState(0);

  const playAudio = useCallback((forceRestart = false, timestamp = 0) => {
    if (forceRestart) {
      globalAudio.currentTime = timestamp;
    }
    if (globalAudio.paused) {
      globalAudio.volume = 1.0;
      globalAudio.play().catch(e => console.log('[App] Audio play error:', e));
    } else if (forceRestart) {
      globalAudio.currentTime = timestamp;
    }
  }, []);

  useEffect(() => {
    const checkAdminRoute = () => {
      try {
        if (isAdminRoute()) {
          console.log('[App] Admin route detected, opening admin panel');
          setShowMain(true);
          setAdminOpen(true);
        } else {
          setAdminOpen(false);
        }
      } catch (e) {
        console.error('[App] checkAdminRoute error:', e);
      }
    };

    checkAdminRoute();

    window.addEventListener('popstate', checkAdminRoute);
    window.addEventListener('hashchange', checkAdminRoute);

    try {
      const savedTheme = localStorage.getItem('chaarYaarTheme');
      if (savedTheme === 'retro') {
        document.documentElement.setAttribute('data-theme', 'retro');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    } catch (e) {
      console.warn('[App] Could not read theme from localStorage:', e);
    }

    const handleStorage = () => {
      try {
        const theme = localStorage.getItem('chaarYaarTheme');
        if (theme === 'retro') {
          document.documentElement.setAttribute('data-theme', 'retro');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      } catch (e) {
        console.warn('[App] Storage event handler error:', e);
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('themeUpdated', handleStorage);

    return () => {
      window.removeEventListener('popstate', checkAdminRoute);
      window.removeEventListener('hashchange', checkAdminRoute);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('themeUpdated', handleStorage);
    };
  }, []);

  const handleFooterTap = () => {
    const newTaps = adminTaps + 1;
    setAdminTaps(newTaps);
    if (newTaps >= 5) {
      console.log('[App] Admin panel unlocked via tap sequence');
      setAdminOpen(true);
      setAdminTaps(0);
    }
  };

  const handleSequenceComplete = () => {
    try {
      localStorage.setItem('chaarYaarSequenceDone', 'true');
    } catch (e) {
      console.warn('[App] Could not persist sequence state:', e);
    }
    setShowMain(true);
  };

  return (
    <div className="min-h-screen aurora-bg font-sans text-slate-100 overflow-x-hidden relative selection:bg-cyan-500/30">
      {!showMain ? (
        <TrollSequence onComplete={handleSequenceComplete} onPlayAudio={playAudio} />
      ) : (
        <>
          <MainBirthdayScreen adminOpen={adminOpen} onPlayAudio={playAudio} />

          {/* Invisible Admin Footer Tap Zone – requires 5 taps */}
          <div className="fixed bottom-0 right-2 p-4 z-40 pointer-events-auto">
            <button
              onClick={handleFooterTap}
              className="px-4 py-3 opacity-0 cursor-default"
              title="Admin Access"
              aria-label="Admin Access"
            >
              <div className="w-1 h-1 bg-transparent" />
            </button>
          </div>

          {/* Admin Panel */}
          <AdminPanel isOpen={adminOpen} onClose={() => setAdminOpen(false)} />
        </>
      )}
    </div>
  );
}

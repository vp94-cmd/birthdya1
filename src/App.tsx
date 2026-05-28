import { useState, useEffect, useCallback } from 'react';
import TrollSequence from './components/TrollSequence';
import MainBirthdayScreen from './components/MainBirthdayScreen';
import AdminPanel from './components/AdminPanel';

// A singleton audio instance to ensure seamless playback across component unmounts/remounts
export const globalAudio = new Audio('/troll.mp3');
globalAudio.loop = false;
globalAudio.preload = 'auto';

globalAudio.addEventListener('error', () => {
  // Fallback if local file fails (e.g. 0 bytes or not found)
  if (globalAudio.src.endsWith('troll.mp3')) {
    globalAudio.src = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
    globalAudio.play().catch(() => {});
  }
});

// Check if accessing admin route
function isAdminRoute(): boolean {
  const pathname = window.location.pathname;
  const hash = window.location.hash;
  const isAdminPath = pathname === '/admin' || pathname.endsWith('/admin');
  const isAdminHash = hash === '#admin';
  console.log('Route check:', { pathname, hash, isAdminPath, isAdminHash });
  return isAdminPath || isAdminHash;
}

export default function App() {
  const [showMain, setShowMain] = useState(() => {
    const adminRoute = isAdminRoute();
    if (adminRoute) return true;
    return localStorage.getItem('chaarYaarSequenceDone') === 'true';
  });
  
  const [adminOpen, setAdminOpen] = useState(() => {
    return isAdminRoute();
  });
  
  const [adminTaps, setAdminTaps] = useState(0);

  const playAudio = useCallback((forceRestart = false, timestamp = 0) => {
    if (forceRestart) {
      globalAudio.currentTime = timestamp;
    }
    if (globalAudio.paused) {
      globalAudio.volume = 1.0;
      globalAudio.play().catch(e => console.log('Audio error:', e));
    } else if (forceRestart) {
      globalAudio.currentTime = timestamp;
    }
  }, []);

  useEffect(() => {
    const checkAdminRoute = () => {
      if (isAdminRoute()) {
        console.log('Admin route detected, opening admin panel');
        setShowMain(true);
        setAdminOpen(true);
      } else {
        setAdminOpen(false);
      }
    };
    
    // Check on mount
    checkAdminRoute();
    
    // Listen for route changes
    window.addEventListener('popstate', checkAdminRoute);
    window.addEventListener('hashchange', checkAdminRoute);
    
    // Initialize theme from storage
    const savedTheme = localStorage.getItem('chaarYaarTheme');
    if (savedTheme === 'retro') {
      document.documentElement.setAttribute('data-theme', 'retro');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    
    const handleStorage = () => {
      const theme = localStorage.getItem('chaarYaarTheme');
      if (theme === 'retro') {
        document.documentElement.setAttribute('data-theme', 'retro');
      } else {
        document.documentElement.removeAttribute('data-theme');
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
      setAdminOpen(true);
      setAdminTaps(0);
    }
  };

  const handleSequenceComplete = () => {
    localStorage.setItem('chaarYaarSequenceDone', 'true');
    setShowMain(true);
  };

  return (
    <div className="min-h-screen aurora-bg font-sans text-slate-100 overflow-x-hidden relative selection:bg-cyan-500/30">
      {!showMain ? (
        <TrollSequence onComplete={handleSequenceComplete} onPlayAudio={playAudio} />
      ) : (
        <>
          <MainBirthdayScreen adminOpen={adminOpen} onPlayAudio={playAudio} />
          
          {/* Subtle Admin Footer Link - Requires 5 Taps */}
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
          
          {/* Admin Panel - Always rendered when adminOpen is true */}
          <AdminPanel isOpen={adminOpen} onClose={() => setAdminOpen(false)} />
        </>
      )}
    </div>
  );
}

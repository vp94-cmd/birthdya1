import { useState, useEffect, useCallback } from 'react';
import TrollSequence from '../components/TrollSequence';
import MainBirthdayScreen from '../components/MainBirthdayScreen';
import { globalAudio } from '../App';

export default function HomePage() {
  const [showMain, setShowMain] = useState(() => {
    try {
      return localStorage.getItem('chaarYaarSequenceDone') === 'true';
    } catch {
      return false;
    }
  });

  const playAudio = useCallback((forceRestart = false, timestamp = 0) => {
    if (forceRestart) {
      globalAudio.currentTime = timestamp;
    }
    if (globalAudio.paused) {
      globalAudio.volume = 1.0;
      globalAudio.play().catch(() => {});
    } else if (forceRestart) {
      globalAudio.currentTime = timestamp;
    }
  }, []);

  const handleSequenceComplete = () => {
    try {
      localStorage.setItem('chaarYaarSequenceDone', 'true');
    } catch (e) {
      console.warn('[HomePage] Could not persist sequence state:', e);
    }
    setShowMain(true);
  };

  return (
    <div className="min-h-screen aurora-bg font-sans text-slate-100 overflow-x-hidden relative selection:bg-cyan-500/30">
      {!showMain ? (
        <TrollSequence onComplete={handleSequenceComplete} onPlayAudio={playAudio} />
      ) : (
        <MainBirthdayScreen adminOpen={false} onPlayAudio={playAudio} />
      )}
    </div>
  );
}

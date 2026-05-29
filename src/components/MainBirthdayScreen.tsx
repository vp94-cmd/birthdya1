import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QrCode, X, Sparkles, Share2, AlertTriangle } from 'lucide-react';
import { BirthdayPerson, Sender, PolaroidImage, defaultBirthdayPerson, defaultSenders, defaultPolaroids } from '../types';
import TiltCard from './TiltCard';
import ConfettiCanvas from './ConfettiCanvas';
import MouseTrail from './MouseTrail';
import PolaroidPile from './PolaroidPile';
import { globalStateManager } from '../lib/globalStateManager';
import { globalAudio } from '../App';

export default function MainBirthdayScreen({ adminOpen, onPlayAudio }: { adminOpen: boolean, onPlayAudio?: (forceRestart?: boolean, timestamp?: number) => void }) {
  const [person, setPerson] = useState<BirthdayPerson>(() => {
    const saved = localStorage.getItem('chaarYaarPerson');
    return saved ? JSON.parse(saved) : defaultBirthdayPerson;
  });
  
  const [senders, setSenders] = useState<Sender[]>(() => {
    const saved = localStorage.getItem('chaarYaarSenders');
    return saved ? JSON.parse(saved) : defaultSenders;
  });

  const [polaroids, setPolaroids] = useState<PolaroidImage[]>(() => {
    const saved = localStorage.getItem('chaarYaarPolaroids');
    return saved ? JSON.parse(saved) : defaultPolaroids;
  });
  
  const [qrOpen, setQrOpen] = useState(false);

  // Age Counter
  const [ageDisplay, setAgeDisplay] = useState({ years: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calcAge = () => {
      try {
        const cleaned = person.birthDate.replace(/(\d+)(st|nd|rd|th)/, "$1");
        const now = new Date();
        let birth = new Date(cleaned + " " + now.getFullYear());
        if (isNaN(birth.getTime())) return;
        if (birth > now) birth.setFullYear(now.getFullYear() - 1);
        const diff = now.getTime() - birth.getTime();
        const years   = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
        const days    = Math.floor((diff % (365.25 * 24 * 3600 * 1000)) / (24 * 3600 * 1000));
        const hours   = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
        const minutes = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
        const seconds = Math.floor((diff % (60 * 1000)) / 1000);
        setAgeDisplay({ years, days, hours, minutes, seconds });
      } catch (_) {}
    };
    calcAge();
    const t = setInterval(calcAge, 1000);
    return () => clearInterval(t);
  }, [person.birthDate]);

  // Share handler
  const handleShare = () => {
    const text = "Happy Birthday " + person.name + "! 🎉 Aao isko wish karo 👇";
    const url  = window.location.href;
    if (navigator.share) {
      navigator.share({ title: "Happy Birthday " + person.name + "!", text, url }).catch(() => {});
    } else {
      window.open("https://wa.me/?text=" + encodeURIComponent(text + "\n" + url), "_blank");
    }
  };

  const [revealState, setRevealState] = useState<'waiting' | 'glitching' | 'revealed'>(() => {
    const time = globalAudio.currentTime;
    if (time >= 30.0 || globalAudio.paused) return 'revealed';
    if (time >= 29.5) return 'glitching';
    return 'waiting';
  });
  const [glitchTime, setGlitchTime] = useState(0);

  // Load initial config from API if available (for server-side deployment)
  useEffect(() => {
    fetch('/api/config')
      .then(r => { if (!r.ok) throw new Error('api_unavailable'); return r.json(); })
      .then(data => {
        if (data.person) {
          setPerson(data.person);
          localStorage.setItem('chaarYaarPerson', JSON.stringify(data.person));
        }
        if (data.senders) {
          setSenders(data.senders);
          localStorage.setItem('chaarYaarSenders', JSON.stringify(data.senders));
        }
        if (data.polaroids) {
          setPolaroids(data.polaroids);
          localStorage.setItem('chaarYaarPolaroids', JSON.stringify(data.polaroids));
        }
        if (data.theme) {
          localStorage.setItem('chaarYaarTheme', data.theme);
          if (data.theme === 'retro') {
            document.documentElement.setAttribute('data-theme', 'retro');
          } else {
            document.documentElement.removeAttribute('data-theme');
          }
        }
      })
      .catch(() => {
        // API not available - that's fine, we'll use localStorage defaults
        console.debug('API config endpoint not available (expected for static deployments)');
      });
  }, []);

  // Subscribe to global state changes for real-time sync
  useEffect(() => {
    const unsubscribePerson = globalStateManager.subscribe('person', (data) => {
      setPerson(data);
    });
    const unsubscribeSenders = globalStateManager.subscribe('senders', (data) => {
      setSenders(data);
    });
    const unsubscribePolaroids = globalStateManager.subscribe('polaroids', (data) => {
      setPolaroids(data);
    });
    const unsubscribeTheme = globalStateManager.subscribe('theme', (data) => {
      if (data === 'retro') {
        document.documentElement.setAttribute('data-theme', 'retro');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    });

    return () => {
      unsubscribePerson();
      unsubscribeSenders();
      unsubscribePolaroids();
      unsubscribeTheme();
    };
  }, []);

  // Legacy event listeners for backward compatibility
  useEffect(() => {
    const handleStorage = () => {
      const savedPerson = localStorage.getItem('chaarYaarPerson');
      if (savedPerson) setPerson(JSON.parse(savedPerson));
      
      const savedSenders = localStorage.getItem('chaarYaarSenders');
      if (savedSenders) setSenders(JSON.parse(savedSenders));

      const savedPolaroids = localStorage.getItem('chaarYaarPolaroids');
      if (savedPolaroids) setPolaroids(JSON.parse(savedPolaroids));
    };
    
    window.addEventListener('storage', handleStorage);
    window.addEventListener('friendsUpdated', handleStorage);
    window.addEventListener('polaroidsUpdated', handleStorage);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('friendsUpdated', handleStorage);
      window.removeEventListener('polaroidsUpdated', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (revealState === 'revealed') return;

    const interval = setInterval(() => {
      const time = globalAudio.currentTime;
      setGlitchTime(time);
      
      if (time >= 30.0) {
        setRevealState('revealed');
        clearInterval(interval);
      } else if (time >= 29.5 && revealState === 'waiting') {
        setRevealState('glitching');
      }
    }, 50);

    const fallback = setTimeout(() => {
      setRevealState('revealed');
    }, 4000);

    return () => {
      clearInterval(interval);
      clearTimeout(fallback);
    };
  }, [revealState]);

  useEffect(() => {
    if (onPlayAudio) {
      const forcePlay = () => onPlayAudio(false);
      
      document.addEventListener('click', forcePlay);
      document.addEventListener('touchstart', forcePlay, { passive: true });
      
      return () => {
        document.removeEventListener('click', forcePlay);
        document.removeEventListener('touchstart', forcePlay);
      };
    }
  }, [onPlayAudio]);

  return (
    <AnimatePresence>
      {revealState !== 'revealed' ? (
      <motion.div
        key="glitch-screen"
        exit={{ opacity: 0, scale: 1.5, filter: "blur(20px)" }}
        transition={{ duration: 0.5, ease: "easeIn" }}
        className="fixed inset-0 min-h-screen bg-slate-950 flex flex-col items-center justify-center z-50 overflow-hidden"
      >
        <div className="absolute inset-0 bg-red-900/10 mix-blend-overlay pointer-events-none" />
        
        {revealState === 'glitching' ? (
          <motion.div
             animate={{
                 opacity: [0.8, 1, 0.4, 0.9, 1, 0.2, 1],
                 x: [0, -15, 15, -5, 10, -8, 0],
                 y: [0, 5, -10, 15, -5, 10, 0],
                 scale: [1, 1.05, 0.95, 1.1, 0.9, 1.08, 1],
                 filter: [
                   "invert(0%) hue-rotate(0deg) contrast(1)", 
                   "invert(20%) hue-rotate(90deg) contrast(2)", 
                   "invert(0%) hue-rotate(-90deg) contrast(1.5)", 
                   "invert(10%) hue-rotate(180deg) brightness(2)",
                   "invert(0%) hue-rotate(0deg) contrast(1)", 
                 ]
             }}
             transition={{ duration: 0.3, repeat: Infinity, repeatType: "mirror" }}
             className="relative z-10 flex flex-col items-center justify-center text-center p-8 border border-red-500/50 shadow-[0_0_100px_rgba(239,68,68,0.5)] bg-black/60 backdrop-blur-md rounded-2xl"
          >
            <AlertTriangle className="w-20 h-20 text-red-500 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500 uppercase tracking-widest break-all mb-4">
              FATAL OVERLOAD
            </h1>
            <p className="text-lg md:text-xl font-mono text-red-400">
              INITIATING CORE DUMP...
            </p>
            <div className="mt-8 font-mono text-xs md:text-sm text-red-400/80 w-full text-left bg-black/80 p-4 border border-red-500/30 rounded-lg whitespace-pre-wrap">
              {`> ERROR: 0x000000F4 MEMORY_CORRUPTION\n> COMPONENT: TrollSequence.tsx\n> TIME_OFFSET: ${glitchTime.toFixed(3)}s\n> ATTEMPTING RECOVERY TO SECTOR 7G...\n> WAIT...`}
            </div>
          </motion.div>
        ) : (
          <div className="relative z-10 w-[90%] max-w-lg text-left font-mono">
             <p className="text-sm md:text-base text-green-400/80 m-0">{'Connecting to secure mainframe...'}</p>
             <p className="text-sm md:text-base text-green-400/80 m-0">{'Establishing handshake... OK'}</p>
             <p className="text-sm md:text-base text-green-400/80 m-0">{'Validating integrity bypass... SUCCESS'}</p>
             <p className="text-sm md:text-base text-green-400/80 m-0 mt-4 animate-pulse">{'Finalizing payload drop...'}</p>
          </div>
        )}
      </motion.div>

      ) : (

      <motion.div 
        key="main-screen"
        initial={{ opacity: 0, filter: "brightness(2) contrast(1.5)" }} 
        animate={{ opacity: 1, filter: "brightness(1) contrast(1)" }} 
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full min-h-screen flex flex-col items-center py-12 px-4 md:px-8 pointer-events-auto overflow-x-hidden"
      >
        <MouseTrail />
        <ConfettiCanvas />
      
        <div className="w-full max-w-4xl flex flex-col items-center">
          {/* Main Birthday Spotlight Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="w-full mb-16"
          >
            <TiltCard>
              <div className="glass-panel neon-border flex flex-col items-center justify-center p-8 md:p-14 text-center relative overflow-hidden rounded-2xl w-full">
                <Sparkles className="absolute top-6 right-6 w-8 h-8 text-cyan-400 opacity-60 animate-pulse" />
                <Sparkles className="absolute bottom-6 left-6 w-6 h-6 text-fuchsia-400 opacity-60 animate-pulse" />
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1, duration: 1 }}
                  className="inline-block px-5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs md:text-sm text-cyan-300 font-mono tracking-widest uppercase mb-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                >
                  ⭐ {person.birthDate} ⭐
                </motion.div>
                
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-8 drop-shadow-[0_0_40px_rgba(6,182,212,0.5)]">
                  Happy Birthday,<br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-indigo-400 filter drop-shadow-lg">
                    {person.name}
                  </span>!
                </h1>
                
                <div className="w-full max-w-2xl bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]">
                  <p className="text-lg md:text-xl text-indigo-50 font-medium leading-relaxed">
                    "{person.roastMessage}"
                  </p>
                </div>
              </div>
            </TiltCard>
          </motion.div>

          {/* Senders Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="w-full"
          >
            <h3 className="text-center text-xs md:text-sm text-slate-300 mb-8 uppercase tracking-[0.2em] font-semibold flex items-center justify-center gap-3 md:gap-4">
              <span className="h-px bg-gradient-to-r from-transparent to-slate-500 w-12 md:w-24 block" />
              Wishes from Chaar Yaar
              <span className="h-px bg-gradient-to-l from-transparent to-slate-500 w-12 md:w-24 block" />
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {senders.map((sender, idx) => (
                <motion.div 
                  key={sender.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 1.5 + (idx * 0.2) }}
                >
                  <div className="h-full relative overflow-hidden rounded-2xl glass-panel p-6 hover:bg-white/[0.05] transition-all duration-300 group shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500/0 via-cyan-400/80 to-fuchsia-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <h4 className="text-lg font-bold text-white tracking-wide mb-4 flex items-center justify-between">
                      {sender.name}
                      {sender.special === 'CS' && <span className="text-[10px] bg-green-900/40 text-green-400 px-2 py-1 rounded font-mono border border-green-500/30">ADMIN</span>}
                    </h4>
                    
                    {sender.special === 'CS' ? (
                      <div className="font-mono text-green-400 bg-black/80 p-4 rounded-lg text-xs w-full shadow-[inset_0_0_15px_rgba(0,0,0,1)] border border-green-500/20 leading-relaxed group-hover:shadow-[inset_0_0_20px_rgba(34,197,94,0.1)] transition-shadow">
                        <div className="text-slate-500 mb-1"># root@chaar-yaar:~</div>
                        <span className="text-slate-500">$</span> {sender.message.split('\n')[0]}
                        {sender.message.split('\n')[1] && (
                          <>
                            <br/>
                            <span className="text-slate-500">$</span> {sender.message.split('\n')[1]}
                          </>
                        )}
                        <span className="animate-pulse ml-1 bg-green-500 w-1.5 h-3.5 inline-block align-middle" />
                      </div>
                    ) : (
                      <p className="text-slate-300 text-sm leading-relaxed font-medium">
                        "{sender.message}"
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Polaroid Pile Section */}
          <PolaroidPile images={polaroids} />

          {/* Age Counter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.0, duration: 0.8 }}
            className="w-full mt-8 mb-4"
          >
            <div className="glass-panel neon-border rounded-2xl p-6 text-center">
              <p className="text-xs font-mono uppercase tracking-widest text-cyan-400/70 mb-3">
                ⏱ {person.name} is officially...
              </p>
              <div className="flex justify-center gap-3 md:gap-6 flex-wrap">
                {[
                  { val: ageDisplay.years,   label: "Saal" },
                  { val: ageDisplay.days,    label: "Din" },
                  { val: ageDisplay.hours,   label: "Ghante" },
                  { val: ageDisplay.minutes, label: "Minute" },
                  { val: ageDisplay.seconds, label: "Second" },
                ].map(({ val, label }) => (
                  <div key={label} className="flex flex-col items-center">
                    <span className="text-2xl md:text-4xl font-extrabold text-white tabular-nums drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]">
                      {String(val).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] md:text-xs text-cyan-300/60 font-mono uppercase tracking-wider mt-1">{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3 font-mono">...ka ho gaya! Aur ek second bhi waste kar diya 😂</p>
            </div>
          </motion.div>

          {/* Buttons Row — QR + Share */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5, duration: 1 }}
            className="mt-8 flex items-center justify-center gap-4 w-full flex-wrap"
          >
            <button
              onClick={() => setQrOpen(true)}
              className="group flex items-center gap-3 px-8 py-4 glass-panel hover:bg-white/10 rounded-full text-white transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
            >
              <QrCode className="w-5 h-5 text-cyan-400 group-hover:text-fuchsia-400 transition-colors" />
              <span className="tracking-wide text-sm font-bold uppercase">Prank Code</span>
            </button>
            <button
              onClick={handleShare}
              className="group flex items-center gap-3 px-8 py-4 glass-panel hover:bg-white/10 rounded-full text-white transition-all shadow-[0_0_20px_rgba(192,38,211,0.2)] hover:shadow-[0_0_30px_rgba(192,38,211,0.4)]"
            >
              <Share2 className="w-5 h-5 text-fuchsia-400 group-hover:text-cyan-400 transition-colors" />
              <span className="tracking-wide text-sm font-bold uppercase">Dosto Ko Bhejo</span>
            </button>
          </motion.div>
        </div>

        <AnimatePresence>
          {qrOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="glass-panel neon-border p-8 rounded-3xl max-w-sm w-full relative flex flex-col items-center"
              >
                <button 
                  onClick={() => setQrOpen(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-2"
                >
                  <X className="w-6 h-6" />
                </button>
                
                <h2 className="text-2xl font-bold text-white mb-8 tracking-tight">Scan for Surprise</h2>
                <div className="bg-white p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.href)}`} 
                    alt="QR Code to Live URL" 
                    className="w-56 h-56"
                  />
                </div>
                <p className="text-cyan-200/80 mt-8 text-sm text-center leading-relaxed font-medium">
                  Point your camera at this QR code to trigger the Birthday Protocol on mobile.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </motion.div>
        )}
      </AnimatePresence>
    );
  }

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Flame, Mic, XCircle } from 'lucide-react';

export default function TrollSequence({ onComplete, onPlayAudio }: { onComplete: () => void, onPlayAudio: () => void }) {
  const [phase, setPhase] = useState<'candle' | 'aukaat' | 'teleport' | 'alerts' | 'terminal' | 'glitch'>('candle');
  
  // -- Candle State
  const [isListening, setIsListening] = useState(false);
  const [isBlown, setIsBlown] = useState(false);
  const [micError, setMicError] = useState('');
  const [showSkip, setShowSkip] = useState(false);
  const reqAnimFrameRef = useRef<number>(0);
  const flameRef = useRef<HTMLDivElement>(null);
  
  // -- Aukaat State
  const [wish, setWish] = useState('');
  const [showAukaatModal, setShowAukaatModal] = useState(false);

  // -- Teleport State
  const [btnPos, setBtnPos] = useState({ x: 0, y: 0 });
  const [teleportMsg, setTeleportMsg] = useState('Touch Here');
  const [teleportActive, setTeleportActive] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // -- Alert State
  const [alertIndex, setAlertIndex] = useState(0);
  const fakeAlerts = [
    { title: "SYSTEM COMPROMISED", msg: "Security bypassed successfully!!" },
    { title: "ACCESSING", msg: "Extracting WhatsApp chats..." },
    { title: "SUCCESS", msg: "Sending to relatives... 100% Done!" }
  ];

  // -- Terminal State
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const birthdayBoy = localStorage.getItem('birthdayPerson') || 'Chotu';

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === 'candle') {
      timer = setTimeout(() => {
        setShowSkip(true);
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [phase]);

  // --- CANDLE LOGIC ---
  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextCtor();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      setIsListening(true);
      setMicError('');

      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
           sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // When a loud noise is detected (e.g. blowing)
        if (flameRef.current && !isBlown) {
          const scale = Math.max(0.1, 1 - (average / 70));
          flameRef.current.style.transform = `scale(${scale})`;
          flameRef.current.style.opacity = `${scale}`;
        }

        if (average > 80 && !isBlown) {
           stream.getTracks().forEach(track => track.stop());
           audioContext.close();
           setIsBlown(true);
           setTimeout(() => {
             setPhase('aukaat');
           }, 2000);
        } else {
           reqAnimFrameRef.current = requestAnimationFrame(checkAudio);
        }
      };
      checkAudio();

    } catch (err) {
      setMicError('Mic allow kar bhai, warna aage nahi jayega!');
    }
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(reqAnimFrameRef.current);
    };
  }, []);

  // --- AUKAAT LOGIC ---
  const handleWishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wish.trim()) return;
    setShowAukaatModal(true);
  };

  const closeAukaatModal = () => {
    setShowAukaatModal(false);
    setPhase('teleport');
  };

  // --- TELEPORT LOGIC ---
  useEffect(() => {
    if (phase === 'teleport') {
      const timer = setTimeout(() => {
        setTeleportActive(false);
        setTeleportMsg("Thak gaya? Chal ab touch karle.");
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [phase]);

  const handleEvade = () => {
    if (!teleportActive) return;
    
    const msgs = [
      "Abe nalle, touch kar!",
      "Thak gaya kya?",
      "Itna slow?!",
      "Bhai tujhse ek button daba nahi ja raha?",
      "Pakad ke dikha gadhe!",
      "Touch phone chalana nahi aata kya?"
    ];
    setTeleportMsg(msgs[Math.floor(Math.random() * msgs.length)]);
    
    setBtnPos(prev => {
      const maxX = (window.innerWidth / 2) - 100;
      const maxY = (window.innerHeight / 2) - 60;
      
      let newX = 0;
      let newY = 0;
      
      // Ensure the button moves a noticeable distance
      for (let i = 0; i < 15; i++) {
        newX = (Math.random() * 2 - 1) * maxX;
        newY = (Math.random() * 2 - 1) * maxY;
        
        const dist = Math.hypot(newX - prev.x, newY - prev.y);
        if (dist > 150) break;
      }
      
      return { x: newX, y: newY };
    });
  };

  const handleTeleportClick = () => {
    if (teleportActive) return;
    onPlayAudio(); // Start trolling audio!
    setPhase('alerts');
    
    // --- 30 SECOND AUDIO SYNC MASTER TIMELINE ---
    // The audio drop occurs at 30 seconds. We force phase transitions to perfectly align.
    
    // (1) Max 12 seconds allowed in alerts phase. Auto-force to terminal if they are slow.
    setTimeout(() => setPhase(p => p === 'alerts' ? 'terminal' : p), 12000);
    
    // (2) Hand over to MainBirthdayScreen earlier (around 28s) so it can sync the final glitch
    setTimeout(() => onComplete(), 28000);
  };

  // --- ALERTS LOGIC ---
  const nextAlert = () => {
    if (alertIndex < fakeAlerts.length - 1) {
      setAlertIndex(prev => prev + 1);
    } else {
      setPhase('terminal');
    }
  };

  // --- TERMINAL & GLITCH LOGIC ---
  useEffect(() => {
    if (phase === 'terminal') {
      const parsedPerson = JSON.parse(localStorage.getItem('chaarYaarPerson') || '{}');
     const targetName = parsedPerson?.name || person?.name;
      
      const lines = [
        "Scanning for noob...",
        `Target locked: [${targetName}]`,
        "Bypassing security firewalls...",
        "Accessing mainframes...",
        "Extracting embarrassing photos...",
        "Analyzing cringe levels...",
        "WARNING: Cringe overflow detected!!",
        "Executing Birthday Wish Protocol...",
        "Deploying final payload in 3...",
        "2...",
        "1..."
      ];
      
      const timeouts: NodeJS.Timeout[] = [];
      let delay = 500;
      
      lines.forEach((line, index) => {
        const to = setTimeout(() => {
          setTerminalLines(prev => [...prev, line]);
        }, delay);
        timeouts.push(to);
        // Gradually speed up text output
        delay += (1600 - (index * 120)); 
      });

      return () => timeouts.forEach(clearTimeout);
    }
  }, [phase, birthdayBoy]);

  // Remove the old glitch phase auto-complete, as it's now handled by the master timeline
  useEffect(() => {
    if (phase === 'glitch') {
      // The master timeline handles onComplete now for perfect audio sync
    }
  }, [phase]);

  return (
    <>
      <AnimatePresence>
        {/* PHASE 1: CANDLE */}
        {phase === 'candle' && (
          <motion.div exit={{ opacity: 0 }} className="fixed inset-0 min-h-screen bg-slate-950 flex flex-col items-center justify-center z-50 p-4">
             <div className="absolute inset-0 aurora-bg opacity-30 pointer-events-none" />
             <div className="glass-panel neon-border p-8 rounded-3xl max-w-sm w-full flex flex-col items-center text-center z-10">
               <div className="relative w-48 h-48 mb-6 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(244,63,94,0.3)] border-2 border-rose-500/30">
                 <motion.img 
                   src="https://images.unsplash.com/photo-1558636508-e0db3814bd1d?q=80&w=400&fit=crop"
                   alt="Birthday Cake"
                   className="w-full h-full object-cover transition-all duration-1000"
                   style={{
                     filter: isBlown ? 'brightness(0.3) grayscale(0.8)' : 'brightness(1.1) contrast(1.1)',
                   }}
                 />
                 
                 {/* Fake animated flame glow overlay that dims when blown */}
                 <motion.div 
                   ref={flameRef}
                   animate={isBlown ? { opacity: 0 } : { opacity: [0.3, 0.6, 0.3] }}
                   transition={{ repeat: Infinity, duration: 1.5 }}
                   className="absolute inset-0 bg-gradient-to-t from-transparent via-orange-500/20 to-orange-500/60 mix-blend-overlay pointer-events-none"
                 />

                 {/* Smoke particles when blown */}
                 <AnimatePresence>
                   {isBlown && (
                     <>
                       {[...Array(6)].map((_, i) => (
                         <motion.div
                           key={`smoke-${i}`}
                           initial={{ opacity: 0, y: '20%', scale: 0.5, x: '-50%' }}
                           animate={{ 
                             opacity: [0, 0.6, 0], 
                             y: ['20%', '-100%'],
                             scale: [0.5, 2.5],
                             x: ['-50%', `${(Math.random() - 0.5) * 80 - 50}%`]
                           }}
                           transition={{ duration: 1.5, delay: i * 0.15, ease: 'easeOut' }}
                           className="absolute top-[40%] left-[50%] w-8 h-8 bg-gray-300 rounded-full blur-md mix-blend-screen pointer-events-none"
                         />
                       ))}
                     </>
                   )}
                 </AnimatePresence>
               </div>
               <h2 className="text-2xl font-bold text-white mb-4">Candle Blow</h2>
               <p className="text-cyan-200/80 mb-8 font-medium">Mic access allow kar aur candle bujhane ke liye phook maar!</p>
               
               {!isListening ? (
                 <button 
                   onClick={startMic}
                   className="w-full py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center justify-center gap-3 transition-colors shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                 >
                   <Mic className="w-5 h-5" /> Allow Mic
                 </button>
               ) : (
                 <div className="w-full py-4 rounded-xl glass-panel text-white font-bold animate-pulse text-center border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)] flex items-center justify-center gap-2">
                   <Mic className="w-5 h-5 text-rose-500" /> Listening... Phook Maar!
                 </div>
               )}
               {micError && <p className="text-red-400 text-sm mt-4 font-bold">{micError}</p>}
               
               <AnimatePresence>
                 {showSkip && (
                   <motion.button 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 10 }}
                     onClick={() => {
                       cancelAnimationFrame(reqAnimFrameRef.current);
                       setPhase('aukaat');
                     }}
                     className="mt-6 text-xs text-slate-500 hover:text-slate-300 transition-colors underline decoration-slate-700 underline-offset-4"
                   >
                     Skip Mic / Blocked?
                   </motion.button>
                 )}
               </AnimatePresence>
             </div>
          </motion.div>
        )}

        {/* PHASE 2: AUKAAT TROLL */}
        {phase === 'aukaat' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 min-h-screen bg-slate-950 flex flex-col items-center justify-center z-50 p-4">
             <div className="absolute inset-0 aurora-bg opacity-30 pointer-events-none" />
             
             <div className="glass-panel neon-border p-8 rounded-3xl max-w-md w-full flex flex-col z-10 relative">
                <h2 className="text-2xl md:text-3xl font-extrabold text-cyan-400 mb-2 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">Make a Wish!</h2>
                <p className="text-slate-300 mb-8 font-medium">Toh bata, tera birthday wish kya hai?</p>
                
                <form onSubmit={handleWishSubmit} className="flex flex-col gap-4 relative">
                  <input 
                    type="text" 
                    value={wish}
                    onChange={(e) => setWish(e.target.value)}
                    placeholder="Type anything..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                  <button type="submit" className="w-full py-4 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold transition-colors shadow-[0_0_20px_rgba(192,38,211,0.5)]">
                    Submit Wish
                  </button>
                </form>

                {/* Custom Modal */}
                <AnimatePresence>
                  {showAukaatModal && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
                    >
                      <div className="glass-panel border-rose-500/50 border-2 p-6 rounded-2xl w-full max-w-xs text-center shadow-[0_0_40px_rgba(244,63,94,0.4)] bg-slate-900">
                        <XCircle className="w-16 h-16 text-rose-500 mx-auto mb-4 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
                        <h3 className="text-2xl font-bold text-white mb-2">Error 404</h3>
                        <p className="text-rose-200 font-medium text-lg mb-8 tracking-wide">Ye toh teri aukaat se bahar hai ! 😂</p>
                        <button onClick={closeAukaatModal} className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-colors">
                          Close
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </motion.div>
        )}

        {/* PHASE 3: TELEPORT BUTTON */}
        {phase === 'teleport' && (
          <motion.div ref={containerRef} exit={{ opacity: 0 }} className="fixed inset-0 min-h-screen bg-slate-950 flex flex-col items-center justify-center z-50 overflow-hidden px-4">
             <div className="absolute inset-0 aurora-bg opacity-30 pointer-events-none" />
             <h2 className="text-2xl md:text-3xl text-cyan-400 font-bold mb-16 text-center z-10 filter drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">{teleportMsg}</h2>
             <motion.button
               animate={{ x: btnPos.x, y: btnPos.y }}
               transition={{ type: "spring", stiffness: 400, damping: 25 }}
               onMouseEnter={handleEvade}
               onTouchStart={(e) => { 
                 if (teleportActive) {
                   e.preventDefault(); 
                   handleEvade(); 
                 }
               }}
               onClick={handleTeleportClick}
               className={`px-8 py-4 rounded-full font-bold text-lg md:text-xl transition-colors z-10 glass-panel neon-border ${teleportActive ? 'text-cyan-400 cursor-none' : 'text-fuchsia-400 animate-pulse'}`}
             >
                Touch Here
             </motion.button>
          </motion.div>
        )}

        {/* PHASE 4: GLITCH & ALERTS */}
        {phase === 'alerts' && (
          <motion.div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
             {/* Heavy Background visual glitch mapping to the Audio start */}
             <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize:"150px 150px"}} />
             <motion.div 
               animate={{ 
                 x: [-10, 10, -5, 20, 0],
                 opacity: [0.8, 1, 0.4, 0.9, 0.7]
               }}
               transition={{ duration: 0.1, repeat: Infinity, repeatType: 'reverse' }}
               className="absolute inset-0 bg-fuchsia-700/20 mix-blend-screen pointer-events-none"
             />
             <motion.div 
               animate={{ 
                 x: [10, -10, 5, -20, 0],
                 opacity: [0.6, 0.9, 0.3, 1, 0.5]
               }}
               transition={{ duration: 0.12, repeat: Infinity, repeatType: 'reverse' }}
               className="absolute inset-0 bg-cyan-700/20 mix-blend-screen pointer-events-none"
             />
             
             <motion.div 
               key={alertIndex}
               initial={{ scale: 0.8, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               className="glass-panel neon-border rounded-xl p-6 w-full max-w-sm text-center relative overflow-hidden z-10 bg-slate-900"
             >
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />
                <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
                <h3 className="text-xl font-extrabold text-white mb-2 tracking-wide text-red-500">{fakeAlerts[alertIndex].title}</h3>
                <p className="text-rose-200 mb-8 font-medium text-lg leading-relaxed">{fakeAlerts[alertIndex].msg}</p>
                <button onClick={nextAlert} className="w-full bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-white font-bold py-3 rounded-lg transition-colors drop-shadow">
                   OKAY :(
                </button>
             </motion.div>
          </motion.div>
        )}

        {/* PHASE 5: TERMINAL */}
        {phase === 'terminal' && (
          <motion.div 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black text-green-500 font-mono z-50 flex flex-col p-6 items-center justify-center shadow-[inset_0_0_100px_rgba(34,197,94,0.2)]"
          >
             <div className="w-full max-w-lg">
               <div className="mb-4 text-xs opacity-50">&gt; terminal initialized... [100%]</div>
               {terminalLines.map((line, idx) => (
                 <motion.p 
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   key={idx} 
                   className="text-base md:text-xl text-green-400 mb-3"
                 >
                   &gt; {line}
                 </motion.p>
               ))}
               <span className="animate-pulse text-green-500 inline-block mt-2 font-bold text-lg w-3 h-5 bg-green-500 align-middle shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
             </div>
          </motion.div>
        )}

        {/* PHASE 6: FINAL GLITCH */}
        {phase === 'glitch' && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="fixed inset-0 z-[100] pointer-events-none"
          >
            <div className="absolute inset-0 bg-black" />
            <motion.div 
              animate={{ 
                x: [-20, 20, -10, 40, 0],
                y: [10, -20, 30, -10, 0],
                opacity: [1, 0.5, 0.8, 0, 1]
              }}
              transition={{ duration: 0.15, repeat: Infinity, repeatType: 'reverse' }}
              className="absolute inset-0 bg-fuchsia-600 mix-blend-screen"
            />
            <motion.div 
              animate={{ 
                x: [30, -30, 20, -40, 0],
                y: [-20, 30, -10, 20, 0],
                opacity: [0.8, 1, 0, 1, 0.5]
              }}
              transition={{ duration: 0.2, repeat: Infinity, repeatType: 'reverse' }}
              className="absolute inset-0 bg-cyan-600 mix-blend-screen"
            />
            <div className="absolute inset-0 opacity-70 mix-blend-overlay" style={{backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize:"150px 150px"}} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

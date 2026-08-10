import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { globalAudio } from '../App';
import { globalStateManager } from '../lib/globalStateManager';

// ── Court Sound Engine ────────────────────────────────────────────────────────
function useCourtSounds(muted: boolean) {
  const ctx = useRef<AudioContext | null>(null);

  const getCtx = () => {
    if (!ctx.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) ctx.current = new AC();
    }
    return ctx.current;
  };

  const play = useCallback((type: 'gavel' | 'reveal' | 'charge' | 'verdict' | 'tap') => {
    if (muted) return;
    const c = getCtx();
    if (!c) return;

    const now = c.currentTime;

    const osc  = (freq: number, type: OscillatorType, start: number, end: number, gain: number, dur: number) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, now + start);
      o.frequency.exponentialRampToValueAtTime(end, now + start + dur);
      g.gain.setValueAtTime(gain, now + start);
      g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      o.connect(g); g.connect(c.destination);
      o.start(now + start); o.stop(now + start + dur + 0.05);
    };

    if (type === 'gavel') {
      // Deep wooden thud — two hits
      osc(120, 'sawtooth', 0,    25,  0.6, 0.18);
      osc(80,  'sine',     0,    30,  0.4, 0.25);
      osc(120, 'sawtooth', 0.35, 25,  0.5, 0.18);
      osc(80,  'sine',     0.35, 30,  0.35, 0.25);
    } else if (type === 'reveal') {
      // Rising dramatic sting
      osc(200, 'sine', 0, 600, 0.3, 0.4);
      osc(300, 'sine', 0.1, 800, 0.2, 0.4);
      osc(150, 'triangle', 0, 400, 0.15, 0.5);
    } else if (type === 'charge') {
      // Tense low tone
      osc(100, 'sawtooth', 0, 80, 0.25, 0.3);
      osc(150, 'square',   0, 100, 0.1, 0.2);
    } else if (type === 'verdict') {
      // Big dramatic fanfare
      [0, 0.12, 0.25, 0.4].forEach((t, i) => {
        const freqs = [220, 280, 350, 440];
        osc(freqs[i], 'sine', t, freqs[i] * 1.5, 0.35, 0.5);
      });
      osc(110, 'sawtooth', 0, 80, 0.3, 0.8);
    } else if (type === 'tap') {
      osc(400, 'sine', 0, 300, 0.15, 0.12);
    }
  }, [muted]);

  return play;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Charge {
  id: string;
  year: string;
  crime: string;
  evidence: string;
  severity: 'Minor' | 'Serious' | 'Heinous';
}

interface CourtMember {
  role: 'Judge' | 'Sarkari Vakeel' | 'Bachav Vakeel' | 'Gawah';
  name: string;
  verdict?: string;
}

interface ChaarYaarCourtProps {
  birthdayName: string;
  charges?: Charge[];
  members?: CourtMember[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────
const defaultCharges: Charge[] = [
  { id: 'c1', year: '2022', crime: 'Pizza khake bill se bhaag gaya', evidence: 'Teeno gawahon ne dekha, CCTV footage bhi hai', severity: 'Heinous' },
  { id: 'c2', year: '2021', crime: 'Group project mein "10 minute mein aata hoon" bolke 3 ghante baad aaya', evidence: 'WhatsApp read receipts pe blue tick the', severity: 'Serious' },
  { id: 'c3', year: '2023', crime: 'Doston ki photo Instagram pe bina permission ke post kar diya', evidence: 'Screenshot saved hai aaj bhi', severity: 'Minor' },
  { id: 'c4', year: '2020', crime: 'Cinema mein popcorn khatam hone ke baad dosto ka khata raha', evidence: '3 gawah aur ek khali tub', severity: 'Heinous' },
];

const defaultMembers: CourtMember[] = [
  { role: 'Judge',         name: 'Hon. Justice Bade Bhai',  verdict: 'Dost rehne ki saza — life imprisonment! 😂' },
  { role: 'Sarkari Vakeel', name: 'Adv. Ashish',             verdict: 'Mulzim clearly guilty hai, milord!' },
  { role: 'Bachav Vakeel', name: 'Adv. Rohit',               verdict: 'Mera client bewakoof hai, par dil ka achha hai.' },
  { role: 'Gawah',         name: 'Aditya',                   verdict: 'Maine apni aankho se dekha tha, milord. 100%.' },
];

const VERDICTS = [
  'DOSHI PAYA GAYA! Saza: Sabko treat dena hoga. 🍕',
  'BAIL DENIED! Seedha jail. Do not pass Go. ⛓️',
  'LIFE IMPRISONMENT — dosti mein! Escape nahi hai. 😂',
  'FINE lagaya gaya: 1 mahine ki chai ki duty! ☕',
  'COMMUNITY SERVICE: Sabka homework karo ek hafte. 📚',
  'GUILTY on all counts. Par maafi milti hai kyunki birthday hai. 🎂',
];

const severityStyle: Record<Charge['severity'], string> = {
  Minor:   'text-yellow-400 border-yellow-500/40 bg-yellow-900/20',
  Serious: 'text-orange-400 border-orange-500/40 bg-orange-900/20',
  Heinous: 'text-red-400   border-red-500/40    bg-red-900/20',
};

const roleIcon: Record<CourtMember['role'], string> = {
  'Judge':          '⚖️',
  'Sarkari Vakeel': '🔴',
  'Bachav Vakeel':  '🟢',
  'Gawah':          '👁️',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChaarYaarCourt({
  birthdayName,
}: { birthdayName: string }) {
  const [muted, setMuted] = useState(false);

  const [charges, setCharges] = useState<Charge[]>(() => {
    try {
      const s = localStorage.getItem('chaarYaarCourt');
      if (s) { const d = JSON.parse(s); if (d.charges?.length) return d.charges; }
    } catch (_) {}
    return defaultCharges;
  });

  const [members, setMembers] = useState<CourtMember[]>(() => {
    try {
      const s = localStorage.getItem('chaarYaarCourt');
      if (s) { const d = JSON.parse(s); if (d.members?.length) return d.members; }
    } catch (_) {}
    return defaultMembers;
  });

  useEffect(() => {
    const unsub = globalStateManager.subscribe('court', (data: any) => {
      if (data?.charges) setCharges(data.charges);
      if (data?.members) setMembers(data.members);
    });
    return unsub;
  }, []);
  const [phase, setPhase]       = useState<'intro' | 'charges' | 'members' | 'verdict'>('intro');
  const [activeCharge, setActiveCharge]   = useState(0);
  const [hammerSlam, setHammerSlam]       = useState(false);
  const [revealedMembers, setRevealedMembers] = useState<number[]>([]);
  const [finalVerdict]          = useState(() => VERDICTS[Math.floor(Math.random() * VERDICTS.length)]);

  const playSound = useCourtSounds(muted);

  // Mute toggle also silences / restores the global bg music
  const toggleMute = () => {
    setMuted(m => {
      const next = !m;
      globalAudio.volume = next ? 0 : 1;
      return next;
    });
  };

  const slamAndGo = (next: typeof phase) => {
    playSound('gavel');
    setHammerSlam(true);
    setTimeout(() => { setHammerSlam(false); setPhase(next); }, 650);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full mt-12 mb-4"
    >
      {/* ── Header ── */}
      <div className="text-center mb-6 relative">
        {/* Mute toggle — top right of header */}
        <button
          onClick={toggleMute}
          title={muted ? 'Sound on karo' : 'Sound band karo'}
          className="absolute right-0 top-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-xs font-mono text-slate-400 hover:text-white"
        >
          <motion.span
            key={muted ? 'off' : 'on'}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-base leading-none"
          >
            {muted ? '🔇' : '🔊'}
          </motion.span>
          <span className="hidden sm:inline">{muted ? 'Sound Off' : 'Sound On'}</span>
        </button>

        <motion.div
          animate={{ rotate: [0, -3, 3, -2, 2, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          className="text-4xl mb-2"
        >
          ⚖️
        </motion.div>
        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
          Chaar Yaar{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
            Adalat
          </span>
        </h2>
        <p className="text-slate-400 text-sm mt-1 font-mono">
          Mulzim: {birthdayName} • Case No. 420/2026
        </p>
      </div>

      {/* ── Court Panel ── */}
      <div className="glass-panel neon-border rounded-2xl overflow-hidden">
        {/* top bar */}
        <div className="bg-gradient-to-r from-yellow-900/40 via-amber-900/30 to-yellow-900/40 border-b border-yellow-500/20 px-6 py-3 flex items-center justify-between">
          <span className="text-yellow-400 font-mono text-xs uppercase tracking-widest">
            🔨 Adalat Session — Live
          </span>
          <span className="text-yellow-600 font-mono text-xs">
            {new Date().toLocaleDateString('en-IN')}
          </span>
        </div>

        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait">

            {/* ── PHASE 1: INTRO ── */}
            {phase === 'intro' && (
              <motion.div key="intro"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -40 }}
                className="flex flex-col items-center text-center gap-6"
              >
                <div className="text-6xl animate-bounce">🏛️</div>
                <div className="space-y-2">
                  <p className="text-white font-bold text-xl">Mananiya Adalat mein aapka swagat hai!</p>
                  <p className="text-slate-400 text-sm leading-relaxed max-w-md">
                    Aaj is paavan din pe,{' '}
                    <span className="text-yellow-400 font-semibold">{birthdayName}</span> ke khilaf{' '}
                    <span className="text-red-400 font-semibold">{charges.length} sangeen ilzaam</span>{' '}
                    lagaye gaye hain. Adalat sunegi, faisle sunayegi.
                  </p>
                  <p className="text-slate-500 text-xs font-mono mt-2">
                    "Sachchi dosti mein roast zaroori hai" — Chaar Yaar Constitution, Article 1
                  </p>
                </div>

                {/* Sound hint */}
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                  className="text-[11px] text-slate-600 font-mono flex items-center gap-1"
                >
                  {muted
                    ? <><span>🔇</span> Sound band hai — upar se on karo full experience ke liye</>
                    : <><span>🔊</span> Sound on hai — headphones lagao aur maze lo!</>}
                </motion.p>

                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                  onClick={() => slamAndGo('charges')}
                  className="px-8 py-4 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all"
                >
                  🔨 Sunwai Shuru Karo
                </motion.button>
              </motion.div>
            )}

            {/* ── PHASE 2: CHARGES ── */}
            {phase === 'charges' && (
              <motion.div key="charges"
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                className="space-y-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-bold text-lg">📋 Ilzaam Naama</h3>
                  <span className="text-slate-500 text-xs font-mono">{activeCharge + 1} / {charges.length}</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"
                    animate={{ width: `${((activeCharge + 1) / charges.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={activeCharge}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                    className="bg-black/40 border border-white/10 rounded-xl p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-slate-500 text-xs font-mono">
                          Ilzaam #{activeCharge + 1} • {charges[activeCharge].year}
                        </span>
                        <p className="text-white font-semibold text-base mt-1 leading-snug">
                          "{charges[activeCharge].crime}"
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded border whitespace-nowrap ${severityStyle[charges[activeCharge].severity]}`}>
                        {charges[activeCharge].severity}
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-lg px-4 py-2 border border-white/5">
                      <span className="text-slate-500 text-[10px] font-mono uppercase">Saboot:</span>
                      <p className="text-slate-300 text-sm mt-0.5">{charges[activeCharge].evidence}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div className="flex gap-3 justify-between pt-2">
                  {activeCharge > 0 ? (
                    <button onClick={() => { playSound('tap'); setActiveCharge(c => c - 1); }}
                      className="px-4 py-2 text-slate-400 hover:text-white border border-white/10 rounded-lg text-sm transition-colors">
                      ← Pichla
                    </button>
                  ) : <div />}

                  {activeCharge < charges.length - 1 ? (
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => { playSound('charge'); setActiveCharge(c => c + 1); }}
                      className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm font-semibold transition-colors">
                      Agla Ilzaam →
                    </motion.button>
                  ) : (
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => slamAndGo('members')}
                      className="px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg text-sm font-black uppercase tracking-wide">
                      🔨 Sunwai Jari Rakho
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── PHASE 3: MEMBERS ── */}
            {phase === 'members' && (
              <motion.div key="members"
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                className="space-y-4"
              >
                <h3 className="text-white font-bold text-lg mb-4">🏛️ Adalat ke Sadsya</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {members.map((member, idx) => {
                    const isRevealed = revealedMembers.includes(idx);
                    return (
                      <motion.button key={idx}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => {
                          if (!isRevealed) {
                            playSound('reveal');
                            setRevealedMembers(prev => [...prev, idx]);
                          }
                        }}
                        className={`text-left p-4 rounded-xl border transition-all duration-300 ${
                          isRevealed
                            ? 'bg-white/8 border-white/20'
                            : 'bg-white/3 border-white/8 hover:border-yellow-500/40 hover:bg-yellow-900/10 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{roleIcon[member.role]}</span>
                          <div>
                            <p className="text-white font-semibold text-sm">{member.name}</p>
                            <p className="text-slate-500 text-[11px] font-mono">{member.role}</p>
                          </div>
                        </div>
                        <AnimatePresence>
                          {isRevealed ? (
                            <motion.p
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="text-slate-300 text-xs italic leading-relaxed mt-1"
                            >
                              "{member.verdict}"
                            </motion.p>
                          ) : (
                            <p className="text-yellow-600/60 text-xs font-mono animate-pulse">
                              👆 Tap to reveal statement
                            </p>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>

                {revealedMembers.length === members.length && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center pt-3"
                  >
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                      onClick={() => slamAndGo('verdict')}
                      className="px-8 py-4 bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-[0_0_25px_rgba(239,68,68,0.4)] transition-all"
                    >
                      🔨 Final Verdict Sunao!
                    </motion.button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── PHASE 4: VERDICT ── */}
            {phase === 'verdict' && (
              <motion.div key="verdict"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', bounce: 0.4 }}
                onAnimationComplete={() => playSound('verdict')}
                className="flex flex-col items-center text-center gap-5 py-4"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, -8, 8, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-6xl"
                >
                  🔨
                </motion.div>

                <div className="space-y-2">
                  <p className="text-yellow-400 font-mono text-xs uppercase tracking-widest">
                    — Adalat ka Antim Faisla —
                  </p>
                  <h3 className="text-white font-black text-2xl md:text-3xl leading-tight">
                    {birthdayName} ko...
                  </h3>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-red-950/60 border border-red-500/40 rounded-xl px-6 py-4 max-w-sm mx-auto"
                  >
                    <p className="text-red-200 font-bold text-lg leading-snug">{finalVerdict}</p>
                  </motion.div>
                </div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                  className="text-slate-500 text-xs font-mono max-w-xs leading-relaxed"
                >
                  Yeh faisla Chaar Yaar Adalat ki taraf se sunaya gaya. Is faisle ke khilaf koi
                  appeal nahi hogi. Tum sab ek doosre ke dost ho — koi court nahi badal sakti. 🤝
                </motion.div>

                <motion.button
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
                  whileHover={{ scale: 1.03 }}
                  onClick={() => { setPhase('intro'); setActiveCharge(0); setRevealedMembers([]); }}
                  className="px-6 py-3 border border-white/15 hover:border-white/30 text-slate-400 hover:text-white rounded-xl text-sm transition-all font-mono"
                >
                  🔄 Naya Case File Karo
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── Gavel Slam Overlay ── */}
      <AnimatePresence>
        {hammerSlam && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.3, rotate: -45, y: -100 }}
              animate={{ scale: 1.5, rotate: 0, y: 0 }}
              exit={{ scale: 3, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
              className="text-[8rem] drop-shadow-[0_0_40px_rgba(234,179,8,0.8)]"
            >
              🔨
            </motion.div>
            {/* shockwave ring */}
            <motion.div
              initial={{ scale: 0, opacity: 0.6 }}
              animate={{ scale: 4, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute w-32 h-32 rounded-full border-4 border-yellow-400/60"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

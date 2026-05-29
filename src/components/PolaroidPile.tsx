import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useInView, PanInfo, useMotionValue, useTransform, animate } from 'motion/react';
import { PolaroidImage } from '../types';

const playPopSound = (pitch = 150) => {
  try {
    const ACtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!ACtx) return;
    const ctx = new ACtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (_) {}
};

// ─── Simple preview card used only during the portal drop phase ──────────────
function DropCard({
  image,
  index,
  total,
  targetX,
  targetY,
  onLanded,
}: {
  image: PolaroidImage;
  index: number;
  total: number;
  targetX: number;
  targetY: number;
  onLanded?: () => void;
}) {
  // Each card flies in from a slightly different x so you can see them individually
  const startX = targetX + (index - Math.floor(total / 2)) * 50;
  const startRotate = (index - Math.floor(total / 2)) * 18;
  // Final resting rotation in the stack
  const endRotate   = (index - Math.floor(total / 2)) * 5;
  // Stack offset so cards look piled, not merged
  const endY = targetY + index * 6;
  const endX = targetX + index * 4;

  // Width/height to match the real card (w-48 h-56 → 192×224, md:w-64 md:h-72 → 256×288)
  const w = window.innerWidth >= 768 ? 256 : 192;
  const h = window.innerWidth >= 768 ? 288 : 224;

  return (
    <motion.div
      initial={{ x: startX - w / 2, y: -320, rotate: startRotate, opacity: 0, scale: 1.15 }}
      animate={{ x: endX - w / 2, y: endY - h / 2, rotate: endRotate, opacity: 1, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 52,
        damping: 10,
        delay: index * 0.28,
        restDelta: 0.5,
      }}
      onAnimationComplete={index === total - 1 ? onLanded : undefined}
      style={{
        position: 'absolute',
        width: w,
        height: h,
        zIndex: index,
      }}
    >
      {/* Polaroid look */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#fff',
          padding: window.innerWidth >= 768 ? '12px 12px 32px' : '8px 8px 24px',
          boxShadow: '0 30px 60px -10px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.4)',
          borderRadius: 2,
          border: '1px solid #e5e7eb',
          boxSizing: 'border-box',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            flex: 1,
            backgroundImage: `url(${image.url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#cbd5e1',
          }}
        />
        <p
          style={{
            fontFamily: 'sans-serif',
            fontSize: 11,
            color: '#374151',
            textAlign: 'center',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {image.caption}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Interactive card in the settled pile ─────────────────────────────────────
function PolaroidCard({
  image, index, stackLength, activeId, setActiveId,
  hasEntered, handleDragEnd, handleDrag, dragProgress,
}: any) {
  const isSelected  = activeId === image.id;
  const isTop       = index === stackLength - 1;
  const visualIndex = stackLength - 1 - index;
  const [isFlipped, setIsFlipped] = useState(false);

  const restRotate  = useRef((visualIndex % 2 === 0 ? -1 : 1) * visualIndex * 3).current;
  const yOffset     = isSelected ? 0 : visualIndex * 15;
  const scaleOffset = isSelected ? 1.25 : Math.max(0.8, 1 - visualIndex * 0.05);
  const opacityVal  = visualIndex > 4 ? 0 : 1;

  const innerScale = useTransform(dragProgress, (p: number) => {
    if (isTop || isSelected) return 1;
    const base   = Math.max(0.8, 1 - visualIndex * 0.05);
    const target = Math.max(0.8, 1 - Math.max(0, visualIndex - p) * 0.05);
    return target / base;
  });
  const innerY = useTransform(dragProgress, (p: number) => {
    if (isTop || isSelected) return 0;
    return -p * 15;
  });

  const driftAnimation = (!isSelected && !isTop && hasEntered)
    ? {
        x: [0, (Math.random() - 0.5) * 4, 0],
        y: [0, (Math.random() - 0.5) * 4, 0],
        transition: { duration: 4 + Math.random() * 2, repeat: Infinity, repeatType: 'reverse' as const, ease: 'easeInOut' },
      }
    : {};

  useEffect(() => { if (!isSelected) setIsFlipped(false); }, [isSelected]);

  const handleCardClick = () => {
    if (isSelected) {
      playPopSound(isFlipped ? 100 : 220);
      setIsFlipped(f => !f);
    } else if (isTop) {
      playPopSound(200);
      setActiveId(image.id);
    }
  };

  return (
    <motion.div
      // Cards enter already in their resting position (no re-drop after portal)
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: opacityVal, y: yOffset, scale: scaleOffset, rotate: isSelected ? 0 : restRotate }}
      transition={isSelected ? { type: 'spring', stiffness: 220, damping: 26 } : { type: 'spring', stiffness: 180, damping: 22 }}
      style={{ position: 'absolute', transformOrigin: 'bottom center', zIndex: isSelected ? 100 : index }}
      className="pointer-events-auto"
    >
      <motion.div
        drag={isTop && !isSelected}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.2}
        dragMomentum
        onDrag={handleDrag}
        whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
        onDragStart={() => playPopSound(250)}
        onDragEnd={(e, info) => handleDragEnd(e, info, image.id)}
        onClick={handleCardClick}
        animate={driftAnimation}
        style={(!isTop && !isSelected) ? { scale: innerScale, y: innerY } : {}}
        className="bg-white p-2 pb-6 md:p-3 md:pb-8 shadow-xl rounded-sm border border-gray-200 w-48 h-56 md:w-64 md:h-72 flex flex-col items-center justify-between touch-none cursor-grab active:cursor-grabbing"
      >
        <div className="w-full h-full relative" style={{ perspective: '800px', transformStyle: 'preserve-3d' }}>
          <motion.div
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', position: 'relative' }}
          >
            {/* FRONT */}
            <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', position: 'absolute', inset: 0 }} className="flex flex-col items-center justify-between">
              <div
                className="w-full flex-1 bg-slate-200 border border-black/10 overflow-hidden bg-cover bg-center mb-2"
                style={{
                  backgroundImage: `url(${image.url})`,
                  filter: isSelected ? 'none' : (isTop ? 'grayscale(10%)' : 'grayscale(50%) contrast(1.1) sepia(20%)'),
                  transition: 'filter 0.4s ease',
                }}
              />
              <span className="font-sans text-gray-800 text-xs md:text-sm font-medium transform -rotate-1 truncate max-w-full pointer-events-none">{image.caption}</span>
              {isSelected && image.roastBack && (
                <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-indigo-400 font-medium mt-1 pointer-events-none">
                  👆 Tap to flip!
                </motion.span>
              )}
            </div>

            {/* BACK */}
            <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }} className="flex flex-col items-center justify-center bg-amber-50 border border-amber-200 rounded-sm p-3 text-center">
              <span className="text-2xl mb-2">💬</span>
              <p className="text-gray-700 text-xs md:text-sm font-medium leading-snug italic">"{image.roastBack || 'Koi message nahi hai abhi 😅'}"</p>
              <span className="text-[10px] text-amber-500 mt-2 font-medium">👆 Tap to flip back</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function PolaroidPile({ images }: { images: PolaroidImage[] }) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId]         = useState<string | null>(null);
  const [hasEntered, setHasEntered]     = useState(false);
  // 'idle' → section not yet seen
  // 'dropping' → portal drop animation running
  // 'done' → pile is interactive
  const [phase, setPhase]               = useState<'idle' | 'dropping' | 'done'>('idle');
  const [pileCenter, setPileCenter]     = useState({ x: 0, y: 0 });
  const isInView = useInView(containerRef, { once: true, margin: '0px 0px -10% 0px' });
  const dragProgress = useMotionValue(0);
  const [stack, setStack]               = useState<PolaroidImage[]>([]);

  useEffect(() => {
    if (images && images.length > 0 && stack.length === 0) {
      setStack([...images].reverse());
    }
  }, [images]);

  // Trigger the portal drop when section enters viewport
  useEffect(() => {
    if (isInView && phase === 'idle' && stack.length > 0 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPileCenter({
        x: rect.left + rect.width / 2,
        y: rect.top  + rect.height / 2,
      });
      setPhase('dropping');
    }
  }, [isInView, phase, stack.length]);

  if (!images || images.length === 0) return null;

  const handleDrag = (_: any, info: PanInfo) => {
    dragProgress.set(Math.min(1, Math.sqrt(info.offset.x ** 2 + info.offset.y ** 2) / 100));
  };

  const handleDragEnd = (_: any, info: PanInfo, imageId: string) => {
    animate(dragProgress, 0, { type: 'spring', bounce: 0.3 });
    if (Math.abs(info.offset.x) > 100 || Math.abs(info.offset.y) > 100) {
      playPopSound(150);
      setStack(prev => {
        const next = [...prev];
        const i = next.findIndex(img => img.id === imageId);
        if (i !== -1) { const [r] = next.splice(i, 1); next.unshift(r); }
        return next;
      });
    } else {
      playPopSound(100);
    }
  };

  const handleAllLanded = () => {
    // Short pause so user appreciates the pile, then reveal interactive version
    setTimeout(() => {
      setPhase('done');
      setHasEntered(true);
    }, 500);
  };

  return (
    <>
      {/* ── Portal: full-screen drop animation (bypasses ALL parent overflow clipping) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {phase === 'dropping' && (
            <motion.div
              key="drop-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'fixed', inset: 0, zIndex: 9997,
                pointerEvents: 'none',
              }}
            >
              {/* Spotlight backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute', inset: 0,
                  background: 'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.72) 100%)',
                  backdropFilter: 'blur(1px)',
                }}
              />

              {/* "Memories" flash label that appears just before first card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.7, y: -10 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1.05, 1, 0.9], y: [-10, 0, 0, -6] }}
                transition={{ duration: 1.1, times: [0, 0.25, 0.7, 1], ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  top: '22%',
                  left: 0, right: 0,
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 'clamp(1.4rem, 4vw, 2.2rem)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textShadow: '0 0 40px rgba(100,200,255,0.5)',
                  pointerEvents: 'none',
                }}
              >
                📸 Memories
              </motion.div>

              {/* Dropping cards */}
              {stack.map((image, index) => (
                <DropCard
                  key={image.id}
                  image={image}
                  index={index}
                  total={stack.length}
                  targetX={pileCenter.x}
                  targetY={pileCenter.y}
                  onLanded={index === stack.length - 1 ? handleAllLanded : undefined}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── The actual section (hidden during drop, revealed after) ─────────── */}
      <div
        ref={containerRef}
        className="w-full relative py-16 grid place-items-center min-h-[620px] my-8 px-4"
      >
        <AnimatePresence>
          {phase === 'done' && (
            <motion.div
              key="pile-reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <h3 className="absolute top-4 md:top-8 left-0 right-0 text-xl md:text-2xl font-bold text-white/55 z-0 text-center px-4 w-full">
                Memories 📸<br />
                <span className="text-sm font-normal text-white/35">Swipe to shuffle • Tap to inspect • Tap again to flip!</span>
              </h3>

              {activeId && <div className="absolute inset-0 z-40 cursor-zoom-out" onClick={() => setActiveId(null)} />}

              <div className="relative grid place-items-center w-full max-w-[280px] sm:max-w-sm md:max-w-md h-[400px] mt-16 mx-auto">
                {stack.map((image, index) => (
                  <PolaroidCard
                    key={image.id}
                    image={image}
                    index={index}
                    stackLength={stack.length}
                    activeId={activeId}
                    setActiveId={setActiveId}
                    hasEntered={hasEntered}
                    handleDragEnd={handleDragEnd}
                    handleDrag={handleDrag}
                    dragProgress={dragProgress}
                  />
                ))}
              </div>

              {/* Scroll hint */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0.6, 0], y: [8, 0, 0, 10] }}
                transition={{ delay: 1.5, duration: 2.4, repeat: Infinity, repeatDelay: 1 }}
                className="absolute bottom-3 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none"
              >
                <span className="text-white/35 text-[10px] tracking-[0.2em] uppercase font-medium">scroll</span>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-white/25">
                  <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

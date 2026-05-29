import { useState, useRef, useEffect } from 'react';
import { motion, useInView, PanInfo, useMotionValue, useTransform, animate } from 'motion/react';
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

function PolaroidCard({
  image, index, stackLength, activeId, setActiveId,
  hasEntered, isInView, handleDragEnd, handleDrag, dragProgress,
}: any) {
  const isSelected  = activeId === image.id;
  const isTop       = index === stackLength - 1;
  const visualIndex = stackLength - 1 - index;
  const [isFlipped, setIsFlipped] = useState(false);

  const restRotate  = (visualIndex % 2 === 0 ? -1 : 1) * visualIndex * 3;
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
      initial={{ opacity: 0, scale: 0.85, y: 30 }}
      animate={
        isInView
          ? { opacity: opacityVal, scale: scaleOffset, y: yOffset, rotate: isSelected ? 0 : restRotate }
          : { opacity: 0, scale: 0.85, y: 30 }
      }
      transition={
        isSelected
          ? { type: 'spring', stiffness: 220, damping: 26 }
          : { type: 'spring', stiffness: 120, damping: 18, delay: isInView && !hasEntered ? visualIndex * 0.12 : 0 }
      }
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
              <span className="font-sans text-gray-800 text-xs md:text-sm font-medium transform -rotate-1 truncate max-w-full pointer-events-none">
                {image.caption}
              </span>
              {isSelected && image.roastBack && (
                <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-indigo-400 font-medium mt-1 pointer-events-none">
                  👆 Tap to flip!
                </motion.span>
              )}
            </div>

            {/* BACK */}
            <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }} className="flex flex-col items-center justify-center bg-amber-50 border border-amber-200 rounded-sm p-3 text-center">
              <span className="text-2xl mb-2">💬</span>
              <p className="text-gray-700 text-xs md:text-sm font-medium leading-snug italic">
                "{image.roastBack || 'Koi message nahi hai abhi 😅'}"
              </p>
              <span className="text-[10px] text-amber-500 mt-2 font-medium">👆 Tap to flip back</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function PolaroidPile({ images }: { images: PolaroidImage[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const isInView     = useInView(containerRef, { once: true, margin: '-5% 0px -5% 0px' });
  const dragProgress = useMotionValue(0);
  const [stack, setStack]           = useState<PolaroidImage[]>([]);

  useEffect(() => {
    if (images && images.length > 0 && stack.length === 0) {
      setStack([...images].reverse());
    }
  }, [images]);

  useEffect(() => {
    if (isInView && !hasEntered) {
      setTimeout(() => setHasEntered(true), images.length * 120 + 800);
    }
  }, [isInView, hasEntered, images.length]);

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

  return (
    <div ref={containerRef} className="w-full relative py-16 grid place-items-center min-h-[580px] overflow-hidden my-8 px-4">
      <h3 className="absolute top-4 md:top-8 left-0 right-0 text-xl md:text-2xl font-bold text-white/50 z-0 text-center px-4 w-full">
        Memories 📸<br />
        <span className="text-sm font-normal">(Swipe to shuffle • Tap to inspect • Tap again to flip!)</span>
      </h3>

      {activeId && <div className="absolute inset-0 z-40 cursor-zoom-out" onClick={() => setActiveId(null)} />}

      <div className="relative grid place-items-center w-full max-w-[280px] sm:max-w-sm md:max-w-md h-[400px] mt-12">
        {stack.map((image, index) => (
          <PolaroidCard
            key={image.id}
            image={image}
            index={index}
            stackLength={stack.length}
            activeId={activeId}
            setActiveId={setActiveId}
            hasEntered={hasEntered}
            isInView={isInView}
            handleDragEnd={handleDragEnd}
            handleDrag={handleDrag}
            dragProgress={dragProgress}
          />
        ))}
      </div>
    </div>
  );
}

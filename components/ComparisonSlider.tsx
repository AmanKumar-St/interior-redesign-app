
import React, { useState, useRef, useEffect } from 'react';

interface ComparisonSliderProps {
  original: string;
  reimagined: string;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ original, reimagined }) => {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const relativeX = x - rect.left;
    const newPosition = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
    setPosition(newPosition);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-video rounded-2xl overflow-hidden cursor-ew-resize select-none shadow-2xl bg-slate-200"
      onMouseMove={(e) => e.buttons === 1 && handleMove(e)}
      onTouchMove={handleMove}
      onMouseDown={handleMove}
    >
      {/* Reimagined Image (Background) */}
      <img 
        src={reimagined} 
        alt="Reimagined" 
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Original Image (Foreground with Clip Path) */}
      <div 
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img 
          src={original} 
          alt="Original" 
          className="absolute inset-0 w-full h-full object-cover grayscale-[0.2]"
        />
      </div>

      {/* Slider Line */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg z-10"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-xl flex items-center justify-center border-2 border-slate-100">
          <div className="flex gap-0.5">
            <svg className="w-4 h-4 text-slate-400 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-4 left-4 z-20 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-white text-xs font-medium tracking-wider pointer-events-none uppercase">
        Original
      </div>
      <div className="absolute bottom-4 right-4 z-20 px-3 py-1 bg-white/40 backdrop-blur-md rounded-full text-white text-xs font-medium tracking-wider pointer-events-none uppercase">
        Reimagined
      </div>
    </div>
  );
};

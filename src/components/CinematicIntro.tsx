import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface CinematicIntroProps {
  onComplete: () => void;
  forceShow?: boolean;
}

export const CinematicIntro: React.FC<CinematicIntroProps> = ({ onComplete, forceShow = false }) => {
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    // Check if user already saw the intro during this session, or autostart=1 / Problem Exchange route
    if (!forceShow) {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const hasAutostart =
        search.includes('autostart=1') || hash.includes('autostart=1');
      const isProblemExchangeRoute =
        hash.startsWith('#/problem-exchange') ||
        hash.startsWith('#/problems') ||
        window.location.pathname.startsWith('/problem-exchange') ||
        window.location.pathname.startsWith('/problems');
      const seen = sessionStorage.getItem('esc_intro_seen');
      if (seen || hasAutostart || isProblemExchangeRoute) {
        onComplete();
        return;
      }
    }

    setMounted(true);

    // Progress tick
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 6;
      });
    }, 60);

    // Auto complete after 1.95s
    const timer = setTimeout(() => {
      handleFinish();
    }, 1950);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [forceShow]);

  const handleFinish = () => {
    sessionStorage.setItem('esc_intro_seen', 'true');
    setIsClosing(true);
    setTimeout(() => {
      setMounted(false);
      onComplete();
    }, 550);
  };

  if (!mounted) return null;

  return (
    <div
      onClick={handleFinish}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050608] cursor-pointer select-none overflow-hidden transition-all duration-500 ease-out ${
        isClosing ? 'opacity-0 scale-105 blur-md pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background Grid & Ambient Glow */}
      <div className="absolute inset-0 bg-grid-pattern opacity-25 pointer-events-none"></div>
      <div className="absolute w-[600px] h-[600px] rounded-full bg-[#CCFF00]/10 blur-[140px] pointer-events-none"></div>

      {/* Top telemetry status bar */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between text-[11px] font-mono text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#CCFF00] animate-ping"></span>
          <span className="text-zinc-400">ESC CORE SYSTEM BOOT // V2.6</span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleFinish();
          }}
          className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-zinc-400 hover:text-[#CCFF00] hover:border-[#CCFF00]/50 transition-all font-mono"
        >
          SKIP <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Center Stage: ESC Logo & Animation */}
      <div className="relative flex flex-col items-center space-y-6 z-10 px-4">
        
        {/* Logo Frame with Electric Sweep */}
        <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-3xl bg-black border border-zinc-800/80 p-2 shadow-2xl flex items-center justify-center overflow-hidden glow-lime-sm transform transition-transform duration-700 hover:scale-105">
          {/* Official ESC logo */}
          <img
            src="/assets/aistudio/IMG_20261112_135951_2ec3259f.png"
            alt="ESC"
            className="h-full w-full object-contain rounded-2xl relative z-10"
          />

          {/* Electric-green light sweep ray across logo */}
          <div className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-[#CCFF00]/40 to-transparent skew-x-[-30deg] animate-sweep z-20 pointer-events-none"></div>

          {/* Corner CAD crosshairs */}
          <div className="absolute top-1 left-1 font-mono text-[9px] text-[#CCFF00]/60 z-30">+</div>
          <div className="absolute bottom-1 right-1 font-mono text-[9px] text-[#CCFF00]/60 z-30">+</div>
        </div>

        {/* Animated ESC Headline & Sub-title */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="font-display text-2xl sm:text-3xl font-black tracking-widest text-white">
              ESC
            </span>
            <span className="text-[#CCFF00] font-mono font-bold text-sm">//</span>
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-[#CCFF00] font-semibold">
              PLATFORM
            </span>
          </div>

          <p className="font-mono text-xs sm:text-sm uppercase text-zinc-300 font-semibold tracking-[0.25em] max-w-md animate-pulse">
            ENGINEERING STARTUP COMPANY
          </p>

          <p className="font-mono text-[11px] text-zinc-400 tracking-wider">
            THINK. ENGINEER. BUILD. LAUNCH.
          </p>
        </div>

        {/* Precision Progress Bar */}
        <div className="w-56 sm:w-64 space-y-1.5 pt-4">
          <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-[#CCFF00] shadow-[0_0_10px_#CCFF00] transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>INITIALIZING ECOSYSTEM</span>
            <span className="text-[#CCFF00] font-bold">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Bottom click anywhere hint */}
      <div className="absolute bottom-6 text-[10px] font-mono text-zinc-500 tracking-widest uppercase">
        [ Click anywhere to enter ecosystem ]
      </div>
    </div>
  );
};

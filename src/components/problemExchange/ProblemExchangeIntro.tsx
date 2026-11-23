import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, PlusCircle, ChevronRight } from 'lucide-react';

interface ProblemExchangeIntroProps {
  forceShow?: boolean;
  onExplore: () => void;
  onSubmitProblem: () => void;
}

const INTRO_SESSION_KEY = 'esc_px_intro_seen';

export const ProblemExchangeIntro: React.FC<ProblemExchangeIntroProps> = ({
  forceShow = false,
  onExplore,
  onSubmitProblem,
}) => {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [svgDrawn, setSvgDrawn] = useState(false);

  useEffect(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const hasAutostart = search.includes('autostart=1') || hash.includes('autostart=1');
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!forceShow) {
      const seen = sessionStorage.getItem(INTRO_SESSION_KEY);
      if (hasAutostart || seen) {
        setVisible(false);
        return;
      }
    }

    setVisible(true);
    setClosing(false);

    if (prefersReduced) {
      setSvgDrawn(true);
      setStage(2);
      return;
    }

    setStage(0);
    setSvgDrawn(false);

    const drawTimer = window.setTimeout(() => setSvgDrawn(true), 80);
    const stage1Timer = window.setTimeout(() => setStage(1), 1350);
    const stage2Timer = window.setTimeout(() => setStage(2), 2650);

    return () => {
      window.clearTimeout(drawTimer);
      window.clearTimeout(stage1Timer);
      window.clearTimeout(stage2Timer);
    };
  }, [forceShow]);

  const dismiss = (callback: () => void) => {
    sessionStorage.setItem(INTRO_SESSION_KEY, 'true');
    setClosing(true);
    window.setTimeout(() => {
      setVisible(false);
      setClosing(false);
      callback();
    }, 320);
  };

  if (!visible) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ESC Problem Exchange Introduction"
      data-testid="problem-exchange-intro"
      className={`fixed inset-0 z-[125] flex flex-col justify-between bg-[#050608] text-white overflow-hidden transition-all duration-300 ${
        closing ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Subtle Architectural Grid & Ambient Neon Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(57,255,20,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(57,255,20,0.08) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#39FF14]/10 blur-[140px]" />

      {/* Top Bar */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-[#39FF14] animate-pulse" />
          <span>ESC // Engineering Startup Company</span>
        </div>
        <button
          type="button"
          onClick={() => dismiss(onExplore)}
          aria-label="Skip Problem Exchange Intro"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a2f3a] bg-[#111317] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-300 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors cursor-pointer"
        >
          Skip Intro <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Center Stage */}
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        {/* Neon-Green ESC Outline SVG Draw */}
        <div className="mb-8 flex items-center justify-center">
          <svg
            viewBox="0 0 220 76"
            className="h-16 w-48 sm:h-20 sm:w-56 overflow-visible"
            aria-hidden="true"
          >
            {/* Outer architectural frame */}
            <rect
              x="4"
              y="4"
              width="212"
              height="68"
              rx="10"
              fill="none"
              stroke="#39FF14"
              strokeWidth="2"
              strokeDasharray="560"
              strokeDashoffset={svgDrawn ? 0 : 560}
              style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
            {/* Inner E S C geometric paths */}
            <path
              d="M36 22 H72 M36 22 V54 M36 38 H66 M36 54 H72"
              fill="none"
              stroke="#39FF14"
              strokeWidth="4"
              strokeLinecap="square"
              strokeDasharray="160"
              strokeDashoffset={svgDrawn ? 0 : 160}
              style={{ transition: 'stroke-dashoffset 0.9s ease 0.15s' }}
            />
            <path
              d="M126 24 H96 V37 H126 V54 H94"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="square"
              strokeDasharray="160"
              strokeDashoffset={svgDrawn ? 0 : 160}
              style={{ transition: 'stroke-dashoffset 0.9s ease 0.3s' }}
            />
            <path
              d="M184 22 H152 V54 H184"
              fill="none"
              stroke="#39FF14"
              strokeWidth="4"
              strokeLinecap="square"
              strokeDasharray="160"
              strokeDashoffset={svgDrawn ? 0 : 160}
              style={{ transition: 'stroke-dashoffset 0.9s ease 0.45s' }}
            />
          </svg>
        </div>

        {/* Sequential Narrative Headlines */}
        <div className="min-h-[168px] flex flex-col items-center justify-center">
          {stage === 0 && (
            <p className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold uppercase tracking-tight text-white leading-tight animate-fade-in">
              INDIA IS FULL OF{' '}
              <span className="text-[#39FF14]">PROBLEMS WORTH SOLVING.</span>
            </p>
          )}

          {stage === 1 && (
            <p className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold uppercase tracking-tight text-white leading-tight animate-fade-in">
              WE CONNECT PROBLEMS WITH THE{' '}
              <span className="text-[#39FF14]">PEOPLE WHO CAN SOLVE THEM.</span>
            </p>
          )}

          {stage === 2 && (
            <div className="space-y-5 animate-fade-in">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#39FF14]">
                Real Problems. Big Ideas. Real-World Solutions.
              </p>
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold uppercase tracking-tight text-white leading-[1.05]">
                ESC PROBLEM <span className="text-[#39FF14]">EXCHANGE</span>
              </h1>
              <p className="mx-auto max-w-2xl text-sm sm:text-base text-zinc-400 leading-relaxed">
                Explore structured engineering, industrial, civic, and startup challenges across 40 technical domains — scored transparently and ready for teams to research, validate, and build.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3.5 pt-3">
                <button
                  type="button"
                  onClick={() => dismiss(onExplore)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-6 py-3.5 font-display text-xs sm:text-sm font-extrabold uppercase tracking-wider text-black hover:bg-[#32e010] shadow-lg shadow-[#39FF14]/25 transition-all cursor-pointer"
                >
                  Explore Problems <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(onSubmitProblem)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#2d3340] bg-[#111317] px-6 py-3.5 font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-white hover:border-[#39FF14] hover:text-[#39FF14] transition-all cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" /> Submit a Problem
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-8">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((stepIdx) => (
            <button
              key={stepIdx}
              type="button"
              onClick={() => setStage(stepIdx as 0 | 1 | 2)}
              aria-label={`Intro stage ${stepIdx + 1}`}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                stage === stepIdx
                  ? 'w-10 bg-[#39FF14]'
                  : stage > stepIdx
                  ? 'w-5 bg-[#39FF14]/50'
                  : 'w-5 bg-[#232731]'
              }`}
            />
          ))}
        </div>
        <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
          THINK. ENGINEER. BUILD. LAUNCH.
        </span>
      </div>
    </div>,
    document.body
  );
};

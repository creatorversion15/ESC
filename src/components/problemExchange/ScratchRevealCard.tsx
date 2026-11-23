import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, RefreshCw, Sparkles, Eye, Hand } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { getDifficultyLabel, getValidationStatusLabel } from '../../utils/problemExchangeLogic';
import type { ExchangeProblem } from '../../types';

interface ScratchRevealCardProps {
  initialProblem?: ExchangeProblem | null;
  onExploreProblem: (problemId: string) => void;
}

export const ScratchRevealCard: React.FC<ScratchRevealCardProps> = ({
  initialProblem = null,
  onExploreProblem,
}) => {
  const [problem, setProblem] = useState<ExchangeProblem | null>(initialProblem);
  const [loading, setLoading] = useState(!initialProblem);
  const [revealed, setRevealed] = useState(false);
  const [scratchPercent, setScratchPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const strokeCountRef = useRef(0);

  const fetchRandomProblem = useCallback(async (excludeId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const query = excludeId ? `?excludeId=${encodeURIComponent(excludeId)}` : '';
      const data = await apiRequest<ExchangeProblem>(`/api/problem-exchange/random${query}`);
      setProblem(data);
      setRevealed(false);
      setScratchPercent(0);
      strokeCountRef.current = 0;
    } catch (err: any) {
      setError(err?.message || 'Unable to load a random problem right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialProblem) {
      fetchRandomProblem();
    } else {
      setProblem(initialProblem);
      setLoading(false);
    }
  }, [initialProblem, fetchRandomProblem]);

  const paintFoil = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || revealed) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(300, Math.floor(rect.width));
    const height = Math.max(280, Math.floor(rect.height));

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'source-over';

    // Dark obsidian metallic gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#101319');
    grad.addColorStop(0.5, '#171c24');
    grad.addColorStop(1, '#0c0e13');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle geometric neon-green grid overlay
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.08)';
    ctx.lineWidth = 1;
    const step = 28;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Diagonal metallic shimmer lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 2;
    for (let i = -height; i < width + height; i += 44) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - height, height);
      ctx.stroke();
    }

    // Corner engineering reticle brackets
    const pad = 22;
    const len = 24;
    ctx.strokeStyle = '#39FF14';
    ctx.lineWidth = 2;
    const corners: [number, number, number, number][] = [
      [pad, pad, 1, 1],
      [width - pad, pad, -1, 1],
      [pad, height - pad, 1, -1],
      [width - pad, height - pad, -1, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + dy * len);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + dx * len, cy);
      ctx.stroke();
    }

    // Center prompt typography
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#39FF14';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('INTERACTIVE DISCOVERY FOIL', width / 2, height / 2 - (width < 520 ? 54 : 42));

    ctx.fillStyle = '#ffffff';
    if (width < 520) {
      ctx.font = '800 18px "Space Grotesk", sans-serif';
      ctx.fillText('THERE IS A PROBLEM', width / 2, height / 2 - 22, width - 48);
      ctx.fillText('WAITING TO BE SOLVED.', width / 2, height / 2 + 2, width - 48);
    } else {
      ctx.font = '800 24px "Space Grotesk", sans-serif';
      ctx.fillText('THERE IS A PROBLEM WAITING TO BE SOLVED.', width / 2, height / 2 - 6, width - 56);
    }

    // Neon badge box
    const badgeW = 216;
    const badgeH = 34;
    const bx = width / 2 - badgeW / 2;
    const by = height / 2 + (width < 520 ? 28 : 24);
    ctx.fillStyle = 'rgba(57, 255, 20, 0.14)';
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, badgeW, badgeH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#39FF14';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText('SCRATCH TO DISCOVER', width / 2, by + badgeH / 2 + 1);
  }, [revealed]);

  useEffect(() => {
    if (!revealed && problem) {
      const raf = window.requestAnimationFrame(() => paintFoil());
      const handleResize = () => paintFoil();
      window.addEventListener('resize', handleResize);
      return () => {
        window.cancelAnimationFrame(raf);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [revealed, problem, paintFoil]);

  const computeClearedRatio = () => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 0;
    const { width, height } = canvas;
    if (width === 0 || height === 0) return 0;
    const imgData = ctx.getImageData(0, 0, width, height).data;
    let cleared = 0;
    let sampled = 0;
    // Sample every 10th pixel for fast, zero-jank computation
    for (let i = 3; i < imgData.length; i += 40) {
      sampled++;
      if (imgData[i] < 128) cleared++;
    }
    return sampled === 0 ? 0 : Math.round((cleared / sampled) * 100);
  };

  const eraseAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || revealed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    const radius = Math.max(28, Math.min(44, canvas.width * 0.055));

    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = radius * 2;

    if (lastPointRef.current) {
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    lastPointRef.current = { x, y };
    strokeCountRef.current += 1;

    if (strokeCountRef.current % 6 === 0) {
      const pct = computeClearedRatio();
      setScratchPercent(pct);
      if (pct >= 36) {
        setRevealed(true);
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (revealed) return;
    isDrawingRef.current = true;
    lastPointRef.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
    eraseAt(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || revealed) return;
    eraseAt(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    const pct = computeClearedRatio();
    setScratchPercent(pct);
    if (pct >= 36) {
      setRevealed(true);
    }
  };

  return (
    <section
      aria-label="Scratch to Discover a Real-World Problem"
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
    >
      <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 sm:p-8 shadow-2xl">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#39FF14]">
              <Sparkles className="h-3.5 w-3.5" /> Interactive Problem Discovery
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Uncover Your Next Engineering Challenge
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              Drag your cursor or swipe across the dark metallic foil below to reveal a real-world problem from the ESC Problem Exchange database.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!revealed && problem && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                data-testid="scratch-reveal-button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#39FF14]/45 bg-[#39FF14]/10 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-[#39FF14] hover:bg-[#39FF14] hover:text-black transition-colors cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" /> Reveal Problem
              </button>
            )}
            <button
              type="button"
              onClick={() => fetchRandomProblem(problem?.id)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#161920] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-zinc-200 hover:border-[#39FF14]/60 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Discover Another
            </button>
          </div>
        </div>

        {/* Interactive Scratch Stage */}
        <div
          ref={containerRef}
          className="relative min-h-[300px] sm:min-h-[320px] w-full overflow-hidden rounded-2xl border border-[#2a303c] bg-[#0b0d11]"
        >
          {/* Underlying Revealed Problem Card */}
          <div className="relative z-0 flex min-h-[300px] sm:min-h-[320px] flex-col justify-between p-6 sm:p-8">
            {error ? (
              <div className="my-auto text-center space-y-3">
                <p className="text-sm text-red-400">{error}</p>
                <button
                  type="button"
                  onClick={() => fetchRandomProblem()}
                  className="rounded-xl bg-[#39FF14] px-4 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
                >
                  Retry Discovery
                </button>
              </div>
            ) : loading || !problem ? (
              <div className="my-auto flex flex-col items-center justify-center gap-3 text-zinc-400 font-mono text-xs">
                <div className="h-6 w-6 rounded-full border-2 border-[#39FF14] border-t-transparent animate-spin" />
                <span>Selecting a problem from the ESC Exchange...</span>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <span className="rounded bg-[#39FF14]/15 border border-[#39FF14]/40 px-2.5 py-1 font-bold text-[#39FF14]">
                        {problem.problemCode}
                      </span>
                      <span className="rounded bg-[#171b23] border border-[#272c38] px-2.5 py-1 text-zinc-200">
                        {problem.category}
                      </span>
                      <span className="text-zinc-400">• {problem.industry}</span>
                      <span className="rounded bg-[#171b23] px-2.5 py-1 text-amber-300">
                        {getValidationStatusLabel(problem.validationStatus)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-[#39FF14]/35 bg-[#0f170d] px-3.5 py-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                        Opportunity Score
                      </span>
                      <span className="font-display text-lg font-extrabold text-[#39FF14]">
                        {problem.opportunityScore}
                        <span className="text-xs font-mono text-zinc-500">/100</span>
                      </span>
                    </div>
                  </div>

                  <h3 className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold text-white leading-snug">
                    {problem.title}
                  </h3>

                  <p className="text-sm text-zinc-300 leading-relaxed max-w-4xl">
                    {problem.description}
                  </p>
                </div>

                <div className="mt-6 pt-5 border-t border-[#1e222b] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
                    <span className="text-zinc-500 uppercase">Difficulty:</span>
                    <span className="text-white font-semibold">
                      {getDifficultyLabel(problem.difficulty)}
                    </span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-zinc-500 uppercase">Location:</span>
                    <span className="text-zinc-200">{problem.location}</span>
                    {problem.skillsRequired.slice(0, 3).map((skill) => (
                      <span
                        key={skill}
                        className="rounded border border-[#262b36] bg-[#14171f] px-2 py-0.5 text-[11px] text-zinc-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onExploreProblem(problem.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-5 py-2.5 font-display text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#32e010] transition-colors cursor-pointer"
                    >
                      Explore This Problem <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fetchRandomProblem(problem.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#2c313d] bg-[#161922] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white hover:border-[#39FF14] hover:text-[#39FF14] transition-colors cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Discover Another
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Interactive HTML5 Scratch Foil Overlay */}
          {!revealed && problem && !loading && (
            <canvas
              ref={canvasRef}
              data-testid="scratch-reveal-canvas"
              aria-label="Scratch foil to reveal a random real-world problem"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="absolute inset-0 z-10 h-full w-full cursor-crosshair touch-none select-none transition-opacity duration-300"
            />
          )}
        </div>

        {/* Footer Progress Hint */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <Hand className="h-3.5 w-3.5 text-[#39FF14]" />
            {revealed
              ? 'Problem uncovered — explore the full brief or discover another.'
              : 'Click & drag (desktop) or swipe (mobile) to scratch the metallic foil.'}
          </span>
          {!revealed && scratchPercent > 0 && (
            <span className="text-[#39FF14]">Scratched {scratchPercent}%</span>
          )}
        </div>
      </div>
    </section>
  );
};

import React, { useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { getDifficultyLabel, getValidationStatusLabel } from '../../utils/problemExchangeLogic';
import type { ExchangeProblem } from '../../types';

interface TopTenCarouselProps {
  problems: ExchangeProblem[];
  onExploreProblem: (problemId: string) => void;
}

export const TopTenCarousel: React.FC<TopTenCarouselProps> = ({
  problems,
  onExploreProblem,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);

  if (!problems || problems.length === 0) return null;

  const scrollByCard = (direction: 'prev' | 'next') => {
    const el = trackRef.current;
    if (!el) return;
    const distance = Math.max(320, el.clientWidth * 0.72);
    el.scrollBy({
      left: direction === 'next' ? distance : -distance,
      behavior: 'smooth',
    });
  };

  return (
    <section aria-label="Top 10 Curated Problems" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#39FF14]">
            <Flame className="h-3.5 w-3.5" /> Curated Priority Index
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Top 10 High-Priority Problems
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Admin-curated high-impact engineering challenges selected for immediate student research and prototyping.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => scrollByCard('prev')}
            aria-label="Scroll Top 10 carousel left"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#282d37] bg-[#13161d] text-zinc-300 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard('next')}
            aria-label="Scroll Top 10 carousel right"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#282d37] bg-[#13161d] text-zinc-300 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Horizontal Scroll-Snap Track */}
      <div
        ref={trackRef}
        data-testid="top-ten-carousel"
        className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth [scrollbar-width:thin] [scrollbar-color:#2b303c_transparent]"
      >
        {problems.map((problem, index) => {
          const rankNumber = problem.topTenRank ?? index + 1;
          const paddedRank = String(rankNumber).padStart(2, '0');

          return (
            <article
              key={problem.id}
              className="group relative flex w-[310px] sm:w-[360px] shrink-0 snap-start flex-col justify-between rounded-2xl border border-[#232731] bg-[#111317] p-6 hover:border-[#39FF14]/60 transition-all"
            >
              <div className="space-y-4">
                {/* Giant Rank Numeral + Opportunity Score */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-display text-4xl sm:text-5xl font-black leading-none tracking-tighter text-[#39FF14]">
                      {paddedRank}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                        {problem.problemCode}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-zinc-300">
                        {problem.category}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#39FF14]/30 bg-[#0d150c] px-2.5 py-1 text-right shrink-0">
                    <span className="block font-mono text-[9px] uppercase text-zinc-400">Score</span>
                    <span className="font-display text-base font-extrabold text-[#39FF14]">
                      {problem.opportunityScore}
                    </span>
                  </div>
                </div>

                {/* Industry & Validation Label */}
                <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
                  <span className="text-zinc-400">{problem.industry}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-amber-300">
                    {getValidationStatusLabel(problem.validationStatus)}
                  </span>
                </div>

                {/* Title & Summary */}
                <h3 className="font-display text-lg font-bold text-white leading-snug group-hover:text-[#39FF14] transition-colors line-clamp-2">
                  {problem.title}
                </h3>

                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                  {problem.description}
                </p>
              </div>

              {/* Footer Meta + Explore CTA */}
              <div className="mt-5 pt-4 border-t border-[#1d212a] space-y-3.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded border border-[#292e39] bg-[#161922] px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                    {getDifficultyLabel(problem.difficulty)}
                  </span>
                  {problem.skillsRequired.slice(0, 2).map((skill) => (
                    <span
                      key={skill}
                      className="rounded border border-[#232732] bg-[#0e1015] px-2 py-0.5 font-mono text-[10px] text-zinc-400 truncate max-w-[140px]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => onExploreProblem(problem.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#2b303c] bg-[#151821] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white group-hover:border-[#39FF14] group-hover:bg-[#39FF14] group-hover:text-black transition-all cursor-pointer"
                >
                  <span>Explore</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

import React, { useState, useEffect } from 'react';
import { Lightbulb, Users, Cpu, Rocket, ShieldCheck, ChevronRight, Sparkles } from 'lucide-react';

interface StageInfo {
  id: string;
  step: string;
  title: string;
  tagline: string;
  icon: React.ElementType;
  specs: string[];
  output: string;
  deliverable: string;
}

const STAGES: StageInfo[] = [
  {
    id: 'ideas',
    step: '01',
    title: 'IDEAS',
    tagline: 'Vetted Industrial & Scientific Friction',
    icon: Lightbulb,
    specs: ['DeepTech Problem Statements', 'Feasibility Scoring (1-10)', 'Patent Prior-Art Check'],
    output: 'Validated Technical Brief',
    deliverable: 'Hypothesis & System Architecture',
  },
  {
    id: 'team',
    step: '02',
    title: 'TEAM',
    tagline: 'Cross-Discipline Founder Assembly',
    icon: Users,
    specs: ['Hardware + Firmware + Software Pairing', 'Weekly 15-20h Availability Match', 'Complementary Skill Matrix'],
    output: 'Balanced 3-4 Person Swarm',
    deliverable: 'Co-Founding Charter',
  },
  {
    id: 'prototype',
    step: '03',
    title: 'PROTOTYPE',
    tagline: 'Rapid Fabrication & Hardware Bench',
    icon: Cpu,
    specs: ['Direct PCB/Component Grants', '3D SLS Nylon Printing', 'Test Bench Telemetry (CAN/ROS2)'],
    output: 'Working Physical V1',
    deliverable: 'Functioning Lab Proof-of-Concept',
  },
  {
    id: 'product',
    step: '04',
    title: 'PRODUCT',
    tagline: 'Field Testing & Pilot Trials',
    icon: Sparkles,
    specs: ['Real-World Environment Testing', 'User Telemetry & Stress Tests', 'Safety & EMC Pre-Compliance'],
    output: 'Commercial Minimum Viable Product',
    deliverable: 'Customer Validation Data',
  },
  {
    id: 'startup',
    step: '05',
    title: 'STARTUP',
    tagline: 'Entity Launch & Pre-Seed Backing',
    icon: Rocket,
    specs: ['VC Pitch Room Access', 'Pro-Bono Patent Legal Filing', 'Incorporation & Equity Vesting'],
    output: 'Funded Student-Led Company',
    deliverable: 'Live Venture on Market',
  },
];

export const EngineeringStoryPipeline: React.FC = () => {
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-cycle through the 5 stages unless hovered/paused
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveStageIndex((prev) => (prev + 1) % STAGES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPaused]);

  const activeStage = STAGES[activeStageIndex];
  const Icon = activeStage.icon;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="rounded-3xl border border-[#232731] bg-[#0c0d11] p-6 sm:p-10 space-y-8 relative overflow-hidden"
    >
      {/* Background technical accent */}
      <div className="absolute top-0 right-0 p-6 font-mono text-[9px] text-zinc-600 tracking-wider">
        ESC_PIPELINE // STAGE_TRANSITION_ENGINE
      </div>

      {/* Top Header */}
      <div className="space-y-2">
        <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
          The Engineering Lifecycle
        </span>
        <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          From Classroom Curiosity to Market Venture
        </h3>
        <p className="text-xs sm:text-sm text-[#9ca3af] max-w-2xl">
          Most college projects end as a PDF submission. The ESC pipeline systematically converts engineering friction into verified products.
        </p>
      </div>

      {/* 5-Step Pipeline Bar with Active Beam */}
      <div className="relative">
        {/* Continuous track */}
        <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 bg-[#1f2229] z-0">
          {/* Animated signal laser traveling across */}
          <div
            className="h-full bg-gradient-to-r from-transparent via-[#CCFF00] to-transparent w-36 transition-all duration-700 ease-out"
            style={{
              transform: `translateX(${activeStageIndex * 220}%)`,
            }}
          />
        </div>

        {/* Stage Nodes Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 relative z-10">
          {STAGES.map((stg, idx) => {
            const StageIcon = stg.icon;
            const isActive = idx === activeStageIndex;
            const isCompleted = idx < activeStageIndex;

            return (
              <button
                key={stg.id}
                onClick={() => setActiveStageIndex(idx)}
                className={`flex flex-col items-center text-center p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
                  isActive
                    ? 'border-[#CCFF00] bg-[#151914] shadow-lg shadow-[#CCFF00]/15 scale-105'
                    : isCompleted
                    ? 'border-[#2d3227] bg-[#101211] text-zinc-300 hover:border-zinc-700'
                    : 'border-[#20232c] bg-[#111317] text-zinc-500 hover:border-zinc-700'
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl mb-2 transition-transform ${
                    isActive
                      ? 'bg-[#CCFF00] text-black shadow-md'
                      : isCompleted
                      ? 'bg-zinc-800 text-[#CCFF00]'
                      : 'bg-zinc-900 text-zinc-500'
                  }`}
                >
                  <StageIcon className="h-5 w-5" />
                </div>
                <span className="font-mono text-[10px] text-zinc-500">STEP {stg.step}</span>
                <span className={`font-display text-xs font-bold uppercase tracking-wider ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                  {stg.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Stage Detailed Breakdown Card */}
      <div className="rounded-2xl border border-[#2b2f3a] bg-[#111318] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[#CCFF00] uppercase font-semibold">
                  STAGE 0{activeStageIndex + 1}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="font-mono text-[10px] text-zinc-400 uppercase">
                  {activeStage.deliverable}
                </span>
              </div>
              <h4 className="font-display text-xl sm:text-2xl font-black text-white">
                {activeStage.title}: {activeStage.tagline}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-[#CCFF00] animate-pulse"></span>
            <span>SYSTEM ACCELERATOR</span>
          </div>
        </div>

        {/* Specifications List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activeStage.specs.map((spec, i) => (
            <div key={i} className="rounded-xl border border-zinc-800/80 bg-[#161820] p-4 space-y-1">
              <span className="font-mono text-[10px] text-[#CCFF00] uppercase">Milestone {i + 1}</span>
              <p className="text-xs text-white font-medium">{spec}</p>
            </div>
          ))}
        </div>

        {/* Bottom Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-zinc-800 text-xs">
          <div className="text-zinc-400">
            Stage Deliverable: <strong className="text-white">{activeStage.output}</strong>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#CCFF00]">
            <span>Click or hover stages to explore full progression</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};

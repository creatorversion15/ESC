import React, { useState } from 'react';
import { Calendar, Target, Users, Cpu, Rocket, Award, CheckCircle2 } from 'lucide-react';

interface TimelineStep {
  day: string;
  title: string;
  description: string;
  icon: React.ElementType;
  deliverable: string;
  badge: string;
}

const TIMELINE_STEPS: TimelineStep[] = [
  {
    day: 'DAY 01',
    title: 'Unsolved Problem Selection',
    description: 'Explore verified industrial, clinical, and energy bottlenecks in the ESC Problem Exchange instead of building a generic clone.',
    icon: Target,
    deliverable: 'Selected Challenge Brief',
    badge: 'Discovery Phase',
  },
  {
    day: 'DAY 14',
    title: 'Multidisciplinary Assembly',
    description: 'Recruit mechanical, firmware, and AI students across partner universities into your project workspace to form a 3-4 person swarm.',
    icon: Users,
    deliverable: 'Signed Team Charter',
    badge: 'Team Formation',
  },
  {
    day: 'DAY 30',
    title: 'Parts Grant & CAD/PCB Fab',
    description: 'Submit technical Bill of Materials (BOM) to the ESC review committee. Approved workspaces receive rapid prototyping funds.',
    icon: Cpu,
    deliverable: 'BOM & Rapid Parts Grant',
    badge: 'Fabrication',
  },
  {
    day: 'DAY 60',
    title: 'Bench Calibration & Pilot Run',
    description: 'Deploy physical V1 hardware with orthopedic doctors, farmers, or factory operators. Capture telemetry and iterate.',
    icon: CheckCircle2,
    deliverable: 'Field Telemetry Report',
    badge: 'Validation',
  },
  {
    day: 'DAY 90',
    title: 'Demo Day & Venture Launch',
    description: 'Present working product at the ESC National Showcase in front of active DeepTech angels, VCs, and patent advisors.',
    icon: Rocket,
    deliverable: 'Pre-Seed Term Sheet & IP',
    badge: 'Venture Launch',
  },
];

export const MemberTimeline: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="rounded-3xl border border-[#232731] bg-[#0c0d11] p-6 sm:p-10 space-y-8 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>

      {/* Header */}
      <div className="space-y-2">
        <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
          The 90-Day Sprint
        </span>
        <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          How an ESC Builder Ships in 90 Days
        </h3>
        <p className="text-xs sm:text-sm text-[#9ca3af] max-w-2xl">
          From the day you match on a problem statement to your final pilot demo, here is how the community scaffolds your execution.
        </p>
      </div>

      {/* Horizontal Steps on desktop, vertical on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {TIMELINE_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isSelected = idx === activeStep;

          return (
            <div
              key={idx}
              onClick={() => setActiveStep(idx)}
              className={`flex flex-col justify-between p-5 rounded-2xl border transition-all cursor-pointer relative ${
                isSelected
                  ? 'border-[#CCFF00] bg-[#141813] shadow-lg shadow-[#CCFF00]/15 scale-[1.02]'
                  : 'border-zinc-800/80 bg-[#101216] hover:border-zinc-700'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#CCFF00]">{step.day}</span>
                  <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {step.badge}
                  </span>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-[#CCFF00] border border-zinc-800">
                  <Icon className="h-5 w-5" />
                </div>

                <h4 className="font-display text-sm font-bold text-white">{step.title}</h4>
                <p className="text-xs text-[#9ca3af] leading-relaxed line-clamp-3">
                  {step.description}
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-400">
                <span>Output: </span>
                <strong className="text-white">{step.deliverable}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

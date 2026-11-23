import React, { useState } from 'react';
import { Cpu, Rocket, Flame, Sparkles, Target, Compass, Zap, ArrowRight } from 'lucide-react';

interface BranchNode {
  id: string;
  name: string;
  short: string;
  icon: React.ElementType;
  tech: string[];
  connectsTo: string[];
  roleExample: string;
}

const BRANCHES: BranchNode[] = [
  {
    id: 'mech',
    name: 'Mechanical & Mechatronics',
    short: 'MECH',
    icon: Compass,
    tech: ['SolidWorks', 'ANSYS FEA', 'SLS 3D Printing', 'Actuators'],
    connectsTo: ['elec', 'aero', 'med', 'cs'],
    roleExample: 'Chassis & Enclosure Architect',
  },
  {
    id: 'elec',
    name: 'Electrical & Embedded Systems',
    short: 'ELEC',
    icon: Cpu,
    tech: ['KiCad PCB', 'STM32 / ESP32', 'CAN-Bus', 'Power Electronics'],
    connectsTo: ['mech', 'cs', 'clean', 'med'],
    roleExample: 'Firmware & Circuit Designer',
  },
  {
    id: 'cs',
    name: 'Computer Science & AI/ML',
    short: 'CS/AI',
    icon: Target,
    tech: ['ROS2 Humble', 'PyTorch / YOLO', 'WebSockets', 'Edge Inference'],
    connectsTo: ['mech', 'elec', 'aero', 'med'],
    roleExample: 'Perception & Control Algorithms',
  },
  {
    id: 'aero',
    name: 'Aerospace & Avionics',
    short: 'AERO',
    icon: Rocket,
    tech: ['PX4 / ArduPilot', 'CFD Aerodynamics', 'Carbon Fiber', 'Telemetry'],
    connectsTo: ['mech', 'elec', 'cs'],
    roleExample: 'Fixed-Wing Flight Dynamics',
  },
  {
    id: 'med',
    name: 'MedTech & Bionics',
    short: 'BIOMED',
    icon: Sparkles,
    tech: ['Analog EMG Filtering', 'Kinematic Rigging', 'Silicone Casting'],
    connectsTo: ['mech', 'elec', 'cs'],
    roleExample: 'Assistive Prosthetic Integrator',
  },
  {
    id: 'clean',
    name: 'CleanTech & Energy Systems',
    short: 'ENERGY',
    icon: Flame,
    tech: ['BMS Battery Packs', 'MPPT Charge Control', 'Microgrid Modeling'],
    connectsTo: ['elec', 'mech'],
    roleExample: 'High-Altitude Power Generation',
  },
];

export const BranchNetworkDiagram: React.FC = () => {
  const [selectedBranch, setSelectedBranch] = useState<string>('mech');

  const current = BRANCHES.find((b) => b.id === selectedBranch) || BRANCHES[0];

  return (
    <div className="rounded-3xl border border-[#232731] bg-[#0c0d11] p-6 sm:p-10 space-y-8 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
            Cross-Disciplinary Team Mesh
          </span>
          <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            How Multidisciplinary Engineering Happens
          </h3>
          <p className="text-xs sm:text-sm text-[#9ca3af] max-w-xl">
            Software alone cannot move physical mass, and hardware without code is a paperweight. Select a branch to inspect its active interfaces.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-[#121419] px-3.5 py-1.5 font-mono text-[11px] text-[#CCFF00] flex items-center gap-2 self-start md:self-auto">
          <Zap className="h-3.5 w-3.5 animate-pulse" />
          <span>MESH ACTIVE // 6 DOMAINS</span>
        </div>
      </div>

      {/* Nodes Map */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
        {BRANCHES.map((branch) => {
          const Icon = branch.icon;
          const isSelected = branch.id === selectedBranch;
          const isConnected = current.connectsTo.includes(branch.id);

          return (
            <button
              key={branch.id}
              onClick={() => setSelectedBranch(branch.id)}
              className={`flex flex-col items-center text-center p-4 rounded-2xl border transition-all cursor-pointer relative ${
                isSelected
                  ? 'border-[#CCFF00] bg-[#161a14] shadow-lg shadow-[#CCFF00]/20 scale-105 z-20'
                  : isConnected
                  ? 'border-[#CCFF00]/50 bg-[#121418] text-white hover:border-[#CCFF00]'
                  : 'border-zinc-800/80 bg-[#101216] text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl mb-2 transition-transform ${
                  isSelected
                    ? 'bg-[#CCFF00] text-black shadow-md'
                    : isConnected
                    ? 'bg-zinc-800 text-[#CCFF00]'
                    : 'bg-zinc-900 text-zinc-500'
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="font-mono text-[10px] text-zinc-500 uppercase">{branch.short}</span>
              <span className={`font-display text-xs font-bold mt-1 line-clamp-1 ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                {branch.name.split(' ')[0]}
              </span>

              {/* Active signal ping for interconnected branches */}
              {isConnected && !isSelected && (
                <span className="absolute top-2 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#CCFF00] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#CCFF00]"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Branch Specification Card */}
      <div className="rounded-2xl border border-zinc-800 bg-[#111318] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div>
            <span className="font-mono text-[10px] text-[#CCFF00] uppercase">Selected Core Discipline</span>
            <h4 className="font-display text-lg font-bold text-white">{current.name}</h4>
          </div>
          <div className="text-xs font-mono text-zinc-400">
            Typical Project Role: <strong className="text-[#CCFF00]">{current.roleExample}</strong>
          </div>
        </div>

        <div>
          <span className="font-mono text-[10px] text-zinc-500 uppercase block mb-2">
            Toolchains & Production Stacks:
          </span>
          <div className="flex flex-wrap gap-2">
            {current.tech.map((t, idx) => (
              <span key={idx} className="rounded-lg bg-[#181a22] border border-zinc-800 px-3 py-1 font-mono text-xs text-zinc-200">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="pt-2 text-xs text-zinc-400 flex items-center gap-2">
          <span className="text-[#CCFF00] font-bold">Interconnects directly with:</span>
          <span className="text-white">
            {current.connectsTo
              .map((id) => BRANCHES.find((b) => b.id === id)?.name.split(' ')[0])
              .filter(Boolean)
              .join(' • ')}
          </span>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { 
  Rocket, 
  ShieldCheck, 
  Cpu, 
  Zap, 
  HeartHandshake, 
  Sparkles, 
  ArrowRight,
  Code2,
  CheckCircle2
} from 'lucide-react';

interface AboutProps {
  navigate: (path: string) => void;
}

export const About: React.FC<AboutProps> = ({ navigate }) => {
  return (
    <div className="min-h-screen bg-[#0b0c0e] py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-16">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2b2f38] bg-[#14161c] px-4 py-1.5 font-mono text-xs text-[#CCFF00]">
            Engineering Startup Company (ESC)
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-black text-white">
            Empower. Start. Create.
          </h1>
          <p className="text-base text-[#9ca3af] max-w-2xl mx-auto leading-relaxed">
            Engineering Startup Company (ESC) is an engineering and entrepreneurship-focused organisation that connects engineering students, innovators, startups and industry professionals to develop ideas, build products, explore opportunities and create real-world solutions.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-[#232731] bg-[#111317] p-8 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#CCFF00]/10 text-[#CCFF00]">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-white">1. EMPOWER</h3>
            <p className="text-xs text-[#9ca3af] leading-relaxed">
              We remove the financial and administrative roadblocks to hardware innovation. Free parts grants, access to maker facilities, and expert alumni guidance ensure no idea dies because of a ₹5,000 sensor bill.
            </p>
          </div>

          <div className="rounded-2xl border border-[#232731] bg-[#111317] p-8 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#CCFF00]/10 text-[#CCFF00]">
              <Rocket className="h-6 w-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-white">2. START</h3>
            <p className="text-xs text-[#9ca3af] leading-relaxed">
              We break down the silo between college departments. Computer scientists, electrical circuit designers, and mechanical fabrication wizards form multidisciplinary teams on Day 1.
            </p>
          </div>

          <div className="rounded-2xl border border-[#232731] bg-[#111317] p-8 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#CCFF00]/10 text-[#CCFF00]">
              <Cpu className="h-6 w-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-white">3. CREATE</h3>
            <p className="text-xs text-[#9ca3af] leading-relaxed">
              We focus on production-grade deliverables, working prototypes, and real customer pilots. Not toy mockups or generic resumes, but venture-backable engineering companies.
            </p>
          </div>
        </div>

        {/* The ESC Story */}
        <div className="rounded-2xl border border-[#232731] bg-[#0e1014] p-8 sm:p-12 space-y-6">
          <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
            Genesis
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Why We Started ESC
          </h2>
          <div className="space-y-4 text-xs sm:text-sm text-[#9ca3af] leading-relaxed">
            <p>
              In traditional engineering universities, students spend four rigorous years passing theoretical physics, circuit analysis, and mathematics exams. Yet, when they graduate, fewer than 2% have ever soldered a multilayer PCB, deployed a neural network on an edge microcontroller, or pitched an investor.
            </p>
            <p>
              Meanwhile, agricultural regions face grid failure, small clinics lack diagnostic imaging, and clean energy grids lack load balancing. We realized that the most ambitious builders in the country were sitting in lecture halls, scrolling through social media, starved of real problems and multidisciplinary peers.
            </p>
            <p className="text-white font-medium">
              ESC was created to be the alternative path: a community where student engineers get hands dirty, build real things, and launch startups while still in college.
            </p>
          </div>
        </div>

        {/* Operating Principles */}
        <div className="space-y-6">
          <h2 className="font-display text-2xl font-bold text-white text-center">
            Our Core Operating Principles
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {[
              { title: 'Zero Academic Gatekeeping', desc: 'Grades do not dictate ability. Passion, curiosity, and willingness to learn are what matter.' },
              { title: 'Physical Deliverables Over Pitch Slides', desc: 'We value working hardware prototypes and functional code over polished PowerPoint decks.' },
              { title: 'Radical Multidisciplinarity', desc: 'No project workspace can be monoculture. True innovations happen at the intersection of departments.' },
              { title: '100% Free & Open Ecosystem', desc: 'ESC will never charge student members or take equity in student projects.' },
            ].map((principle, idx) => (
              <div key={idx} className="rounded-xl border border-[#1f2229] bg-[#121419] p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#CCFF00]" />
                  <h4 className="font-display font-bold text-white">{principle.title}</h4>
                </div>
                <p className="text-[#8e919b] leading-relaxed">{principle.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-[#CCFF00]/40 bg-[#121612] p-8 text-center space-y-6">
          <h3 className="font-display text-2xl font-bold text-white">
            Become Part of the Next Cohort
          </h3>
          <p className="text-xs text-[#d4d4d8] max-w-lg mx-auto">
            Apply to the ESC Fellowship today and connect with fellow engineering founders across top colleges.
          </p>
          <button
            onClick={() => navigate('/apply')}
            className="rounded-xl bg-[#CCFF00] px-7 py-3 font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-[#b8e600] shadow-md shadow-[#CCFF00]/20"
          >
            Apply to Join ESC
          </button>
        </div>

      </div>
    </div>
  );
};

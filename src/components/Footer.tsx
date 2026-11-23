import React from 'react';
import { ArrowUpRight, Linkedin, Mail, HelpCircle } from 'lucide-react';
import { OFFICIAL_ESC_CONTACT } from '../utils/supportLogic';

interface FooterProps {
  navigate: (path: string) => void;
  replayIntro?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ navigate, replayIntro }) => {
  return (
    <footer className="w-full border-t border-[#1f2229] bg-[#08090b] text-[#8e919b]">
      {/* Top Banner / Engineering Ethos */}
      <div className="border-b border-[#1b1d24] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
              The ESC Philosophy
            </p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-white">
              “Study. Scroll. Repeat? What if you built something?”
            </h3>
          </div>
          <button
            onClick={() => navigate('/apply')}
            className="flex items-center gap-2 rounded-xl bg-[#CCFF00] px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-black transition-all hover:bg-[#b8e600] shadow-md shadow-[#CCFF00]/10 cursor-pointer"
          >
            Apply for Fellowship <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Compact Need Help? Support Strip */}
      <div className="border-b border-[#1b1d24] bg-[#0c0e12]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-[#39FF14]">
              <HelpCircle className="h-3.5 w-3.5" /> {OFFICIAL_ESC_CONTACT.heading}
            </div>
            <p className="text-xs text-[#9ca3af] leading-relaxed">
              {OFFICIAL_ESC_CONTACT.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <a
              href={OFFICIAL_ESC_CONTACT.mailtoHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#242832] bg-[#13161d] px-3.5 py-2 text-zinc-200 hover:border-[#39FF14]/60 hover:text-white transition-colors"
            >
              <Mail className="h-3.5 w-3.5 text-[#39FF14]" />
              {OFFICIAL_ESC_CONTACT.email}
            </a>
            <a
              href={OFFICIAL_ESC_CONTACT.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn Support"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#242832] bg-[#13161d] px-3 py-2 text-zinc-200 hover:border-[#39FF14]/60 hover:text-[#39FF14] transition-colors"
            >
              <Linkedin className="h-3.5 w-3.5 text-[#39FF14]" />
              LinkedIn
            </a>
            <button
              type="button"
              onClick={() => navigate('/support')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-[#32e010] transition-colors cursor-pointer"
            >
              Open Support Hub <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-5">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="h-10 w-10 overflow-hidden rounded-xl bg-black border border-[#2b2f38] p-1 flex items-center justify-center">
                <img
                  src="/assets/aistudio/IMG_20261112_135951_2ec3259f.png"
                  alt="ESC Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="font-display text-xl font-extrabold tracking-tight text-white">
                ESC
              </span>
            </div>
            <p className="text-xs leading-relaxed text-[#9ca3af] max-w-sm">
              Engineering Startup Company (ESC) is an engineering and entrepreneurship-focused organisation that connects engineering students, innovators, startups and industry professionals to develop ideas, build products, explore opportunities and create real-world solutions.
            </p>
            <div className="flex items-center gap-3 pt-2 text-[#9ca3af]">
              <a
                href={OFFICIAL_ESC_CONTACT.mailtoHref}
                aria-label="Email ESC Support"
                className="p-2 rounded-lg bg-[#14161b] hover:text-[#39FF14] transition-colors"
              >
                <Mail className="h-4 w-4" />
              </a>
              <a
                href={OFFICIAL_ESC_CONTACT.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="ESC Official LinkedIn"
                className="p-2 rounded-lg bg-[#14161b] hover:text-[#39FF14] transition-colors"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Ecosystem Links */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-white">
              Ecosystem
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => navigate('/problem-exchange')}
                  className="text-[#39FF14] font-semibold hover:underline transition-colors cursor-pointer"
                >
                  ESC Problem Exchange
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/projects')} className="hover:text-white transition-colors cursor-pointer">
                  Student Projects
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/ideas')} className="hover:text-white transition-colors cursor-pointer">
                  Startup Idea Lab
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/challenges')} className="hover:text-white transition-colors cursor-pointer">
                  Engineering Challenges
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/events')} className="hover:text-white transition-colors cursor-pointer">
                  Events &amp; Buildathons
                </button>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-white">
              Resources
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => navigate('/about')} className="hover:text-white transition-colors cursor-pointer">
                  About ESC
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/opportunities')} className="hover:text-white transition-colors cursor-pointer">
                  Grants &amp; Lab Access
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/verify')} className="hover:text-white transition-colors cursor-pointer">
                  Verify Certificate
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/support')} className="hover:text-[#39FF14] transition-colors cursor-pointer">
                  Need Help &amp; FAQ
                </button>
              </li>
              {replayIntro && (
                <li>
                  <button onClick={replayIntro} className="text-[#CCFF00] hover:underline transition-colors cursor-pointer">
                    🎬 Replay Cinematic Intro
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Governance & Verification */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-white">
              Transparency
            </h4>
            <p className="text-[11px] leading-relaxed text-[#6b7280]">
              ESC does not claim government or university degree accreditation. Certificates verify authorized completion of technical sprints and engineering deliverables within the student community.
            </p>
            <div className="rounded-lg border border-[#232731] bg-[#121419] p-3">
              <span className="text-[10px] font-mono text-[#CCFF00] block">ESC ENGINE v2.6</span>
              <span className="text-[11px] text-white">Production Cluster: Active</span>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="mt-12 border-t border-[#181a20] pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-[#6b7280]">
          <p>© {new Date().getFullYear()} ESC (Engineering Startup Company). All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="font-mono text-[#CCFF00]">Think. Engineer. Build. Launch.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};


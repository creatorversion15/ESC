import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Play, 
  Cpu, 
  Compass, 
  Users, 
  Lightbulb, 
  Rocket, 
  ShieldCheck, 
  Sparkles, 
  Target, 
  Calendar, 
  CheckCircle, 
  ExternalLink,
  ChevronRight,
  Flame,
  Award
} from 'lucide-react';
import { collection, doc, getDoc, query, limit, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type {
  ProblemStatement,
  Project,
  ChallengeItem,
  EventItem,
  Announcement,
  SiteSettings,
} from '../types';
import { isChallengePubliclyVisible, isEventPubliclyVisible } from '../utils/escLogic';
import { AnimatedCounter } from '../components/animations/AnimatedCounter';
import { SpotlightCard } from '../components/animations/SpotlightCard';
import { MagneticButton } from '../components/animations/MagneticButton';
import { ScrollReveal } from '../components/animations/ScrollReveal';
import { EngineeringStoryPipeline } from '../components/animations/EngineeringStoryPipeline';
import { BranchNetworkDiagram } from '../components/animations/BranchNetworkDiagram';
import { MemberTimeline } from '../components/animations/MemberTimeline';
import { LandingMembershipStatusPanel } from '../components/LandingMembershipStatusPanel';

interface HomeProps {
  navigate: (path: string) => void;
  openVideoModal: () => void;
}

export const Home: React.FC<HomeProps> = ({ navigate, openVideoModal }) => {
  const { user, signInWithGoogle } = useAuth();

  const [problems, setProblems] = useState<ProblemStatement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

  // Mouse parallax state for subtle 3D tilt
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2; // -1 to 1
    setMousePos({ x, y });
  };

  const handleHeroMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  useEffect(() => {
    const fetchData = async () => {
      const { INITIAL_PROBLEMS, INITIAL_PROJECTS } = await import('../lib/seedData');
      const [probRes, projRes, chalRes, evRes, annRes, settingsRes] = await Promise.allSettled([
        getDocs(query(collection(db, 'problems'), limit(3))),
        getDocs(query(collection(db, 'projects'), limit(3))),
        getDocs(query(collection(db, 'challenges'), where('isPublished', '==', true), limit(2))),
        getDocs(query(collection(db, 'events'), where('isPublished', '==', true), limit(2))),
        getDocs(query(collection(db, 'announcements'), where('isActive', '==', true), limit(4))),
        getDoc(doc(db, 'siteSettings', 'public')),
      ]);

      if (probRes.status === 'fulfilled' && !probRes.value.empty) {
        setProblems(probRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as ProblemStatement)));
      } else {
        setProblems(INITIAL_PROBLEMS.map((p, i) => ({ id: `init_prob_${i}`, ...p })));
      }

      if (projRes.status === 'fulfilled' && !projRes.value.empty) {
        setProjects(projRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as Project)));
      } else {
        setProjects(INITIAL_PROJECTS.map((p, i) => ({ id: `init_proj_${i}`, ...p })));
      }

      if (chalRes.status === 'fulfilled' && !chalRes.value.empty) {
        setChallenges(
          chalRes.value.docs
            .map((d) => ({ id: d.id, ...d.data() } as ChallengeItem))
            .filter((c) => isChallengePubliclyVisible(c))
        );
      } else {
        setChallenges([]);
      }

      if (evRes.status === 'fulfilled' && !evRes.value.empty) {
        setEvents(
          evRes.value.docs
            .map((d) => ({ id: d.id, ...d.data() } as EventItem))
            .filter((e) => isEventPubliclyVisible(e))
        );
      } else {
        setEvents([]);
      }

      if (annRes.status === 'fulfilled' && !annRes.value.empty) {
        const list = annRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setAnnouncements(list);
      }

      if (settingsRes.status === 'fulfilled' && settingsRes.value.exists()) {
        setSiteSettings(settingsRes.value.data() as SiteSettings);
      }
    };
    fetchData();
  }, []);

  const domains = [
    { title: 'Robotics & Autonomous', icon: Cpu, count: '24 Projects' },
    { title: 'Aerospace & Avionics', icon: Rocket, count: '18 Projects' },
    { title: 'CleanTech & Energy', icon: Flame, count: '31 Projects' },
    { title: 'MedTech & Bionics', icon: Sparkles, count: '14 Projects' },
    { title: 'DeepTech & AI/ML', icon: Target, count: '42 Projects' },
    { title: 'Embedded Systems & IoT', icon: Compass, count: '29 Projects' },
  ];

  // Headline words for animated reveal
  const headlineWords = [
    { text: "ENGINEERS", highlight: false },
    { text: "DON'T", highlight: false },
    { text: "JUST", highlight: false },
    { text: "IMAGINE", highlight: false },
    { text: "THE", highlight: false },
    { text: "FUTURE.", highlight: false },
    { text: "THEY", highlight: false },
    { text: "BUILD", highlight: true },
    { text: "IT.", highlight: true },
  ];

  const scrollToManifesto = () => {
    const el = document.getElementById('manifesto-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/about');
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Dynamic Authenticated Membership & Application Status Panel */}
      <LandingMembershipStatusPanel navigate={navigate} />

      {/* 1. CINEMATIC HERO SECTION */}
      <section 
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
        className="relative min-h-[95vh] flex flex-col justify-center items-center overflow-hidden border-b border-[#23262d] bg-[#0b0c0e] px-4 py-20 sm:px-6 lg:px-8"
      >
        {/* Animated Background Grid & Multi-tier Lighting */}
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none"></div>
        <div 
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-[#CCFF00]/10 blur-[150px] rounded-full pointer-events-none transition-transform duration-700 ease-out"
          style={{
            transform: `translate(calc(-50% + ${mousePos.x * 35}px), ${mousePos.y * 35}px)`,
          }}
        ></div>
        <div className="absolute bottom-10 -right-20 w-[450px] h-[300px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none"></div>

        {/* Floating Engineering Graphic Elements (3D Parallax Drift) */}
        <div 
          className="hidden lg:block absolute top-28 left-8 xl:left-16 pointer-events-none transition-transform duration-500 ease-out z-10"
          style={{
            transform: `translate(${mousePos.x * -18}px, ${mousePos.y * -18}px)`,
          }}
        >
          <div className="rounded-xl border border-zinc-800/80 bg-[#121418]/90 p-3.5 backdrop-blur-md shadow-xl space-y-1.5 animate-float-slow">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#CCFF00] animate-ping"></span>
              <span className="font-mono text-[10px] text-[#CCFF00] font-semibold">SYS_TELEMETRY // ACTIVE</span>
            </div>
            <p className="font-mono text-[9px] text-zinc-400">CLK: 480MHz • BUS: CAN-FD</p>
            <p className="font-mono text-[9px] text-zinc-500">LAT: 18.5204° N • LON: 73.8567° E</p>
          </div>
        </div>

        <div 
          className="hidden lg:block absolute top-36 right-8 xl:right-16 pointer-events-none transition-transform duration-500 ease-out z-10"
          style={{
            transform: `translate(${mousePos.x * 22}px, ${mousePos.y * 22}px)`,
          }}
        >
          <div className="rounded-xl border border-zinc-800/80 bg-[#121418]/90 p-3.5 backdrop-blur-md shadow-xl space-y-1.5 animate-float-reverse">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-zinc-400">HARDWARE CAD</span>
              <span className="text-[#CCFF00] font-bold">REV 3.4</span>
            </div>
            <div className="h-1 w-24 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full w-4/5 bg-[#CCFF00] rounded-full animate-pulse"></div>
            </div>
            <p className="font-mono text-[9px] text-zinc-500">SCHEMATIC: PCB_SWARM_V2</p>
          </div>
        </div>

        <div 
          className="hidden xl:block absolute bottom-32 left-20 pointer-events-none transition-transform duration-500 ease-out z-10"
          style={{
            transform: `translate(${mousePos.x * 12}px, ${mousePos.y * 12}px)`,
          }}
        >
          <div className="rounded-xl border border-zinc-800/80 bg-[#121418]/80 px-3 py-2 text-[10px] font-mono text-zinc-400 flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-[#CCFF00]" />
            <span>STM32H7 • ROS2 HUMBLE</span>
          </div>
        </div>

        <div 
          className="hidden xl:block absolute bottom-36 right-24 pointer-events-none transition-transform duration-500 ease-out z-10"
          style={{
            transform: `translate(${mousePos.x * -14}px, ${mousePos.y * -14}px)`,
          }}
        >
          <div className="rounded-xl border border-zinc-800/80 bg-[#121418]/80 px-3 py-2 text-[10px] font-mono text-zinc-400 flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>PROTOTYPE &amp; GRANT POOL: ₹3 L+</span>
          </div>
        </div>

        {/* Hero Center Content Container with Parallax Perspective */}
        <div 
          className="relative mx-auto max-w-5xl text-center space-y-8 z-20 pt-6 transition-transform duration-300 ease-out"
          style={{
            transform: `perspective(1000px) rotateX(${mousePos.y * -3.5}deg) rotateY(${mousePos.x * 3.5}deg)`,
          }}
        >
          
          {/* Official Tagline Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-[#2e333d] bg-[#14161c]/90 px-4 py-1.5 shadow-lg backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-[#CCFF00] animate-pulse"></span>
            <span className="font-mono text-xs font-semibold text-[#CCFF00] tracking-wider uppercase">
              {siteSettings?.heroBadgeText || 'Think. Engineer. Build. Launch.'}
            </span>
            <span className="h-3 w-px bg-[#2e333d]"></span>
            <span className="text-xs text-[#9ca3af]">
              {siteSettings?.applicationCycleLabel || 'Engineering Startup Company'}
            </span>
          </div>

          {/* Animated Headline - Word by Word Reveal */}
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.08] flex flex-wrap justify-center gap-x-3 gap-y-2">
            {headlineWords.map((item, idx) => (
              <span
                key={idx}
                className={`inline-block transition-all duration-700 ${
                  item.highlight
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-[#CCFF00] via-[#e2ff4f] to-white font-black'
                    : 'text-white'
                }`}
                style={{
                  animation: `fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.08}s both`,
                }}
              >
                {item.text}
              </span>
            ))}
          </h1>

          {/* Official ESC Description */}
          <p className="mx-auto max-w-3xl text-base sm:text-lg text-[#9ca3af] leading-relaxed">
            Engineering Startup Company (ESC) is an engineering and entrepreneurship-focused organisation that connects engineering students, innovators, startups and industry professionals to develop ideas, build products, explore opportunities and create real-world solutions.
          </p>

          {/* User Requested Buttons & Video Trigger */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            
            {/* Button 1: EXPLORE ESC */}
            <MagneticButton
              onClick={scrollToManifesto}
              variant="outline"
              className="border-[#303540] bg-[#14171d]/90 hover:border-[#CCFF00]/50 hover:text-[#CCFF00] text-xs sm:text-sm font-semibold tracking-wider uppercase px-6 py-3.5"
            >
              <Compass className="h-4 w-4 text-[#CCFF00]" />
              <span>Explore ESC</span>
            </MagneticButton>

            {/* Button 2: APPLY FOR FELLOWSHIP */}
            {siteSettings?.applicationsOpen === false ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/30 px-6 py-3.5 text-xs sm:text-sm font-bold tracking-wider uppercase text-amber-300">
                <span>Fellowship Applications Closed</span>
              </div>
            ) : (
              <MagneticButton
                onClick={() => navigate('/apply')}
                variant="primary"
                className="text-xs sm:text-sm font-extrabold tracking-wider uppercase px-7 py-3.5 shadow-xl shadow-[#CCFF00]/25"
              >
                <span>APPLY FOR FELLOWSHIP</span>
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>
            )}

            {/* Watch Community Film button */}
            <MagneticButton
              onClick={openVideoModal}
              variant="ghost"
              className="px-5 py-3.5 text-xs sm:text-sm font-medium text-[#d4d4d8] hover:text-white hover:bg-zinc-900/60"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#CCFF00]/20 text-[#CCFF00]">
                <Play className="h-3 w-3 fill-[#CCFF00]" />
              </div>
              <span>Watch Manifesto Film</span>
            </MagneticButton>
          </div>

          {/* Official Cinematic Video Teaser Preview Banner */}
          <div className="pt-8 max-w-4xl mx-auto">
            <div 
              onClick={openVideoModal}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#2b2f38] bg-[#0c0d10] p-2 shadow-2xl transition-all hover:border-[#CCFF00]/50 hover:shadow-2xl hover:shadow-[#CCFF00]/10"
            >
              <div className="relative aspect-[4/3] sm:aspect-[2.4/1] w-full overflow-hidden rounded-xl bg-black">
                <video
                  src="/assets/aistudio/WhatsApp_Video_2026-11-11_at_9.56.59_AM_828a432b.mp4"
                  className="h-full w-full object-cover opacity-85 transition-transform duration-500 group-hover:scale-105"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"></div>
                
                {/* Overlay Text & Play Badge */}
                <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
                  <div className="flex justify-between items-center gap-2">
                    <span className="rounded-md bg-black/70 px-2.5 py-1 text-[10px] sm:text-[11px] font-mono text-[#CCFF00] border border-[#333] whitespace-nowrap">
                      OFFICIAL SHOWREEL
                    </span>
                    <span className="text-[10px] sm:text-xs font-mono text-zinc-300 text-right">
                      EMPOWER. START. CREATE.
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div className="text-left">
                      <p className="font-display text-sm sm:text-2xl font-bold text-white tracking-tight leading-snug">
                        “STUDY. SCROLL. REPEAT. BUT WHAT IF YOU BUILT SOMETHING?”
                      </p>
                      <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">
                        Click to watch the full cinematic manifesto with sound
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#CCFF00] text-black shadow-lg shadow-[#CCFF00]/40 transition-transform group-hover:scale-110 shrink-0">
                      <Play className="h-5 w-5 fill-black translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Metric Stats Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 border-t border-[#1d2027]">
            <div className="rounded-xl border border-[#1f222a] bg-[#111317]/80 p-4 text-center backdrop-blur-sm">
              <AnimatedCounter value={1450} suffix="+" className="font-display text-2xl sm:text-3xl font-extrabold text-[#CCFF00]" />
              <p className="text-xs text-[#8e919b] mt-0.5 font-mono">Student Engineers</p>
            </div>
            <div className="rounded-xl border border-[#1f222a] bg-[#111317]/80 p-4 text-center backdrop-blur-sm">
              <AnimatedCounter value={84} className="font-display text-2xl sm:text-3xl font-extrabold text-white" />
              <p className="text-xs text-[#8e919b] mt-0.5 font-mono">Hardware & AI Projects</p>
            </div>
            <div className="rounded-xl border border-[#1f222a] bg-[#111317]/80 p-4 text-center backdrop-blur-sm">
              <AnimatedCounter value={3} prefix="₹" suffix=" L+" duration={650} className="font-display text-2xl sm:text-3xl font-extrabold text-[#CCFF00]" />
              <p className="text-xs text-[#8e919b] mt-0.5 font-mono">Prototype &amp; Grant Pool</p>
              <p className="text-[10px] text-zinc-500 mt-1.5 leading-snug">
                Subject to eligibility, selection and programme approval.
              </p>
            </div>
            <div className="rounded-xl border border-[#1f222a] bg-[#111317]/80 p-4 text-center backdrop-blur-sm">
              <span className="font-display text-2xl sm:text-3xl font-extrabold text-white">100% Free</span>
              <p className="text-xs text-[#8e919b] mt-0.5 font-mono">For Every Student</p>
            </div>
          </div>

        </div>

        {/* User Requested Subtle Scrolling Indicator */}
        <div 
          onClick={scrollToManifesto}
          className="pt-12 flex flex-col items-center gap-2 text-zinc-500 hover:text-[#CCFF00] transition-colors cursor-pointer select-none z-20"
        >
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase">
            Scroll to Explore
          </span>
          <div className="h-8 w-5 rounded-full border border-zinc-700 flex items-start justify-center p-1">
            <div className="h-1.5 w-1 rounded-full bg-[#CCFF00] animate-bounce"></div>
          </div>
        </div>
      </section>

      {/* LIVE ANNOUNCEMENTS & ECOSYSTEM BULLETINS (Admin Managed) */}
      {(announcements.length > 0 || siteSettings?.heroAnnouncement) && (
        <section className="py-10 bg-[#0d100e] border-b border-[#1f2229] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-4">
            {siteSettings?.heroAnnouncement && (
              <div className="rounded-2xl border border-[#CCFF00]/30 bg-[#121612] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-[#CCFF00] px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-black shrink-0">
                    {siteSettings.applicationsOpen ? 'Applications Open' : 'Update'}
                  </span>
                  <p className="text-xs sm:text-sm text-white font-medium">
                    {siteSettings.heroAnnouncement}
                  </p>
                </div>
                {siteSettings.applicationsOpen && (
                  <button
                    onClick={() => navigate('/apply')}
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#CCFF00] hover:underline shrink-0 cursor-pointer"
                  >
                    Apply Now <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {announcements.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="rounded-xl border border-[#232731] bg-[#111317] p-4 space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="uppercase text-[#CCFF00] font-bold">{ann.type}</span>
                        <span className="text-zinc-500">
                          {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <h3 className="font-display text-sm font-bold text-white">{ann.title}</h3>
                      <p className="text-xs text-[#9ca3af] line-clamp-2">{ann.message}</p>
                    </div>
                    {ann.linkPath && (
                      <button
                        onClick={() => navigate(ann.linkPath!)}
                        className="text-[11px] font-mono text-[#CCFF00] hover:underline flex items-center gap-1 pt-2 cursor-pointer"
                      >
                        {ann.linkLabel || 'Explore'} <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 2. THE ESC MANIFESTO SECTION */}
      <section id="manifesto-section" className="py-20 bg-[#08090b] border-b border-[#1f2229] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-10">
          <ScrollReveal direction="up">
            <div className="text-center space-y-3">
              <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
                The Problem with Standard Engineering College
              </span>
              <h2 className="font-display text-3xl sm:text-5xl font-black text-white leading-tight">
                Four years of exams. Zero products shipped. <br />
                <span className="text-[#CCFF00]">We are changing the default.</span>
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <ScrollReveal direction="left" delay={100}>
              <div className="rounded-2xl border border-[#232731] bg-[#0e1014] p-8 space-y-4 h-full">
                <span className="font-mono text-xs text-red-400 uppercase tracking-wider">The Standard Trap</span>
                <h3 className="font-display text-xl font-bold text-white">Passive Theory & Generic Resumes</h3>
                <p className="text-sm text-[#9ca3af] leading-relaxed">
                  Most students build the same copy-pasted calculator or e-commerce clone for a final semester grade. No physical prototyping, no customer discovery, no hardware labs, and zero multidisciplinary teamwork.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={200}>
              <div className="rounded-2xl border border-[#CCFF00]/40 bg-[#121612] p-8 space-y-4 relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 p-4">
                  <span className="flex h-3 w-3 rounded-full bg-[#CCFF00]"></span>
                </div>
                <span className="font-mono text-xs text-[#CCFF00] uppercase tracking-wider">The ESC Way</span>
                <h3 className="font-display text-xl font-bold text-white">Empower. Start. Create.</h3>
                <p className="text-sm text-[#d4d4d8] leading-relaxed">
                  ESC matches Mechanical, Electrical, Computer Science, and Biotech students around verified real-world friction. We provide rapid fabrication grants, lab test benches, mentor feedback, and seed pitch avenues.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* 2.5 STORYTELLING: THE 5-STEP ENGINEERING LIFECYCLE */}
      <section className="py-20 bg-[#0a0b0e] border-b border-[#1f2229] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <ScrollReveal direction="up">
            <EngineeringStoryPipeline />
          </ScrollReveal>
        </div>
      </section>

      {/* 3. WHY JOIN ESC? */}
      <section className="py-24 bg-[#0b0c0e] border-b border-[#23262d] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-14">
          <ScrollReveal direction="up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-3">
                <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
                  Ecosystem Infrastructure
                </span>
                <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
                  Everything required to turn a technical spark into a company.
                </h2>
              </div>
              <button
                onClick={() => navigate('/about')}
                className="text-xs font-mono text-[#CCFF00] hover:underline flex items-center gap-1.5 self-start cursor-pointer"
              >
                Learn our full methodology <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <ScrollReveal direction="up" delay={50}>
              <SpotlightCard className="p-6 space-y-4 h-full">
                <div className="h-10 w-10 rounded-xl bg-[#CCFF00]/10 flex items-center justify-center text-[#CCFF00]">
                  <Target className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-white">1. ESC Problem Exchange</h3>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Don’t build solutions looking for a problem. Access vetted operational friction from industries, healthcare clinics, and agriculture.
                </p>
              </SpotlightCard>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={150}>
              <SpotlightCard className="p-6 space-y-4 h-full">
                <div className="h-10 w-10 rounded-xl bg-[#CCFF00]/10 flex items-center justify-center text-[#CCFF00]">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-white">2. Multidisciplinary Collaboration</h3>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Hardware needs software, and algorithms need enclosures. Collaborate with engineering peers across departments inside active ESC project workspaces.
                </p>
              </SpotlightCard>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={250}>
              <SpotlightCard className="p-6 space-y-4 h-full">
                <div className="h-10 w-10 rounded-xl bg-[#CCFF00]/10 flex items-center justify-center text-[#CCFF00]">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-white">3. Rapid Prototyping Grants</h3>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Zero out-of-pocket costs. Approved project workspaces receive parts credits for PCBs, sensors, 3D printing, and microcontrollers.
                </p>
              </SpotlightCard>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={350}>
              <SpotlightCard className="p-6 space-y-4 h-full">
                <div className="h-10 w-10 rounded-xl bg-[#CCFF00]/10 flex items-center justify-center text-[#CCFF00]">
                  <Rocket className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-white">4. Venture & Pre-Seed Launch</h3>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Direct access to active DeepTech VCs, patent attorneys, and alumni founders who scaled from student dorms to high-growth startups.
                </p>
              </SpotlightCard>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* 4. PROBLEM DISCOVERY BANK SPOTLIGHT */}
      <section className="py-24 bg-[#08090b] border-b border-[#23262d] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-10">
          <ScrollReveal direction="up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2">
                <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
                  ESC Problem Exchange Spotlight
                </span>
                <h2 className="font-display text-3xl font-extrabold text-white">
                  Urgent Real-World Problems Awaiting Builders
                </h2>
              </div>
              <button
                onClick={() => navigate('/problem-exchange')}
                className="flex items-center gap-2 rounded-xl bg-[#17191e] border border-[#2e323b] px-4 py-2 text-xs font-mono text-[#f4f4f0] hover:border-[#CCFF00] hover:text-[#CCFF00] transition-colors cursor-pointer"
              >
                Explore Problem Exchange <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {problems.map((prob, idx) => (
              <ScrollReveal key={prob.id} direction="up" delay={idx * 100}>
                <SpotlightCard
                  onClick={() => navigate('/problem-exchange')}
                  className="p-6 flex flex-col justify-between h-full group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="rounded bg-[#1a1d24] px-2.5 py-1 text-[#CCFF00]">
                        {prob.industry}
                      </span>
                      <span className="capitalize text-zinc-400">
                        {prob.difficulty}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-white group-hover:text-[#CCFF00] transition-colors">
                      {prob.title}
                    </h3>
                    <p className="text-xs text-[#8e919b] line-clamp-3 leading-relaxed">
                      {prob.description}
                    </p>
                  </div>

                  <div className="pt-6 border-t border-[#1c1f26] mt-4 flex items-center justify-between text-xs">
                    <span className="font-mono text-[#9ca3af]">
                      🔥 {prob.interestCount || 0} Engineers Interested
                    </span>
                    <span className="text-[#CCFF00] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      View Brief <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </SpotlightCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* 5. FEATURED STUDENT PROJECTS */}
      <section className="py-24 bg-[#0b0c0e] border-b border-[#23262d] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-12">
          <ScrollReveal direction="up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2">
                <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
                  Production Workspaces
                </span>
                <h2 className="font-display text-3xl font-extrabold text-white">
                  Featured Engineering Deliverables
                </h2>
              </div>
              <button
                onClick={() => navigate('/projects')}
                className="flex items-center gap-2 rounded-xl bg-[#CCFF00] px-4 py-2 text-xs font-display font-bold uppercase text-black hover:bg-[#b8e600] transition-colors cursor-pointer"
              >
                Explore All Projects <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projects.map((proj, idx) => (
              <ScrollReveal key={proj.id} direction="up" delay={idx * 100}>
                <SpotlightCard className="p-6 space-y-6 flex flex-col justify-between h-full">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[#1b1e25] border border-[#2b2f38] px-3 py-1 font-mono text-[10px] text-zinc-300">
                        {proj.category}
                      </span>
                      <span className="rounded-full bg-[#CCFF00]/10 border border-[#CCFF00]/30 px-2.5 py-0.5 font-mono text-[10px] text-[#CCFF00] uppercase">
                        {proj.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-lg font-bold text-white">
                        {proj.title}
                      </h3>
                      <p className="text-xs text-[#8e919b] mt-2 line-clamp-3 leading-relaxed">
                        {proj.description}
                      </p>
                    </div>

                    {/* Skills badges */}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {proj.requiredSkills?.slice(0, 3).map((sk, sidx) => (
                        <span key={sidx} className="rounded bg-[#17191f] px-2 py-0.5 text-[10px] font-mono text-[#a1a1aa]">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#1f2229] pt-4 flex items-center justify-between text-xs">
                    <span className="text-[#9ca3af]">Lead: <strong className="text-white">{proj.leaderName}</strong></span>
                    <button
                      onClick={() => navigate('/projects')}
                      className="text-[#CCFF00] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      View Project <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </SpotlightCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* 5.5 STORYTELLING: 90-DAY PRODUCT SPRINT TIMELINE */}
      <section className="py-20 bg-[#08090b] border-b border-[#23262d] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <ScrollReveal direction="up">
            <MemberTimeline />
          </ScrollReveal>
        </div>
      </section>

      {/* 6. ENGINEERING DOMAINS & MESH DIAGRAM */}
      <section className="py-20 bg-[#0b0c0e] border-b border-[#23262d] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-12">
          <ScrollReveal direction="up">
            <BranchNetworkDiagram />
          </ScrollReveal>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4">
            {domains.map((dom, i) => {
              const Icon = dom.icon;
              return (
                <ScrollReveal key={i} direction="up" delay={i * 60}>
                  <SpotlightCard
                    onClick={() => navigate('/projects')}
                    className="p-5 text-center space-y-3 cursor-pointer group"
                  >
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#17191e] text-[#CCFF00] group-hover:scale-110 transition-transform">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-xs font-bold text-white group-hover:text-[#CCFF00]">
                      {dom.title}
                    </h3>
                    <span className="text-[10px] font-mono text-[#71717a] block">
                      {dom.count}
                    </span>
                  </SpotlightCard>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. UPCOMING CHALLENGES & EVENTS */}
      <section className="py-24 bg-[#08090b] border-b border-[#23262d] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-12">
          <ScrollReveal direction="up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2">
                <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
                  High-Stakes Sprints
                </span>
                <h2 className="font-display text-3xl font-extrabold text-white">
                  Upcoming Challenges &amp; Buildathons
                </h2>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/challenges')}
                  className="text-xs font-mono text-[#CCFF00] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Challenges <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => navigate('/events')}
                  className="text-xs font-mono text-zinc-300 hover:text-[#CCFF00] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Events Calendar <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </ScrollReveal>

          {challenges.length === 0 && events.length === 0 ? (
            <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-4">
              <Calendar className="h-9 w-9 text-zinc-600 mx-auto" />
              <h3 className="font-display text-xl font-bold text-white">
                No live challenges or events scheduled right now
              </h3>
              <p className="text-xs text-[#9ca3af] max-w-lg mx-auto leading-relaxed">
                New engineering challenges, buildathons, and workshops are published directly by the ESC Council. Explore open problem statements or submit an idea in the meantime.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  onClick={() => navigate('/challenges')}
                  className="rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
                >
                  Challenges Hub
                </button>
                <button
                  onClick={() => navigate('/events')}
                  className="rounded-xl border border-[#2b2f38] px-5 py-2.5 font-mono text-xs text-zinc-200 hover:border-[#CCFF00] cursor-pointer"
                >
                  Events Page
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {challenges.map((ch, idx) => (
                <ScrollReveal key={ch.id} direction="up" delay={idx * 100}>
                  <SpotlightCard className="p-8 space-y-6 flex flex-col justify-between h-full">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="rounded bg-[#CCFF00]/10 text-[#CCFF00] px-3 py-1 font-semibold uppercase">
                          Challenge • {ch.category}
                        </span>
                        <span className="text-[#9ca3af] flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" /> {ch.registrationDeadline || 'Open'}
                        </span>
                      </div>

                      <h3 className="font-display text-xl font-bold text-white">{ch.title}</h3>
                      <p className="text-xs text-[#9ca3af] leading-relaxed line-clamp-3">
                        {ch.description}
                      </p>

                      {ch.prizeOrRewards && (
                        <div className="rounded-xl border border-[#2e3340] bg-[#161920] p-3 text-xs">
                          <span className="font-mono text-[#CCFF00] block text-[11px] uppercase">
                            Grants &amp; Rewards:
                          </span>
                          <span className="text-white font-medium">{ch.prizeOrRewards}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[#20232b]">
                      <span className="text-xs text-[#9ca3af]">
                        {ch.registeredCount || 0} builders registered
                      </span>
                      <button
                        onClick={() => navigate('/challenges')}
                        className="rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] transition-colors cursor-pointer"
                      >
                        Enter Challenge
                      </button>
                    </div>
                  </SpotlightCard>
                </ScrollReveal>
              ))}

              {events.map((ev, idx) => (
                <ScrollReveal key={ev.id} direction="up" delay={(challenges.length + idx) * 100}>
                  <SpotlightCard className="p-8 space-y-6 flex flex-col justify-between h-full">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="rounded bg-[#CCFF00]/10 text-[#CCFF00] px-3 py-1 font-semibold uppercase">
                          {ev.type}
                        </span>
                        <span className="text-[#9ca3af] flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" /> {ev.date}
                        </span>
                      </div>

                      <h3 className="font-display text-xl font-bold text-white">{ev.title}</h3>
                      <p className="text-xs text-[#9ca3af] leading-relaxed line-clamp-3">
                        {ev.description}
                      </p>

                      {ev.prizes && (
                        <div className="rounded-xl border border-[#2e3340] bg-[#161920] p-3 text-xs">
                          <span className="font-mono text-[#CCFF00] block text-[11px] uppercase">
                            Prize Pool &amp; Grants:
                          </span>
                          <span className="text-white font-medium">{ev.prizes}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[#20232b]">
                      <span className="text-xs text-[#9ca3af]">
                        {ev.registeredCount || 0} engineers registered
                      </span>
                      <button
                        onClick={() => navigate('/events')}
                        className="rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] transition-colors cursor-pointer"
                      >
                        Register Free
                      </button>
                    </div>
                  </SpotlightCard>
                </ScrollReveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 8. COMMUNITY TESTIMONIALS */}
      <section className="py-20 bg-[#0b0c0e] border-b border-[#23262d] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-12">
          <ScrollReveal direction="up">
            <div className="text-center space-y-3">
              <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
                From Dorm Labs to Pre-Seed
              </span>
              <h2 className="font-display text-3xl font-extrabold text-white">
                What Real Student Builders Say
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ScrollReveal direction="up" delay={50}>
              <SpotlightCard className="p-6 space-y-4 h-full">
                <p className="text-xs text-[#d4d4d8] leading-relaxed italic">
                  “In my university, computer science students never talked to mechanical students. Through ESC, we assembled a cross-disciplinary drone avionics project in 3 days and deployed our first vineyard test run.”
                </p>
                <div className="border-t border-[#1c1f26] pt-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[#1e222b] flex items-center justify-center font-bold text-white text-xs">
                    KD
                  </div>
                  <div>
                    <h4 className="font-display text-xs font-bold text-white">Kavya Deshmukh</h4>
                    <p className="text-[10px] text-[#71717a]">Lead, SolAura Autonomous Swarm</p>
                  </div>
                </div>
              </SpotlightCard>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={150}>
              <SpotlightCard className="p-6 space-y-4 h-full">
                <p className="text-xs text-[#d4d4d8] leading-relaxed italic">
                  “Most colleges teach entrepreneurship via PPTs. ESC gave our bionic arm team ₹35,000 for SLS nylon printing and matched us with an orthopedic surgeon to test our grip telemetry.”
                </p>
                <div className="border-t border-[#1c1f26] pt-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[#1e222b] flex items-center justify-center font-bold text-white text-xs">
                    AV
                  </div>
                  <div>
                    <h4 className="font-display text-xs font-bold text-white">Aditya Verma</h4>
                    <p className="text-[10px] text-[#71717a]">Mechatronics 4th Year, BionicGrip</p>
                  </div>
                </div>
              </SpotlightCard>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={250}>
              <SpotlightCard className="p-6 space-y-4 h-full">
                <p className="text-xs text-[#d4d4d8] leading-relaxed italic">
                  “I submitted a problem statement about rural feeder frequency fluctuations. Two weeks later, a team from 3 colleges was simulating the load balancer. ESC is where engineering actually happens.”
                </p>
                <div className="border-t border-[#1c1f26] pt-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[#1e222b] flex items-center justify-center font-bold text-white text-xs">
                    RS
                  </div>
                  <div>
                    <h4 className="font-display text-xs font-bold text-white">Rohan Shinde</h4>
                    <p className="text-[10px] text-[#71717a]">Founder, HyperKite CleanTech</p>
                  </div>
                </div>
              </SpotlightCard>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* 9. JOIN ESC CALL TO ACTION */}
      <section className="relative py-24 bg-[#08090b] px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none"></div>
        <div className="relative mx-auto max-w-4xl space-y-8 z-10">
          <ScrollReveal direction="up">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-black border border-[#2e333e] shadow-xl overflow-hidden p-2">
              <img 
                src="/assets/aistudio/IMG_20261112_135951_2ec3259f.png" 
                alt="ESC" 
                className="h-full w-full object-contain"
              />
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={100}>
            <h2 className="font-display text-3xl sm:text-5xl font-black text-white">
              Ready to Build Your Engineering Legacy?
            </h2>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={150}>
            <p className="mx-auto max-w-2xl text-sm sm:text-base text-[#9ca3af] leading-relaxed">
              Membership is merit-based and 100% free for all engineering students. Apply now, get your skill portfolio vetted, and access real labs, real problems, and real venture backers.
            </p>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={200}>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              {siteSettings?.applicationsOpen === false ? (
                <div className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/30 px-7 py-4 text-xs sm:text-sm font-bold tracking-wider uppercase text-amber-300">
                  <span>Fellowship Applications Closed</span>
                </div>
              ) : (
                <MagneticButton
                  onClick={() => navigate('/apply')}
                  variant="primary"
                  className="px-8 py-4 text-xs sm:text-sm font-extrabold tracking-wider uppercase shadow-xl shadow-[#CCFF00]/25"
                >
                  <span>APPLY FOR FELLOWSHIP</span>
                  <ArrowRight className="h-4 w-4" />
                </MagneticButton>
              )}
              
              <MagneticButton
                onClick={() => navigate('/ideas')}
                variant="outline"
                className="px-6 py-4 text-xs sm:text-sm font-medium border-[#2b2f38] bg-[#14161b] hover:border-[#CCFF00]"
              >
                <span>Submit to Startup Lab</span>
              </MagneticButton>
            </div>
          </ScrollReveal>
        </div>
      </section>

    </div>
  );
};

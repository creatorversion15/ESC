import React, { useState, useEffect } from 'react';
import {
  Menu,
  X,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  Lightbulb,
  FolderGit2,
  Award,
  ChevronDown,
  Sparkles,
  Megaphone,
  ArrowRight,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Announcement } from '../types';

interface NavbarProps {
  currentPath: string;
  navigate: (path: string) => void;
  openVideoModal?: () => void;
  replayIntro?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, navigate, openVideoModal }) => {
  const {
    user,
    role,
    isSuperAdmin,
    isAdmin,
    isApprovedMember,
    membershipJourney,
    authNotice,
    dismissNotice,
    signInWithGoogle,
    signInWithGoogleRedirect,
    signOut,
  } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [pinnedAnnouncement, setPinnedAnnouncement] = useState<Announcement | null>(null);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState<string | null>(null);

  const navLinks = [
    { label: 'Problem Exchange', path: '/problem-exchange', highlight: true },
    { label: 'Projects', path: '/projects' },
    { label: 'Startup Lab', path: '/ideas' },
    { label: 'Challenges', path: '/challenges' },
    { label: 'Events', path: '/events' },
    { label: 'Opportunities', path: '/opportunities' },
    { label: 'Verify Cert', path: '/verify' },
    { label: 'Need Help', path: '/support' },
  ];

  useEffect(() => {
    const loadPinnedAnnouncement = async () => {
      try {
        const q = query(
          collection(db, 'announcements'),
          where('isActive', '==', true)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const items = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Announcement) }))
            .filter((a) => a.isPinned);
          items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setPinnedAnnouncement(items[0] || null);
        } else {
          setPinnedAnnouncement(null);
        }
      } catch {
        // Non-fatal if announcements collection is empty or unreadable
      }
    };
    loadPinnedAnnouncement();
  }, [currentPath]);

  const handleNav = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  };

  const roleBadgeLabel = isSuperAdmin
    ? 'Super Admin'
    : isAdmin
    ? 'Administrator'
    : membershipJourney.state === 'suspended'
    ? 'Suspended'
    : membershipJourney.state === 'inactive'
    ? 'Inactive'
    : role === 'project_lead' || role === 'lead'
    ? 'Project Lead'
    : isApprovedMember
    ? 'Approved Member'
    : membershipJourney.state === 'pending_review'
    ? 'Under Review'
    : membershipJourney.state === 'rejected'
    ? 'Not Approved'
    : 'Applicant';

  const dashboardNavLabel = membershipJourney.canAccessMemberDashboard
    ? 'Member Dashboard'
    : 'Application Status';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#23262d] bg-[#0b0c0e]/90 backdrop-blur-md">
      {/* Live Pinned Announcement Banner */}
      {pinnedAnnouncement && dismissedAnnouncementId !== pinnedAnnouncement.id && (
        <div className="bg-[#121610] border-b border-[#CCFF00]/25 px-4 py-2 text-xs text-zinc-200 flex items-center justify-between gap-3">
          <div className="mx-auto flex max-w-7xl w-full items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex items-center gap-1 rounded bg-[#CCFF00]/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#CCFF00] shrink-0">
                <Megaphone className="h-3 w-3" /> {pinnedAnnouncement.type}
              </span>
              <span className="font-semibold text-white truncate">{pinnedAnnouncement.title}</span>
              <span className="hidden sm:inline text-zinc-400 truncate">— {pinnedAnnouncement.message}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {pinnedAnnouncement.linkPath && (
                <button
                  onClick={() => handleNav(pinnedAnnouncement.linkPath!)}
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#CCFF00] hover:underline cursor-pointer"
                >
                  {pinnedAnnouncement.linkLabel || 'View'} <ArrowRight className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => setDismissedAnnouncementId(pinnedAnnouncement.id || 'dismissed')}
                className="text-zinc-500 hover:text-white text-xs cursor-pointer"
                aria-label="Dismiss announcement"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth notice banner (if Google popup was blocked or closed) */}
      {authNotice && (
        <div className="bg-[#18150c] border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
            <span>{authNotice}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => signInWithGoogleRedirect()}
              className="px-2.5 py-1 rounded bg-[#CCFF00] text-black font-bold uppercase text-[10px] hover:bg-[#b8e600] cursor-pointer"
            >
              Use Redirect Sign-In
            </button>
            <button
              onClick={dismissNotice}
              className="text-zinc-400 hover:text-white px-1 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-2 px-4 sm:px-6">
        {/* ESC Brand Logo & Mark */}
        <div className="flex items-center gap-2.5 cursor-pointer group shrink-0" onClick={() => handleNav('/')}>
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-black border border-[#2b2f38] shadow-md group-hover:border-[#CCFF00]/60 transition-colors p-1 shrink-0">
            <img
              src="/assets/aistudio/IMG_20261112_135951_2ec3259f.png"
              alt="ESC Logo"
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 w-full bg-gradient-to-r from-transparent via-[#CCFF00]/25 to-transparent skew-x-[-25deg] -translate-x-full group-hover:animate-sweep"></div>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5 group-hover:text-[#CCFF00] transition-colors whitespace-nowrap">
              ESC
              <span className="inline-block h-2 w-2 rounded-full bg-[#CCFF00] animate-pulse"></span>
            </span>
            <span className="text-[9px] font-mono tracking-wider text-[#9496a1] uppercase whitespace-nowrap hidden sm:block">
              Engineering Startup Company
            </span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden xl:flex items-center gap-0.5 text-[11px] font-medium">
          {navLinks.map((link) => {
            const isActive =
              currentPath === link.path ||
              (link.path === '/problem-exchange' && currentPath.startsWith('/problem-exchange')) ||
              (link.path === '/support' && currentPath === '/contact');
            return (
              <button
                key={link.path}
                onClick={() => handleNav(link.path)}
                className={`px-2 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'text-[#39FF14] bg-[#17191e] font-semibold border border-[#39FF14]/35'
                    : link.highlight
                    ? 'text-[#39FF14] hover:bg-[#17191e]/80 font-semibold'
                    : 'text-[#a1a1aa] hover:text-white hover:bg-[#17191e]/60'
                }`}
              >
                {link.highlight && (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#39FF14] shrink-0" />
                )}
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Right CTA & Auth Area */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {openVideoModal && (
            <button
              onClick={openVideoModal}
              className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#2e323b] bg-[#14161b] text-[11px] font-mono text-[#d4d4d8] hover:border-[#CCFF00]/50 hover:text-white transition-all cursor-pointer whitespace-nowrap"
            >
              <span className="flex h-2 w-2 rounded-full bg-[#CCFF00] shrink-0"></span>
              Watch Manifesto
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => handleNav('/admin')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer whitespace-nowrap ${
                currentPath === '/admin'
                  ? 'bg-[#CCFF00] text-black shadow-md shadow-[#CCFF00]/20'
                  : 'bg-[#232731] text-[#CCFF00] border border-[#CCFF00]/30 hover:bg-[#CCFF00] hover:text-black'
              }`}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Admin Center
            </button>
          )}

          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-1.5 text-sm hover:border-[#CCFF00]/40 transition-colors cursor-pointer"
                aria-expanded={userDropdownOpen}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="h-7 w-7 rounded-full object-cover border border-[#3f434d]"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#272b34] text-xs font-bold text-[#CCFF00]">
                    {user.displayName ? user.displayName[0].toUpperCase() : 'E'}
                  </div>
                )}
                <div className="flex flex-col text-left">
                  <span className="text-xs font-medium text-white max-w-[110px] truncate">
                    {user.displayName || 'Member'}
                  </span>
                  <span className="text-[10px] font-mono text-[#8e919b]">{roleBadgeLabel}</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-[#8e919b]" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[#2b2f38] bg-[#121418] p-2 shadow-2xl backdrop-blur-xl z-50">
                  <div className="px-3 py-2 border-b border-[#23262d] mb-1">
                    <p className="text-xs font-semibold text-white truncate">{user.displayName}</p>
                    <p className="text-[11px] text-[#8e919b] truncate">{user.email}</p>
                  </div>

                  <button
                    onClick={() => handleNav('/dashboard')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#d4d4d8] hover:bg-[#1e2129] hover:text-[#CCFF00] cursor-pointer"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {dashboardNavLabel}
                  </button>

                  <button
                    onClick={() => handleNav('/apply')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#d4d4d8] hover:bg-[#1e2129] hover:text-[#CCFF00] cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    Membership Status
                  </button>

                  <button
                    onClick={() => handleNav('/ideas')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#d4d4d8] hover:bg-[#1e2129] hover:text-[#CCFF00] cursor-pointer"
                  >
                    <Lightbulb className="h-4 w-4" />
                    Submit Startup Idea
                  </button>

                  <button
                    onClick={() => handleNav('/projects')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#d4d4d8] hover:bg-[#1e2129] hover:text-[#CCFF00] cursor-pointer"
                  >
                    <FolderGit2 className="h-4 w-4" />
                    Projects
                  </button>

                  <button
                    onClick={() => handleNav('/verify')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#d4d4d8] hover:bg-[#1e2129] hover:text-[#CCFF00] cursor-pointer"
                  >
                    <Award className="h-4 w-4" />
                    Verify Certificate
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => handleNav('/admin')}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#CCFF00] bg-[#CCFF00]/10 hover:bg-[#CCFF00]/20 cursor-pointer"
                    >
                      <ShieldCheck className="h-4 w-4 text-[#CCFF00]" />
                      Admin Control Center
                    </button>
                  )}

                  <div className="border-t border-[#23262d] my-1 pt-1">
                    <button
                      onClick={() => {
                        signOut();
                        setUserDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#ef4444] hover:bg-[#261517] cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => signInWithGoogle()}
                className="flex items-center gap-2 rounded-xl border border-[#30343e] bg-[#14161b] px-3 py-2 text-xs font-medium text-[#f4f4f0] hover:border-[#CCFF00]/40 hover:bg-[#1b1e25] transition-all cursor-pointer whitespace-nowrap"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2s.7 5.5 1.9 7.9l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.3L1.9 16.4C3.7 20.1 7.5 22.8 12 23.5z"
                  />
                </svg>
                Google Sign In
              </button>

              <button
                onClick={() => handleNav('/apply')}
                className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-3 py-2 text-[11px] font-display font-bold uppercase tracking-wide text-black hover:bg-[#b8e600] shadow-md shadow-[#CCFF00]/20 transition-all cursor-pointer whitespace-nowrap"
              >
                Apply for Fellowship
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          {user ? (
            <button
              onClick={() => handleNav('/dashboard')}
              className="p-2 rounded-lg bg-[#17191e] border border-[#2b2f38] text-xs font-mono text-[#CCFF00]"
            >
              {membershipJourney.canAccessMemberDashboard ? 'Dashboard' : 'Status'}
            </button>
          ) : (
            <button
              onClick={() => signInWithGoogle()}
              className="px-2.5 py-1.5 rounded-lg bg-[#CCFF00] text-black text-xs font-bold"
            >
              Sign In
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-[#9496a1] hover:text-white bg-[#17191e] border border-[#2b2f38]"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#23262d] bg-[#0f1014] px-4 pt-3 pb-6 space-y-2">
          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-[#23262d]">
            {navLinks.map((link) => {
              const isActive =
                currentPath === link.path ||
                (link.path === '/problem-exchange' && currentPath.startsWith('/problem-exchange'));
              return (
                <button
                  key={link.path}
                  onClick={() => handleNav(link.path)}
                  className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'text-[#39FF14] bg-[#1c1f26] font-semibold'
                      : link.highlight
                      ? 'text-[#39FF14] bg-[#141a13] border border-[#39FF14]/30'
                      : 'text-[#a1a1aa] hover:bg-[#17191e] hover:text-white'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex flex-col gap-2">
            {openVideoModal && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openVideoModal();
                }}
                className="w-full text-center py-2.5 rounded-xl border border-[#2e323b] bg-[#17191e] text-xs font-mono text-[#d4d4d8]"
              >
                Watch Community Manifesto
              </button>
            )}

            {user ? (
              <>
                <button
                  onClick={() => handleNav('/dashboard')}
                  className="w-full text-center py-2.5 rounded-xl bg-[#1c1f26] border border-[#30343f] text-sm font-medium text-white"
                >
                  {membershipJourney.canAccessMemberDashboard ? 'My ESC Member Dashboard' : 'View Application Status'}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleNav('/admin')}
                    className="w-full text-center py-2.5 rounded-xl bg-[#CCFF00] text-black font-display font-bold text-sm uppercase"
                  >
                    Admin Control Center
                  </button>
                )}
                <button
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-center py-2 text-xs text-[#ef4444]"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => {
                    signInWithGoogle();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl border border-[#30343e] bg-[#17191e] text-sm font-medium text-white flex items-center justify-center gap-2"
                >
                  Sign in with Google
                </button>
                <button
                  onClick={() => handleNav('/apply')}
                  className="w-full py-2.5 rounded-xl bg-[#CCFF00] text-black font-display font-bold text-sm uppercase"
                >
                  Apply for Fellowship
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

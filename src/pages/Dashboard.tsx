import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  User, 
  Lightbulb, 
  Target, 
  FolderGit2, 
  Award, 
  Calendar, 
  Bell, 
  Edit3, 
  CheckCircle2, 
  Sparkles, 
  ExternalLink,
  Github,
  Linkedin,
  Clock,
  Plus,
  Save,
  ArrowRight,
  Download,
  Printer,
  Eye,
  AlertCircle,
  Trophy,
  Briefcase,
  Rocket,
  ListChecks,
  BadgeCheck,
  MessageCircle,
  Ban,
  CheckCheck,
  Bot,
  LifeBuoy,
  Camera,
  CreditCard,
  Users,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { apiRequest } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import {
  calculateProfileCompletion,
  DEFAULT_CERTIFICATE_SETTINGS,
  evaluateTaskOverdue,
  getIdeaStatusLabel,
  normalizeIdeaReviewStatus,
} from '../utils/escLogic';
import { getSupportStatusLabel } from '../utils/supportLogic';
import { SkillSelector } from '../components/SkillSelector';
import { downloadCertificatePdf } from '../utils/certificatePdf';
import type {
  StartupIdea,
  ProblemStatement,
  Project,
  ChallengeRegistration,
  ChallengeSubmission,
  EventRegistration,
  OpportunityApplication,
  CertificateRecord,
  CertificateSettings,
  SiteSettings,
  StartupTeam,
  TeamInvitation,
  TeamTask,
  TeamMilestone,
  ProgressReport,
  PlatformNotification,
  SupportTicket,
  ExchangeProblem,
  ExchangeSolverInterest,
  EventItem,
  ChallengeItem,
  MemberCardOrder,
} from '../types';
import {
  canAccessWhatsappCommunity,
  getApplicationDisplayStatus,
  resolveWhatsappCommunityUrl,
} from '../utils/memberOnboardingLogic';
import {
  getPublicationStatusLabel,
  getValidationStatusLabel,
} from '../utils/problemExchangeLogic';
import { AnimatedCounter } from '../components/animations/AnimatedCounter';
import { SpotlightCard } from '../components/animations/SpotlightCard';
import { CertificatePreviewModal } from '../components/CertificatePreviewModal';
import { CertificatePrintPortal, triggerA4LandscapePrint } from '../components/CertificateSheet';
import { StartupTeamCreateModal } from '../components/dashboard/StartupTeamCreateModal';
import { TeamInvitationsPanel } from '../components/dashboard/TeamInvitationsPanel';
import { TeamWorkspacePanel } from '../components/dashboard/TeamWorkspacePanel';
import { ProfilePhotoUploaderModal } from '../components/dashboard/ProfilePhotoUploaderModal';
import { MemberEventsChallengesSection } from '../components/dashboard/MemberEventsChallengesSection';
import { MemberCardOrdersPanel } from '../components/dashboard/MemberCardOrdersPanel';
import { DashboardAccessGate } from '../components/dashboard/DashboardAccessGate';
import { FindStartupTeamPanel } from '../components/dashboard/FindStartupTeamPanel';
import { MemberProjectSubmissionModal } from '../components/dashboard/MemberProjectSubmissionModal';
import { FindMembersDirectoryPanel } from '../components/dashboard/FindMembersDirectoryPanel';

interface DashboardProps {
  navigate: (path: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ navigate }) => {
  const {
    user,
    profile,
    application,
    isApprovedMember,
    isSuspended,
    membershipJourney,
    signInWithGoogle,
    updateUserProfile,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'members' | 'tasks' | 'ideas' | 'projects' | 'problems' | 'challenges' | 'events' | 'opportunities' | 'certificates' | 'card_orders' | 'notifications' | 'resources' | 'support' | 'settings'>('overview');
  
  const [myIdeas, setMyIdeas] = useState<StartupIdea[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [myProblems, setMyProblems] = useState<ProblemStatement[]>([]);
  const [myChallengeRegs, setMyChallengeRegs] = useState<ChallengeRegistration[]>([]);
  const [myChallengeSubs, setMyChallengeSubs] = useState<ChallengeSubmission[]>([]);
  const [myEvents, setMyEvents] = useState<EventRegistration[]>([]);
  const [myOppApps, setMyOppApps] = useState<OpportunityApplication[]>([]);
  const [myCertificates, setMyCertificates] = useState<CertificateRecord[]>([]);
  const [myCardOrders, setMyCardOrders] = useState<MemberCardOrder[]>([]);
  const [mySupportTickets, setMySupportTickets] = useState<SupportTicket[]>([]);
  const [pxSavedProblems, setPxSavedProblems] = useState<ExchangeProblem[]>([]);
  const [pxSubmittedProblems, setPxSubmittedProblems] = useState<ExchangeProblem[]>([]);
  const [pxSolverInterests, setPxSolverInterests] = useState<ExchangeSolverInterest[]>([]);
  const [editingPendingProblem, setEditingPendingProblem] = useState<ExchangeProblem | null>(null);
  const [editPxTitle, setEditPxTitle] = useState('');
  const [editPxDesc, setEditPxDesc] = useState('');
  const [editPxWhy, setEditPxWhy] = useState('');
  const [savingPendingPx, setSavingPendingPx] = useState(false);
  const [pxDashFeedback, setPxDashFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [certSettings, setCertSettings] = useState<CertificateSettings>(DEFAULT_CERTIFICATE_SETTINGS);
  const [previewCert, setPreviewCert] = useState<CertificateRecord | null>(null);
  const [printCert, setPrintCert] = useState<CertificateRecord | null>(null);
  const [busyCertId, setBusyCertId] = useState<string | null>(null);
  const [certFeedback, setCertFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [myNotifications, setMyNotifications] = useState<any[]>([]);
  const [sqlNotifications, setSqlNotifications] = useState<PlatformNotification[]>([]);
  const [myTeams, setMyTeams] = useState<StartupTeam[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitation[]>([]);
  const [teamMilestones, setTeamMilestones] = useState<TeamMilestone[]>([]);
  const [teamReports, setTeamReports] = useState<ProgressReport[]>([]);
  const [myTasks, setMyTasks] = useState<TeamTask[]>([]);
  const [siteSettings, setSiteSettings] = useState<Partial<SiteSettings>>({});
  const [teamCreateOpen, setTeamCreateOpen] = useState(false);
  const [teamFeedback, setTeamFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [taskSubNotes, setTaskSubNotes] = useState('');
  const [taskSubUrl, setTaskSubUrl] = useState('');
  const [taskBusy, setTaskBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishedEvents, setPublishedEvents] = useState<EventItem[]>([]);
  const [publishedChallenges, setPublishedChallenges] = useState<ChallengeItem[]>([]);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectFeedback, setProjectFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [college, setCollege] = useState('');
  const [branch, setBranch] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [bio, setBio] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [weeklyAvailability, setWeeklyAvailability] = useState('');
  const [editTechnicalSkills, setEditTechnicalSkills] = useState<string[]>([]);
  const [editNonTechnicalSkills, setEditNonTechnicalSkills] = useState<string[]>([]);
  const [editCustomSkills, setEditCustomSkills] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setCollege(profile.college || '');
      setBranch(profile.branch || '');
      setAcademicYear(profile.academicYear || '');
      setBio(profile.bio || '');
      setPortfolioUrl(profile.portfolioUrl || '');
      setGithubUrl(profile.githubUrl || '');
      setLinkedinUrl(profile.linkedinUrl || '');
      setWeeklyAvailability(profile.weeklyAvailability || '10-15 hrs/week');
      setEditTechnicalSkills(profile.technicalSkills || []);
      setEditNonTechnicalSkills(profile.nonTechnicalSkills || []);
      setEditCustomSkills(profile.customSkills || []);
    }
  }, [profile]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      try {
        setLoading(true);

        // 1. My Ideas
        const ideasQ = query(collection(db, 'ideas'), where('authorId', '==', user.uid));
        const ideasSnap = await getDocs(ideasQ);
        setMyIdeas(ideasSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StartupIdea)));

        // 2. My Projects (leader or team member — merged from Firestore + Cloud SQL)
        const [projSnap, sqlProjectsRes] = await Promise.all([
          getDocs(collection(db, 'projects')).catch(() => null),
          apiRequest<Project[]>('/api/projects').catch(() => []),
        ]);
        const projectMap = new Map<string, Project>();
        if (projSnap) {
          projSnap.docs.forEach((d) => {
            const p = { id: d.id, ...(d.data() as Project) };
            if (p.leaderId === user.uid || p.teamMemberIds?.includes(user.uid)) {
              projectMap.set(p.id!, p);
            }
          });
        }
        if (Array.isArray(sqlProjectsRes)) {
          sqlProjectsRes.forEach((p) => {
            if (p?.id && (p.leaderId === user.uid || p.teamMemberIds?.includes(user.uid))) {
              if (!projectMap.has(p.id)) {
                projectMap.set(p.id, p);
              }
            }
          });
        }
        setMyProjects(
          Array.from(projectMap.values()).sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
          )
        );

        // 3. My Problems
        const probSnap = await getDocs(collection(db, 'problems'));
        const userProblems = probSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as ProblemStatement))
          .filter((p) => p.authorId === user.uid || p.interestedUserIds?.includes(user.uid));
        setMyProblems(userProblems);

        // 4. My Event Registrations, Challenge Registrations/Submissions, Opportunity Apps
        const [evSnap, chalRegSnap, chalSubSnap, oppAppSnap] = await Promise.all([
          getDocs(query(collection(db, 'eventRegistrations'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'challengeRegistrations'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'challengeSubmissions'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'opportunityApplications'), where('userId', '==', user.uid))),
        ]);
        setMyEvents(evSnap.docs.map((d) => ({ id: d.id, ...d.data() } as EventRegistration)));
        setMyChallengeRegs(
          chalRegSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeRegistration))
        );
        setMyChallengeSubs(
          chalSubSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeSubmission))
        );
        setMyOppApps(
          oppAppSnap.docs.map((d) => ({ id: d.id, ...d.data() } as OpportunityApplication))
        );

        // 5. My Certificates + Global Certificate Settings
        const [certsSnap, settingsSnap] = await Promise.all([
          getDocs(collection(db, 'certificates')),
          getDoc(doc(db, 'certificateSettings', 'default')).catch(() => null),
        ]);
        const userCerts = certsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as CertificateRecord))
          .filter((c) => c.studentId === user.uid || (user.email && c.studentEmail === user.email));
        setMyCertificates(userCerts);
        if (settingsSnap && settingsSnap.exists()) {
          setCertSettings({
            ...DEFAULT_CERTIFICATE_SETTINGS,
            ...(settingsSnap.data() as Partial<CertificateSettings>),
          });
        }

        // 6. Notifications, Site Settings, Published Events/Challenges & SQL Workspace Records
        const [
          notifSnap,
          pubSettingsSnap,
          fsEventsSnap,
          fsChallengesSnap,
          sqlEventsRes,
          sqlChallengesRes,
          sqlTeamsRes,
          sqlTasksRes,
          sqlNotifRes,
          sqlSettingsRes,
          sqlSupportRes,
          pxMyRes,
          sqlCardOrdersRes,
        ] = await Promise.all([
          getDocs(query(collection(db, 'notifications'), where('recipientId', '==', user.uid))).catch(() => null),
          getDoc(doc(db, 'siteSettings', 'public')).catch(() => null),
          getDocs(collection(db, 'events')).catch(() => null),
          getDocs(collection(db, 'challenges')).catch(() => null),
          apiRequest<EventItem[]>('/api/events').catch(() => []),
          apiRequest<ChallengeItem[]>('/api/challenges').catch(() => []),
          apiRequest<{
            teams: StartupTeam[];
            invitations: TeamInvitation[];
            milestones: TeamMilestone[];
            reports: ProgressReport[];
          }>('/api/teams/my', { requireAuth: true }).catch(() => null),
          apiRequest<TeamTask[]>('/api/tasks/my', { requireAuth: true }).catch(() => []),
          apiRequest<PlatformNotification[]>('/api/notifications/my', { requireAuth: true }).catch(() => []),
          apiRequest<SiteSettings>('/api/site-settings').catch(() => null),
          apiRequest<SupportTicket[]>('/api/support/my', { requireAuth: true }).catch(() => []),
          apiRequest<{
            savedProblems: ExchangeProblem[];
            submittedProblems: ExchangeProblem[];
            solverInterests: ExchangeSolverInterest[];
          }>('/api/problem-exchange/my', { requireAuth: true }).catch(() => null),
          apiRequest<MemberCardOrder[]>('/api/card-orders/my', { requireAuth: true }).catch(() => []),
        ]);

        // Merge live Firestore + Cloud SQL published Events & Challenges (zero fake placeholders)
        const eventMap = new Map<string, EventItem>();
        if (fsEventsSnap) {
          fsEventsSnap.docs.forEach((d) => {
            eventMap.set(d.id, { id: d.id, ...(d.data() as EventItem) });
          });
        }
        if (Array.isArray(sqlEventsRes)) {
          sqlEventsRes.forEach((ev) => {
            if (ev?.id && !eventMap.has(ev.id)) {
              eventMap.set(ev.id, ev);
            }
          });
        }
        setPublishedEvents(Array.from(eventMap.values()));

        const challengeMap = new Map<string, ChallengeItem>();
        if (fsChallengesSnap) {
          fsChallengesSnap.docs.forEach((d) => {
            challengeMap.set(d.id, { id: d.id, ...(d.data() as ChallengeItem) });
          });
        }
        if (Array.isArray(sqlChallengesRes)) {
          sqlChallengesRes.forEach((ch) => {
            if (ch?.id && !challengeMap.has(ch.id)) {
              challengeMap.set(ch.id, ch);
            }
          });
        }
        setPublishedChallenges(Array.from(challengeMap.values()));

        if (notifSnap) {
          setMyNotifications(notifSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
        const fsSettings = pubSettingsSnap && pubSettingsSnap.exists() ? (pubSettingsSnap.data() as Partial<SiteSettings>) : {};
        setSiteSettings({
          ...fsSettings,
          ...(sqlSettingsRes || {}),
          whatsappCommunityUrl: sqlSettingsRes?.whatsappCommunityUrl || fsSettings.whatsappCommunityUrl || '',
          communityGuidelines: sqlSettingsRes?.communityGuidelines || fsSettings.communityGuidelines || '',
        });

        if (sqlTeamsRes) {
          setMyTeams(sqlTeamsRes.teams || []);
          setTeamInvitations(sqlTeamsRes.invitations || []);
          setTeamMilestones(sqlTeamsRes.milestones || []);
          setTeamReports(sqlTeamsRes.reports || []);
        }
        if (Array.isArray(sqlTasksRes)) setMyTasks(sqlTasksRes);
        if (Array.isArray(sqlNotifRes)) setSqlNotifications(sqlNotifRes);
        if (Array.isArray(sqlSupportRes)) setMySupportTickets(sqlSupportRes);
        if (Array.isArray(sqlCardOrdersRes)) setMyCardOrders(sqlCardOrdersRes);
        if (pxMyRes) {
          setPxSavedProblems(pxMyRes.savedProblems || []);
          setPxSubmittedProblems(pxMyRes.submittedProblems || []);
          setPxSolverInterests(pxMyRes.solverInterests || []);
        }
      } catch (err) {
        console.error('Error fetching dashboard records:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const refreshSqlWorkspace = async () => {
    if (!user) return;
    const [sqlTeamsRes, sqlTasksRes, sqlNotifRes] = await Promise.all([
      apiRequest<{
        teams: StartupTeam[];
        invitations: TeamInvitation[];
        milestones: TeamMilestone[];
        reports: ProgressReport[];
      }>('/api/teams/my', { requireAuth: true }).catch(() => null),
      apiRequest<TeamTask[]>('/api/tasks/my', { requireAuth: true }).catch(() => []),
      apiRequest<PlatformNotification[]>('/api/notifications/my', { requireAuth: true }).catch(() => []),
    ]);
    if (sqlTeamsRes) {
      setMyTeams(sqlTeamsRes.teams || []);
      setTeamInvitations(sqlTeamsRes.invitations || []);
      setTeamMilestones(sqlTeamsRes.milestones || []);
      setTeamReports(sqlTeamsRes.reports || []);
    }
    if (Array.isArray(sqlTasksRes)) setMyTasks(sqlTasksRes);
    if (Array.isArray(sqlNotifRes)) setSqlNotifications(sqlNotifRes);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSavingProfile(true);
      await updateUserProfile({
        fullName: fullName.trim(),
        college: college.trim(),
        branch: branch.trim(),
        academicYear: academicYear.trim(),
        bio: bio.trim(),
        portfolioUrl: portfolioUrl.trim(),
        githubUrl: githubUrl.trim(),
        linkedinUrl: linkedinUrl.trim(),
        weeklyAvailability,
        technicalSkills: editTechnicalSkills,
        nonTechnicalSkills: editNonTechnicalSkills,
        customSkills: editCustomSkills,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      setSavingProfile(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-[#0b0c0e] px-4">
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-8 text-center max-w-md space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#CCFF00]/10 text-[#CCFF00]">
            <User className="h-7 w-7" />
          </div>
          <h2 className="font-display text-2xl font-bold text-white">Member Dashboard</h2>
          <p className="text-xs text-[#8e919b] leading-relaxed">
            Please sign in with your verified Google account to view your technical portfolio, project workspaces, and fellowship status.
          </p>
          <button
            onClick={() => signInWithGoogle()}
            className="w-full rounded-xl bg-[#CCFF00] py-3 font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-[#b8e600] cursor-pointer"
          >
            Sign In with Google
          </button>
        </div>
      </div>
    );
  }

  // Strict Conditional Access Rule:
  // Only Approved & Active ESC Members (or Admins) unlock the full Member Dashboard.
  if (!membershipJourney.canAccessMemberDashboard) {
    return (
      <DashboardAccessGate
        journey={membershipJourney}
        application={application}
        profile={profile}
        userEmail={user.email}
        whatsappUrl={siteSettings.whatsappCommunityUrl}
        navigate={navigate}
      />
    );
  }

  const completionPercent = calculateProfileCompletion(profile || {});
  const effectiveApplicationStatus = application?.status || profile?.membershipStatus;
  const applicationStatusLabel = getApplicationDisplayStatus(effectiveApplicationStatus);
  const effectiveCollege = profile?.college || application?.college || '';
  const effectiveBranch = profile?.branch || application?.branch || '';
  const effectiveYear = profile?.academicYear || application?.academicYear || '';
  const avatarDisplayUrl = profile?.profilePhotoUrl || profile?.photoURL || user.photoURL || '';
  const whatsappUnlocked = canAccessWhatsappCommunity(
    application?.status,
    profile?.membershipStatus,
    profile?.accountStatus
  );

  return (
    <div className="min-h-screen bg-[#0b0c0e] py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Welcome & Profile Banner */}
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative shrink-0">
              {avatarDisplayUrl ? (
                <img
                  src={avatarDisplayUrl}
                  alt={profile?.fullName || user.displayName || 'Member'}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover border-2 border-[#39FF14]/50"
                />
              ) : (
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-[#1b1e25] border border-[#2e323d] font-display text-2xl font-bold text-[#39FF14]">
                  {(profile?.fullName || user.displayName || 'E')[0].toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => setPhotoModalOpen(true)}
                aria-label={profile?.profilePhotoUrl ? 'Update profile photo' : 'Upload profile photo'}
                title={profile?.profilePhotoUrl ? 'Update profile photo' : 'Upload profile photo'}
                className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-lg border border-[#0b0c0e] bg-[#39FF14] text-black hover:bg-[#32e010] shadow-md cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
                  Welcome, {profile?.fullName || user.displayName}
                </h1>
                <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase font-semibold border ${
                  isSuspended
                    ? 'bg-red-950/60 border-red-800 text-red-300'
                    : effectiveApplicationStatus === 'approved' || isApprovedMember
                    ? 'bg-[#39FF14]/10 border-[#39FF14]/50 text-[#39FF14]'
                    : effectiveApplicationStatus === 'rejected'
                    ? 'bg-red-950/50 border-red-700/60 text-red-300'
                    : effectiveApplicationStatus === 'submitted' || effectiveApplicationStatus === 'under_review'
                    ? 'bg-blue-950/40 border-blue-700/50 text-blue-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                }`}>
                  {isSuspended ? 'Account Suspended' : `Status: ${applicationStatusLabel}`}
                </span>
                {profile?.escMemberId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#39FF14] px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-black">
                    <BadgeCheck className="h-3 w-3" /> {profile.escMemberId}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9ca3af]">
                {effectiveCollege ? (
                  <span className="text-zinc-200 font-medium">{effectiveCollege}</span>
                ) : (
                  <span>{user.email}</span>
                )}
                {effectiveBranch && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span>{effectiveBranch}</span>
                  </>
                )}
                {effectiveYear && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="font-mono text-zinc-300">{effectiveYear}</span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] font-mono text-zinc-400">
                <span>Role: <strong className="text-white uppercase">{profile?.role || 'student'}</strong></span>
                {profile?.approvalDate && (
                  <span>Approved: <strong className="text-zinc-200">{new Date(profile.approvalDate).toLocaleDateString()}</strong></span>
                )}
                <span className={profile?.profilePhotoUrl ? 'text-[#39FF14]' : 'text-amber-300'}>
                  {profile?.profilePhotoUrl ? 'Member Photo Uploaded' : 'Profile Photo Required for Member Card'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="rounded-xl border border-[#22252e] bg-[#161820] p-3 text-center sm:text-left min-w-[140px]">
              <span className="text-[10px] font-mono text-[#8e919b] block uppercase">Profile Strength</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-2 flex-1 rounded-full bg-[#232731] overflow-hidden">
                  <div
                    className="h-full bg-[#39FF14] rounded-full transition-all"
                    style={{ width: `${completionPercent}%` }}
                  ></div>
                </div>
                <span className="font-mono text-xs font-bold text-white">{completionPercent}%</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPhotoModalOpen(true)}
              data-testid="dashboard-upload-photo-btn"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#39FF14]/45 bg-[#101911] px-4 py-2.5 text-xs font-semibold text-[#39FF14] hover:bg-[#39FF14]/15 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Camera className="h-4 w-4" />
              {profile?.profilePhotoUrl ? 'Update Photo' : 'Upload Photo'}
            </button>

            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#17191e] px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:text-white hover:border-[#CCFF00] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="h-4 w-4" />
              {isEditing ? 'Cancel Edit' : 'Edit Profile'}
            </button>
          </div>
        </div>

        {photoFeedback && (
          <div
            role="status"
            className="rounded-xl border border-[#39FF14]/45 bg-[#0e190f] px-4 py-3 text-xs text-[#39FF14] flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{photoFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setPhotoFeedback(null)}
              className="opacity-75 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Profile Edit Drawer */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="rounded-2xl border border-[#CCFF00]/40 bg-[#12151c] p-6 space-y-4 animate-in fade-in duration-150 text-xs">
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-[#CCFF00]" /> Edit Public Engineering Profile
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-white mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Weekly Availability</label>
                <input
                  type="text"
                  value={weeklyAvailability}
                  onChange={(e) => setWeeklyAvailability(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">College / University</label>
                <input
                  type="text"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="e.g. IIT Bombay"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-white mb-1">Branch</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="e.g. Mechatronics"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Year</label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="e.g. 3rd Year"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-white mb-1">Bio & Technical Focus</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What technologies or engineering topics are you currently working on?"
                rows={3}
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-white mb-1">GitHub Profile</label>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Portfolio Link</label>
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">LinkedIn Profile</label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#222630]">
              <SkillSelector
                technicalSkills={editTechnicalSkills}
                nonTechnicalSkills={editNonTechnicalSkills}
                customSkills={editCustomSkills}
                isAuthenticated={Boolean(user)}
                compact
                onChange={({ technicalSkills, nonTechnicalSkills, customSkills }) => {
                  setEditTechnicalSkills(technicalSkills);
                  setEditNonTechnicalSkills(nonTechnicalSkills);
                  setEditCustomSkills(customSkills);
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600]"
              >
                <Save className="h-3.5 w-3.5" />
                {savingProfile ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Suspended Account Lockout Notice */}
        {isSuspended && (
          <div className="rounded-2xl border border-red-800 bg-red-950/40 p-5 flex items-start gap-3 text-xs text-red-200">
            <Ban className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display text-sm font-bold text-white">Account Suspended</h3>
              <p className="mt-1">
                Your ESC member account is currently suspended by an administrator. Startup Team creation, team invitations, and WhatsApp Community access are temporarily restricted.
              </p>
            </div>
          </div>
        )}

        {/* Dashboard Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#1f2229] pb-3 overflow-x-auto scrollbar-none">
          {[
            { key: 'overview', label: 'Overview', icon: LayoutDashboard },
            { key: 'team', label: `Startup Teams (${myTeams.length})`, icon: Rocket },
            { key: 'projects', label: `My Projects (${myProjects.length})`, icon: FolderGit2 },
            { key: 'members', label: 'Find Members', icon: Users },
            { key: 'challenges', label: `Challenges (${myChallengeRegs.length})`, icon: Trophy },
            { key: 'events', label: `Events (${myEvents.length})`, icon: Calendar },
            { key: 'problems', label: `Problem Exchange (${pxSavedProblems.length + pxSubmittedProblems.length + pxSolverInterests.length + myProblems.length})`, icon: Target },
            { key: 'tasks', label: `Tasks (${myTasks.length})`, icon: ListChecks },
            { key: 'ideas', label: `Startup Ideas (${myIdeas.length})`, icon: Lightbulb },
            { key: 'opportunities', label: `Opportunities (${myOppApps.length})`, icon: Briefcase },
            { key: 'certificates', label: `Certificates (${myCertificates.length})`, icon: Award },
            { key: 'card_orders', label: `Member Card (${myCardOrders.length})`, icon: CreditCard },
            {
              key: 'notifications',
              label: `Notifications (${sqlNotifications.filter((n) => !n.isRead).length || sqlNotifications.length + myNotifications.length})`,
              icon: Bell,
            },
            { key: 'resources', label: 'Resources', icon: BookOpen },
            { key: 'support', label: `Support (${mySupportTickets.length})`, icon: LifeBuoy },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-mono font-semibold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#CCFF00] text-black shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-[#14161c]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SpotlightCard className="p-5">
                <span className="font-mono text-xs text-[#8e919b]">Startup Ideas</span>
                <p className="font-display text-2xl font-extrabold text-[#CCFF00] mt-1">
                  <AnimatedCounter value={myIdeas.length} />
                </p>
                <span className="text-[10px] text-zinc-500">Submitted in Lab</span>
              </SpotlightCard>
              <SpotlightCard className="p-5">
                <span className="font-mono text-xs text-[#8e919b]">Workspaces</span>
                <p className="font-display text-2xl font-extrabold text-white mt-1">
                  <AnimatedCounter value={myProjects.length} />
                </p>
                <span className="text-[10px] text-zinc-500">Active engineering teams</span>
              </SpotlightCard>
              <SpotlightCard className="p-5">
                <span className="font-mono text-xs text-[#8e919b]">Events Registered</span>
                <p className="font-display text-2xl font-extrabold text-[#CCFF00] mt-1">
                  <AnimatedCounter value={myEvents.length} />
                </p>
                <span className="text-[10px] text-zinc-500">Confirmed buildathon tickets</span>
              </SpotlightCard>
              <SpotlightCard className="p-5">
                <span className="font-mono text-xs text-[#8e919b]">Credentials</span>
                <p className="font-display text-2xl font-extrabold text-white mt-1">
                  <AnimatedCounter value={myCertificates.length} />
                </p>
                <span className="text-[10px] text-zinc-500">Verified certificates</span>
              </SpotlightCard>
            </div>

            {/* Official ESC WhatsApp Community — Accessible Immediately After Application Submission & on Every Login */}
            {whatsappUnlocked && !isSuspended && (
              <div
                data-testid="dashboard-whatsapp-community-card"
                className="rounded-2xl border border-[#39FF14]/45 bg-gradient-to-br from-[#0e190f] via-[#11151a] to-[#0e1015] p-6 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14]">
                        {isApprovedMember ? 'Verified ESC Member Community' : 'Official ESC Community Access'}
                      </span>
                      {profile?.escMemberId && (
                        <span className="rounded bg-[#39FF14] px-2 py-0.5 font-mono text-[11px] font-extrabold text-black">
                          {profile.escMemberId}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-lg font-extrabold text-white flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-[#39FF14]" /> JOIN THE ESC COMMUNITY
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl">
                      Connect with fellow innovators, engineering students and aspiring entrepreneurs.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <a
                      href={resolveWhatsappCommunityUrl(siteSettings.whatsappCommunityUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="dashboard-join-whatsapp-btn"
                      className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-5 py-2.5 font-display text-xs font-extrabold uppercase tracking-wide text-black hover:bg-[#32e010] transition-colors"
                    >
                      JOIN ESC WHATSAPP GROUP <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    {isApprovedMember && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('team')}
                        className="rounded-xl border border-[#39FF14]/50 px-4 py-2.5 font-display text-xs font-bold uppercase text-[#39FF14] hover:bg-[#39FF14]/10 cursor-pointer"
                      >
                        {myTeams.length > 0 ? 'Open Startup Team' : 'Form Startup Team'}
                      </button>
                    )}
                  </div>
                </div>

                {siteSettings.communityGuidelines && (
                  <div className="rounded-xl border border-[#232b24] bg-[#0f1310] p-3.5 text-xs text-zinc-300">
                    <span className="font-mono text-[10px] uppercase text-[#39FF14] block mb-1">
                      ESC Community Guidelines
                    </span>
                    <p className="whitespace-pre-line">{siteSettings.communityGuidelines}</p>
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Events & Challenges (Strict 4-Case Conditional Visibility — Hidden Completely When None Active) */}
            {!isSuspended && (whatsappUnlocked || isApprovedMember) && (
              <MemberEventsChallengesSection
                events={publishedEvents}
                challenges={publishedChallenges}
                registeredEventIds={myEvents.map((e) => e.eventId)}
                registeredChallengeIds={myChallengeRegs.map((c) => c.challengeId)}
                userUid={user.uid}
                userEmail={user.email || ''}
                userDisplayName={user.displayName || ''}
                profile={profile}
                isApprovedMember={isApprovedMember}
                onEventRegistered={(reg) =>
                  setMyEvents((prev) =>
                    prev.some((x) => x.eventId === reg.eventId) ? prev : [reg, ...prev]
                  )
                }
                onChallengeRegistered={(reg) =>
                  setMyChallengeRegs((prev) =>
                    prev.some((x) => x.challengeId === reg.challengeId) ? prev : [reg, ...prev]
                  )
                }
                navigate={navigate}
              />
            )}

            {/* Application Progress Callout */}
            {(!application || application.status === 'draft') && !isApprovedMember && (
              <div className="rounded-2xl border border-[#CCFF00]/40 bg-[#121612] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#CCFF00]" /> Complete Your Fellowship Application
                  </h3>
                  <p className="text-xs text-[#9ca3af] mt-1">
                    Submit your academic profile and skill portfolio to unlock community access, events, challenges, and mentorship.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/apply')}
                  className="rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] shrink-0"
                >
                  Resume Application
                </button>
              </div>
            )}

            {/* Recent Notifications & Invites */}
            <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                  <Bell className="h-4 w-4 text-[#CCFF00]" /> Notifications, Invitations &amp; Activity
                  {sqlNotifications.filter((n) => !n.isRead).length > 0 && (
                    <span className="rounded-full bg-[#CCFF00] px-2 py-0.5 font-mono text-[10px] font-bold text-black">
                      {sqlNotifications.filter((n) => !n.isRead).length} new
                    </span>
                  )}
                </h3>
                {sqlNotifications.some((n) => !n.isRead) && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest('/api/notifications/my/read-all', { method: 'PATCH', requireAuth: true }).catch(() => {});
                      setSqlNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] px-3 py-1 font-mono text-[11px] text-[#CCFF00] hover:bg-[#1a1d25] cursor-pointer"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
                  </button>
                )}
              </div>

              {sqlNotifications.length === 0 && myNotifications.length === 0 ? (
                <p className="text-xs text-zinc-500">No new notifications, team invitations, or task alerts.</p>
              ) : (
                <div className="space-y-2.5">
                  {sqlNotifications.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-xl border p-4 text-xs space-y-1.5 ${
                        !n.isRead ? 'border-[#CCFF00]/40 bg-[#141815]' : 'border-[#232731] bg-[#161820]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {!n.isRead && <span className="h-2 w-2 rounded-full bg-[#CCFF00]" />}
                          <span className="font-bold text-white">{n.title}</span>
                          <span className="rounded bg-[#1e222b] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#CCFF00]">
                            {n.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-zinc-500">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-zinc-300">{n.description}</p>
                      <div className="flex items-center gap-3 pt-1 font-mono text-[10px]">
                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={async () => {
                              await apiRequest(`/api/notifications/${n.id}/read`, { method: 'PATCH', requireAuth: true }).catch(() => {});
                              setSqlNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
                            }}
                            className="text-zinc-400 hover:text-white cursor-pointer"
                          >
                            Mark Read
                          </button>
                        )}
                        {n.linkTab && (
                          <button
                            type="button"
                            onClick={() => {
                              if (n.linkTab === 'team') setActiveTab('team');
                              else if (n.linkTab === 'projects') setActiveTab('projects');
                              else if (n.linkTab === 'tasks') setActiveTab('tasks');
                              else if (n.linkTab === 'events') setActiveTab('events');
                              else if (n.linkTab === 'challenges') setActiveTab('challenges');
                              else if (n.linkTab === 'card_orders') setActiveTab('card_orders');
                              else if (n.linkTab === 'support') setActiveTab('support');
                              else if (n.linkTab === 'members') setActiveTab('members');
                              else if (n.linkTab === 'notifications') setActiveTab('notifications');
                            }}
                            className="text-[#CCFF00] hover:underline cursor-pointer"
                          >
                            Open {n.linkTab.replace(/_/g, ' ')} →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {myNotifications.map((n) => (
                    <div key={n.id} className="rounded-xl border border-[#232731] bg-[#161820] p-4 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{n.title || n.senderName}</span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-zinc-300">{n.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB: STARTUP TEAM & INVITATIONS */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-bold text-white">Startup Team &amp; Private Workspace</h3>
                <p className="text-xs text-[#8e919b]">
                  Build your venture team (max 4 members: 1 Team Leader + up to 3 Members), chat privately, and submit milestones.
                </p>
              </div>
              {isApprovedMember && !isSuspended && myTeams.length === 0 && (
                <button
                  type="button"
                  onClick={() => setTeamCreateOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Create Startup Team
                </button>
              )}
            </div>

            {teamFeedback && (
              <div
                className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-2 ${
                  teamFeedback.type === 'success'
                    ? 'border-[#CCFF00]/40 bg-[#CCFF00]/10 text-[#CCFF00]'
                    : 'border-red-800 bg-red-950/40 text-red-300'
                }`}
              >
                <span>{teamFeedback.text}</span>
                <button type="button" onClick={() => setTeamFeedback(null)} className="cursor-pointer">✕</button>
              </div>
            )}

            {!isApprovedMember && (
              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-8 text-center space-y-3">
                <Rocket className="h-8 w-8 text-zinc-600 mx-auto" />
                <h4 className="font-display text-base font-bold text-white">Approved ESC Membership Required</h4>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Only approved ESC members with an official Member ID can create or join a Startup Team.
                </p>
              </div>
            )}

            {isApprovedMember && !isSuspended && (
              <>
                {myTeams.map((tm) => (
                  <TeamWorkspacePanel
                    key={tm.id}
                    team={tm}
                    currentUid={user.uid}
                    tasks={myTasks}
                    milestones={teamMilestones.filter((m) => m.teamId === tm.id)}
                    reports={teamReports.filter((r) => r.teamId === tm.id)}
                    onRefreshAll={refreshSqlWorkspace}
                    onFeedback={(type, text) => setTeamFeedback({ type, text })}
                  />
                ))}

                <TeamInvitationsPanel
                  currentUid={user.uid}
                  activeTeam={myTeams[0] || null}
                  invitations={teamInvitations}
                  isApprovedMember={isApprovedMember}
                  isSuspended={isSuspended}
                  onRefreshTeams={refreshSqlWorkspace}
                  onFeedback={(type, text) => setTeamFeedback({ type, text })}
                />

                <FindStartupTeamPanel
                  currentUid={user.uid}
                  myTeams={myTeams}
                  invitations={teamInvitations}
                  isApprovedMember={isApprovedMember}
                  isSuspended={isSuspended}
                  onRefreshAll={refreshSqlWorkspace}
                  onFeedback={(type, text) => setTeamFeedback({ type, text })}
                />
              </>
            )}
          </div>
        )}

        {/* TAB: FIND MEMBERS DIRECTORY */}
        {activeTab === 'members' && (
          <FindMembersDirectoryPanel
            currentUid={user.uid}
            onInviteHint={() => setActiveTab('team')}
          />
        )}

        {/* TAB: ASSIGNED TASKS & DELIVERABLES */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-lg font-bold text-white">Assigned Startup Tasks &amp; Deadlines</h3>
              <p className="text-xs text-[#8e919b]">
                Track tasks assigned by ESC Administrators, update work status, and submit deliverables for verification.
              </p>
            </div>

            {teamFeedback && (
              <div
                className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-2 ${
                  teamFeedback.type === 'success'
                    ? 'border-[#CCFF00]/40 bg-[#CCFF00]/10 text-[#CCFF00]'
                    : 'border-red-800 bg-red-950/40 text-red-300'
                }`}
              >
                <span>{teamFeedback.text}</span>
                <button type="button" onClick={() => setTeamFeedback(null)} className="cursor-pointer">✕</button>
              </div>
            )}

            {myTasks.length === 0 ? (
              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-8 text-center space-y-2">
                <ListChecks className="h-8 w-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">No tasks assigned to you or your Startup Team yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                {myTasks.map((tk) => {
                  const eff = evaluateTaskOverdue(tk);
                  return (
                    <div key={tk.id} className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-3">
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="text-[#CCFF00] uppercase font-bold">
                          {tk.teamName || tk.teamId} • {tk.priority}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 uppercase ${
                            eff === 'completed'
                              ? 'border-[#CCFF00]/40 bg-[#CCFF00]/15 text-[#CCFF00]'
                              : eff === 'overdue'
                              ? 'border-red-800 bg-red-950/50 text-red-300'
                              : 'border-[#2b2f38] bg-[#181b24] text-zinc-200'
                          }`}
                        >
                          {eff.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <h4 className="font-display text-base font-bold text-white">{tk.title}</h4>
                      <p className="text-zinc-300">{tk.description}</p>
                      <div className="font-mono text-[11px] text-zinc-400">Deadline: {tk.deadline}</div>
                      {tk.adminFeedback && (
                        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-2.5 text-amber-200">
                          Admin Feedback: {tk.adminFeedback}
                        </div>
                      )}
                      {eff !== 'completed' && !isSuspended && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1e222c]">
                          {tk.status === 'not_started' && (
                            <button
                              type="button"
                              disabled={taskBusy}
                              onClick={async () => {
                                try {
                                  setTaskBusy(true);
                                  await apiRequest(`/api/tasks/${tk.id}/member-update`, {
                                    method: 'PATCH',
                                    requireAuth: true,
                                    body: { status: 'in_progress' },
                                  });
                                  await refreshSqlWorkspace();
                                  setTeamFeedback({ type: 'success', text: `Started task "${tk.title}".` });
                                } catch (err: any) {
                                  setTeamFeedback({ type: 'error', text: err?.message || 'Could not update task.' });
                                } finally {
                                  setTaskBusy(false);
                                }
                              }}
                              className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-1.5 font-mono text-[11px] text-white cursor-pointer"
                            >
                              Start Task
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSubmittingTaskId(submittingTaskId === tk.id ? null : tk.id);
                              setTaskSubNotes(tk.submissionNotes || '');
                              setTaskSubUrl(tk.submissionUrl || '');
                            }}
                            className="rounded-xl bg-[#CCFF00] px-3.5 py-1.5 font-display text-[11px] font-bold uppercase text-black cursor-pointer"
                          >
                            Submit Deliverable
                          </button>
                        </div>
                      )}
                      {submittingTaskId === tk.id && (
                        <div className="rounded-xl border border-[#CCFF00]/40 bg-[#14171e] p-3 space-y-2">
                          <textarea
                            rows={2}
                            value={taskSubNotes}
                            onChange={(e) => setTaskSubNotes(e.target.value)}
                            placeholder="Deliverable summary notes..."
                            className="w-full rounded-lg border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                          />
                          <input
                            type="url"
                            value={taskSubUrl}
                            onChange={(e) => setTaskSubUrl(e.target.value)}
                            placeholder="https://github.com/... or deliverable URL"
                            className="w-full rounded-lg border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white"
                          />
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setSubmittingTaskId(null)} className="text-zinc-400 px-2 cursor-pointer">
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={taskBusy}
                              onClick={async () => {
                                try {
                                  setTaskBusy(true);
                                  await apiRequest(`/api/tasks/${tk.id}/member-update`, {
                                    method: 'PATCH',
                                    requireAuth: true,
                                    body: {
                                      status: 'submitted_for_review',
                                      submissionNotes: taskSubNotes,
                                      submissionUrl: taskSubUrl,
                                    },
                                  });
                                  setSubmittingTaskId(null);
                                  await refreshSqlWorkspace();
                                  setTeamFeedback({ type: 'success', text: 'Deliverable submitted for admin review.' });
                                } catch (err: any) {
                                  setTeamFeedback({ type: 'error', text: err?.message || 'Submission failed.' });
                                } finally {
                                  setTaskBusy(false);
                                }
                              }}
                              className="rounded-lg bg-[#CCFF00] px-3.5 py-1.5 font-display text-[11px] font-bold uppercase text-black cursor-pointer"
                            >
                              Submit
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: My Ideas */}
        {activeTab === 'ideas' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">Startup Idea Submissions</h3>
              <button
                onClick={() => navigate('/ideas')}
                className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black"
              >
                <Plus className="h-4 w-4" /> New Idea
              </button>
            </div>

            {myIdeas.length === 0 ? (
              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-8 text-center space-y-3">
                <Lightbulb className="h-8 w-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">You haven't submitted any startup ideas yet.</p>
                <button
                  onClick={() => navigate('/ideas')}
                  className="rounded-xl bg-[#CCFF00] px-4 py-2 text-xs font-bold text-black"
                >
                  Submit First Idea
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myIdeas.map((idea) => {
                  const normStatus = normalizeIdeaReviewStatus(idea.reviewStatus);
                  const statusLabel = getIdeaStatusLabel(idea.reviewStatus);
                  const statusClasses =
                    normStatus === 'approved'
                      ? 'border-[#CCFF00]/40 bg-[#CCFF00]/10 text-[#CCFF00]'
                      : normStatus === 'changes_requested'
                        ? 'border-sky-500/40 bg-sky-950/40 text-sky-300'
                        : normStatus === 'rejected'
                          ? 'border-red-700/50 bg-red-950/40 text-red-300'
                          : normStatus === 'cancelled'
                            ? 'border-zinc-700 bg-zinc-900 text-zinc-400'
                            : 'border-amber-600/40 bg-amber-950/40 text-amber-300';
                  return (
                    <div key={idea.id} className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <span className="text-[#CCFF00]">{idea.industry}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {idea.aiAssisted && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-950/50 px-2 py-0.5 text-[10px] text-purple-200">
                              <Bot className="h-3 w-3" /> AI-Assisted
                            </span>
                          )}
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase font-semibold ${statusClasses}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                      <h4 className="font-display text-base font-bold text-white">{idea.title}</h4>
                      <p className="text-xs text-[#8e919b] line-clamp-3">{idea.problemStatement}</p>
                      {normStatus === 'approved' && (
                        <p className="text-[11px] font-mono text-[#CCFF00]">
                          Approved by ESC Admin — eligible as an official ESC project.
                        </p>
                      )}
                      {idea.adminFeedback && (
                        <div className="rounded-xl border border-[#282c38] bg-[#161820] p-3 text-xs text-zinc-300 space-y-1">
                          <span className="text-[10px] font-mono text-[#CCFF00] uppercase block">
                            ESC Admin Feedback{idea.reviewedAt ? ` • ${new Date(idea.reviewedAt).toLocaleDateString()}` : ''}:
                          </span>
                          <p>{idea.adminFeedback}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: My Projects & Add Project */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-white">My Engineering Projects</h3>
                <p className="text-xs text-[#8e919b]">
                  Submit new engineering prototypes or startups, track ESC Admin review status, and share GitHub/demo links.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(true)}
                  data-testid="dashboard-add-project-btn"
                  className="flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2 font-display text-xs font-extrabold uppercase text-black hover:bg-[#32e010] cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add Project
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className="flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#161922] px-4 py-2 font-mono text-xs font-semibold text-zinc-200 hover:border-[#CCFF00]/50 hover:text-white cursor-pointer"
                >
                  Explore All Workspaces <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {projectFeedback && (
              <div
                className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-2 ${
                  projectFeedback.type === 'success'
                    ? 'border-[#39FF14]/40 bg-[#0e1a0f] text-[#39FF14]'
                    : 'border-red-800 bg-red-950/40 text-red-300'
                }`}
              >
                <span>{projectFeedback.text}</span>
                <button
                  type="button"
                  onClick={() => setProjectFeedback(null)}
                  className="cursor-pointer opacity-75 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            )}

            {myProjects.length === 0 ? (
              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-10 text-center space-y-3">
                <FolderGit2 className="h-9 w-9 text-zinc-600 mx-auto" />
                <p className="text-sm font-semibold text-white">No engineering projects added yet</p>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Launch your first engineering project or prototype to get reviewed by the ESC Admin team and request mentorship.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setProjectModalOpen(true)}
                    className="rounded-xl bg-[#39FF14] px-5 py-2.5 font-display text-xs font-extrabold uppercase text-black hover:bg-[#32e010] cursor-pointer"
                  >
                    + Add Your First Project
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/projects')}
                    className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:text-white cursor-pointer"
                  >
                    Explore Workspaces
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myProjects.map((p) => {
                  const statusTone =
                    p.status === 'approved' || p.status === 'completed'
                      ? 'border-[#39FF14]/45 bg-[#39FF14]/10 text-[#39FF14]'
                      : p.status === 'rejected'
                      ? 'border-red-700/60 bg-red-950/40 text-red-300'
                      : p.status === 'submitted' || p.status === 'under_review' || p.status === 'review'
                      ? 'border-blue-500/40 bg-blue-950/30 text-blue-300'
                      : p.status === 'draft'
                      ? 'border-zinc-700 bg-zinc-900 text-zinc-400'
                      : 'border-[#CCFF00]/40 bg-[#CCFF00]/10 text-[#CCFF00]';
                  return (
                    <div key={p.id} className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <span className="text-[#CCFF00]">{p.category}</span>
                        <div className="flex items-center gap-1.5">
                          {p.stage && (
                            <span className="rounded bg-[#1a1d24] px-2 py-0.5 text-[10px] uppercase text-zinc-400">
                              {p.stage}
                            </span>
                          )}
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusTone}`}>
                            {String(p.status || 'submitted').replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-display text-base font-bold text-white">{p.title}</h4>
                        <p className="mt-1.5 text-xs text-[#9ca3af] line-clamp-3">{p.description}</p>
                      </div>

                      {p.requiredSkills && p.requiredSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {p.requiredSkills.slice(0, 6).map((sk, idx) => (
                            <span
                              key={idx}
                              className="rounded-md border border-[#252a35] bg-[#171a22] px-2 py-0.5 font-mono text-[10px] text-zinc-300"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}

                      {p.adminFeedback && (
                        <div className="rounded-xl border border-[#2a332b] bg-[#0f1610] p-3 text-xs text-zinc-200">
                          <span className="font-mono text-[10px] uppercase text-[#39FF14] block mb-0.5">
                            ESC Admin Review Note
                          </span>
                          {p.adminFeedback}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1e222b] text-[11px] font-mono text-zinc-400">
                        <div className="flex flex-wrap items-center gap-3">
                          {p.repoUrl && (
                            <a
                              href={p.repoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-zinc-200 hover:text-[#CCFF00]"
                            >
                              <Github className="h-3.5 w-3.5" /> GitHub
                            </a>
                          )}
                          {p.demoUrl && (
                            <a
                              href={p.demoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-zinc-200 hover:text-[#CCFF00]"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Demo
                            </a>
                          )}
                          {p.websiteUrl && (
                            <a
                              href={p.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-zinc-200 hover:text-[#CCFF00]"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Website
                            </a>
                          )}
                        </div>
                        {p.createdAt && (
                          <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Problem Exchange & Legacy Problem Bank */}
        {activeTab === 'problems' && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  ESC Problem Exchange Workspace
                </h3>
                <p className="text-xs text-zinc-400">
                  Manage your saved problems, track submitted problem reviews, and monitor solver team applications.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => navigate('/problem-exchange?autostart=1')}
                  className="flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2 font-display text-xs font-extrabold uppercase text-black hover:bg-[#32e010] cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" /> Explore Problem Exchange
                </button>
              </div>
            </div>

            {pxDashFeedback && (
              <div
                className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between ${
                  pxDashFeedback.type === 'success'
                    ? 'border-[#39FF14]/40 bg-[#0f1d0e] text-[#39FF14]'
                    : 'border-red-800 bg-red-950/40 text-red-200'
                }`}
              >
                <span>{pxDashFeedback.text}</span>
                <button
                  type="button"
                  onClick={() => setPxDashFeedback(null)}
                  className="opacity-70 hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 1. Saved Problem Exchange Items */}
            <div className="space-y-3">
              <h4 className="font-mono text-xs uppercase tracking-widest text-[#39FF14]">
                Saved Problems ({pxSavedProblems.length})
              </h4>
              {pxSavedProblems.length === 0 ? (
                <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 text-xs text-zinc-400">
                  No saved problems yet. Bookmark challenges on ESC Problem Exchange to build your shortlist.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pxSavedProblems.map((prob) => (
                    <div
                      key={prob.id}
                      className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-[#39FF14] font-bold">
                          {prob.problemCode} • {prob.category}
                        </span>
                        <span className="rounded border border-[#39FF14]/35 bg-[#0e170d] px-2 py-0.5 text-[#39FF14] font-bold">
                          Score {prob.opportunityScore}
                        </span>
                      </div>
                      <h5 className="font-display text-base font-bold text-white">{prob.title}</h5>
                      <p className="text-xs text-[#8e919b] line-clamp-2">{prob.description}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-[#1e222b] text-xs font-mono">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiRequest(`/api/problem-exchange/${prob.id}/save`, {
                                method: 'POST',
                                requireAuth: true,
                              });
                              setPxSavedProblems((prev) => prev.filter((p) => p.id !== prob.id));
                              setPxDashFeedback({
                                type: 'success',
                                text: `Removed ${prob.problemCode} from Saved Problems.`,
                              });
                            } catch (err: any) {
                              setPxDashFeedback({
                                type: 'error',
                                text: err?.message || 'Unable to unsave problem.',
                              });
                            }
                          }}
                          className="text-zinc-400 hover:text-red-400 cursor-pointer"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/problem-exchange/${prob.id}`)}
                          className="inline-flex items-center gap-1 text-[#39FF14] font-bold hover:underline cursor-pointer"
                        >
                          Open Brief <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Submitted Problems (Editable while pending_review) */}
            <div className="space-y-3">
              <h4 className="font-mono text-xs uppercase tracking-widest text-[#39FF14]">
                My Problem Submissions ({pxSubmittedProblems.length})
              </h4>
              {pxSubmittedProblems.length === 0 ? (
                <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 text-xs text-zinc-400">
                  You have not submitted any problems to ESC Problem Exchange yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pxSubmittedProblems.map((prob) => (
                    <div
                      key={prob.id}
                      className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                        <span className="text-[#39FF14] font-bold">{prob.problemCode}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded border border-[#2b303c] bg-[#161922] px-2 py-0.5 text-[10px] text-zinc-300">
                            {getValidationStatusLabel(prob.validationStatus)}
                          </span>
                          <span
                            className={`rounded border px-2 py-0.5 text-[10px] uppercase font-bold ${
                              prob.publicationStatus === 'published'
                                ? 'border-[#39FF14]/40 bg-[#39FF14]/10 text-[#39FF14]'
                                : prob.publicationStatus === 'pending_review'
                                ? 'border-amber-500/40 bg-amber-950/30 text-amber-300'
                                : 'border-red-800/50 bg-red-950/30 text-red-300'
                            }`}
                          >
                            {getPublicationStatusLabel(prob.publicationStatus)}
                          </span>
                        </div>
                      </div>
                      <h5 className="font-display text-base font-bold text-white">{prob.title}</h5>
                      <p className="text-xs text-[#8e919b] line-clamp-3">{prob.description}</p>
                      {prob.adminNotes && (
                        <div className="rounded-xl border border-[#282d38] bg-[#161922] p-3 text-xs text-zinc-300">
                          <span className="font-mono text-[10px] uppercase text-[#39FF14] block mb-0.5">
                            ESC Admin Note:
                          </span>
                          {prob.adminNotes}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-[#1e222b] text-xs font-mono">
                        {prob.publicationStatus === 'pending_review' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPendingProblem(prob);
                              setEditPxTitle(prob.title);
                              setEditPxDesc(prob.description);
                              setEditPxWhy(prob.whyItMatters || '');
                            }}
                            className="inline-flex items-center gap-1 text-[#CCFF00] hover:underline cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Edit Pending Submission
                          </button>
                        ) : (
                          <span className="text-zinc-500">{prob.category}</span>
                        )}
                        {prob.publicationStatus === 'published' && (
                          <button
                            type="button"
                            onClick={() => navigate(`/problem-exchange/${prob.id}`)}
                            className="inline-flex items-center gap-1 text-[#39FF14] font-bold hover:underline cursor-pointer"
                          >
                            View Live <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Solver Interest Applications */}
            <div className="space-y-3">
              <h4 className="font-mono text-xs uppercase tracking-widest text-[#39FF14]">
                My Solver Interest Applications ({pxSolverInterests.length})
              </h4>
              {pxSolverInterests.length === 0 ? (
                <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 text-xs text-zinc-400">
                  No solver applications yet. Click &quot;I Want to Solve This&quot; on any Problem Exchange brief to apply.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pxSolverInterests.map((interest) => (
                    <div
                      key={interest.id}
                      className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase">
                        <span className="text-zinc-400">
                          {interest.teamPreference.replace(/_/g, ' ')}
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 font-bold ${
                            interest.status === 'approved_for_team_formation'
                              ? 'border-[#39FF14]/45 bg-[#39FF14]/15 text-[#39FF14]'
                              : interest.status === 'declined'
                              ? 'border-red-800/50 bg-red-950/30 text-red-300'
                              : 'border-amber-500/40 bg-amber-950/30 text-amber-300'
                          }`}
                        >
                          {interest.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <h5 className="font-display text-base font-bold text-white">
                        {interest.problemTitle}
                      </h5>
                      <p className="text-xs text-[#8e919b] line-clamp-3">
                        {interest.proposedApproach}
                      </p>
                      {interest.adminNotes && (
                        <div className="rounded-xl border border-[#282d38] bg-[#161922] p-3 text-xs text-zinc-300">
                          <span className="font-mono text-[10px] uppercase text-[#39FF14] block mb-0.5">
                            ESC Admin Review:
                          </span>
                          {interest.adminNotes}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1e222b] text-xs font-mono">
                        <button
                          type="button"
                          onClick={() => navigate(`/problem-exchange/${interest.problemId}`)}
                          className="text-zinc-300 hover:text-white cursor-pointer"
                        >
                          View Problem Brief
                        </button>
                        {interest.status === 'approved_for_team_formation' && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('team')}
                            className="inline-flex items-center gap-1 text-[#39FF14] font-bold hover:underline cursor-pointer"
                          >
                            Proceed to Startup Teams <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Archived Community Problem Submissions (Preserved) */}
            {myProblems.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-[#1e222b]">
                <h4 className="font-mono text-xs uppercase tracking-widest text-zinc-400">
                  Archived Community Problem Submissions ({myProblems.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myProblems.map((prob) => (
                    <div key={prob.id} className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#CCFF00]">{prob.industry}</span>
                        <span className="text-zinc-400 font-semibold">{prob.interestCount || 0} Interested</span>
                      </div>
                      <h5 className="font-display text-base font-bold text-white">{prob.title}</h5>
                      <p className="text-xs text-[#8e919b] line-clamp-3">{prob.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inline Edit Modal for Pending Problem Submission */}
            {editingPendingProblem && (
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
              >
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      setSavingPendingPx(true);
                      const updated = await apiRequest<ExchangeProblem>(
                        `/api/problem-exchange/my/${editingPendingProblem.id}`,
                        {
                          method: 'PATCH',
                          requireAuth: true,
                          body: {
                            title: editPxTitle,
                            description: editPxDesc,
                            whyItMatters: editPxWhy,
                          },
                        }
                      );
                      setPxSubmittedProblems((prev) =>
                        prev.map((item) => (item.id === updated.id ? updated : item))
                      );
                      setEditingPendingProblem(null);
                      setPxDashFeedback({
                        type: 'success',
                        text: `Updated pending submission ${updated.problemCode}.`,
                      });
                    } catch (err: any) {
                      setPxDashFeedback({
                        type: 'error',
                        text: err?.message || 'Unable to update pending submission.',
                      });
                    } finally {
                      setSavingPendingPx(false);
                    }
                  }}
                  className="w-full max-w-lg rounded-2xl border border-[#2b303c] bg-[#0f1116] p-6 space-y-4 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-[#1f232c] pb-3">
                    <h4 className="font-display text-lg font-bold text-white">
                      Edit Pending Problem ({editingPendingProblem.problemCode})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingPendingProblem(null)}
                      className="text-zinc-400 hover:text-white cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-200 mb-1">Title</label>
                    <input
                      type="text"
                      required
                      value={editPxTitle}
                      onChange={(e) => setEditPxTitle(e.target.value)}
                      className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-200 mb-1">Description</label>
                    <textarea
                      rows={4}
                      required
                      value={editPxDesc}
                      onChange={(e) => setEditPxDesc(e.target.value)}
                      className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-200 mb-1">Why It Matters</label>
                    <textarea
                      rows={3}
                      required
                      value={editPxWhy}
                      onChange={(e) => setEditPxWhy(e.target.value)}
                      className="w-full rounded-xl border border-[#2a2f3c] bg-[#151822] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingPendingProblem(null)}
                      className="rounded-xl border border-[#2c313d] px-4 py-2 text-xs text-zinc-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingPendingPx}
                      className="rounded-xl bg-[#39FF14] px-5 py-2 font-display text-xs font-extrabold uppercase text-black disabled:opacity-50 cursor-pointer"
                    >
                      {savingPendingPx ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Tab: Challenge Entries & Submissions */}
        {activeTab === 'challenges' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">Challenge Entries &amp; Submissions</h3>
              <button
                onClick={() => navigate('/challenges')}
                className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
              >
                Explore Challenges
              </button>
            </div>

            {myChallengeRegs.length === 0 ? (
              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-8 text-center space-y-3">
                <Trophy className="h-8 w-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">You haven&apos;t registered for any engineering challenges yet.</p>
                <button
                  onClick={() => navigate('/challenges')}
                  className="rounded-xl bg-[#CCFF00] px-4 py-2 text-xs font-bold text-black cursor-pointer"
                >
                  Browse Challenges
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myChallengeRegs.map((reg) => {
                  const sub = myChallengeSubs.find((s) => s.challengeId === reg.challengeId);
                  return (
                    <div key={reg.id} className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="rounded bg-[#CCFF00]/10 text-[#CCFF00] px-2 py-0.5 uppercase">
                          {reg.participationMode}
                          {reg.teamName ? ` • ${reg.teamName}` : ''}
                        </span>
                        <span className="text-zinc-500">
                          {new Date(reg.registeredAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-display text-base font-bold text-white">{reg.challengeTitle}</h4>
                      {sub ? (
                        <div className="rounded-xl border border-[#282c38] bg-[#161820] p-3 text-xs space-y-1.5">
                          <div className="flex items-center justify-between font-mono text-[10px]">
                            <span className="text-[#CCFF00] uppercase">Submission: {sub.projectTitle}</span>
                            <span className="uppercase text-emerald-300">
                              {sub.reviewStatus.replace('_', ' ')}
                              {typeof sub.score === 'number' ? ` (${sub.score}/100)` : ''}
                            </span>
                          </div>
                          {sub.reviewerFeedback && (
                            <p className="text-zinc-300">Feedback: {sub.reviewerFeedback}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400">
                          Registered. Submit your deliverable from the Challenges page before the deadline.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Opportunity Applications */}
        {activeTab === 'opportunities' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">Opportunity &amp; Grant Applications</h3>
              <button
                onClick={() => navigate('/opportunities')}
                className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
              >
                Explore Opportunities
              </button>
            </div>

            {myOppApps.length === 0 ? (
              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-8 text-center space-y-3">
                <Briefcase className="h-8 w-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">You haven&apos;t applied to any grants, internships, or lab opportunities yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myOppApps.map((app) => (
                  <div key={app.id} className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="rounded bg-[#CCFF00]/10 text-[#CCFF00] px-2 py-0.5 uppercase">
                        {app.status.replace('_', ' ')}
                      </span>
                      <span className="text-zinc-500">
                        {new Date(app.appliedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="font-display text-base font-bold text-white">{app.opportunityTitle}</h4>
                    <p className="text-xs text-zinc-400 line-clamp-3">{app.statement}</p>
                    {app.adminNotes && (
                      <div className="rounded-xl border border-[#282c38] bg-[#161820] p-3 text-xs text-zinc-300">
                        <span className="font-mono text-[10px] text-[#CCFF00] uppercase block">Review Note:</span>
                        <p>{app.adminNotes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Event Passes */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">Confirmed Event Passes</h3>
              <button
                onClick={() => navigate('/events')}
                className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black"
              >
                Explore Events
              </button>
            </div>

            {myEvents.length === 0 ? (
              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-8 text-center space-y-3">
                <Calendar className="h-8 w-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">You haven't registered for any buildathons or workshops yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myEvents.map((reg) => (
                  <div key={reg.id} className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="rounded bg-emerald-950/60 text-emerald-400 px-2 py-0.5 uppercase">
                        {reg.status || 'Confirmed'}
                      </span>
                      <span className="text-zinc-500">
                        {new Date(reg.registeredAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="font-display text-base font-bold text-white">{reg.eventTitle}</h4>
                    <p className="text-xs text-zinc-400">Registered attendee: {reg.userName} ({reg.userEmail})</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Certificates */}
        {activeTab === 'certificates' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-white">Issued Certificates & Accreditations</h3>
                <p className="text-xs text-[#8e919b]">Preview, print in A4 landscape, or download verified PDFs.</p>
              </div>
              <button
                onClick={() => navigate('/verify')}
                className="flex items-center gap-1.5 rounded-xl border border-[#2b2f38] px-4 py-2 text-xs font-mono text-zinc-300 hover:text-white hover:border-[#CCFF00] cursor-pointer"
              >
                Public Verification Portal
              </button>
            </div>

            {certFeedback && (
              <div
                className={`rounded-xl border px-4 py-3 text-xs flex items-center gap-2 ${
                  certFeedback.type === 'success'
                    ? 'border-[#CCFF00]/40 bg-[#CCFF00]/10 text-[#CCFF00]'
                    : 'border-red-800 bg-red-950/40 text-red-300'
                }`}
              >
                {certFeedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{certFeedback.message}</span>
              </div>
            )}

            {myCertificates.length === 0 ? (
              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-8 text-center space-y-3">
                <Award className="h-8 w-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">
                  No certificates issued yet. Certificates are minted after completing a verified fellowship sprint or winning a challenge.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myCertificates.map((cert) => (
                  <div key={cert.id} className="rounded-2xl border border-[#CCFF00]/30 bg-[#121614] p-6 space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#CCFF00] font-bold">{cert.certId}</span>
                      <span className="text-zinc-400">{cert.issueDate}</span>
                    </div>
                    <div>
                      <h4 className="font-display text-base font-bold text-white">
                        {cert.competitionName || cert.activityName}
                      </h4>
                      {cert.certificateTitle && (
                        <p className="text-[11px] font-mono text-[#CCFF00]/80 mt-0.5">{cert.certificateTitle}</p>
                      )}
                      <p className="text-xs text-zinc-300 mt-1">Recipient: {cert.studentName}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Signer: {cert.authorizedSigner}
                        {cert.authorizedSignerTitle ? ` • ${cert.authorizedSignerTitle}` : ''}
                      </p>
                    </div>
                    <div className="border-t border-[#1f2820] pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewCert(cert)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] bg-[#161922] px-2.5 py-1.5 text-[11px] font-mono text-zinc-200 hover:border-[#CCFF00] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </button>
                        <button
                          type="button"
                          disabled={busyCertId === cert.certId}
                          onClick={async () => {
                            try {
                              setBusyCertId(cert.certId);
                              setCertFeedback(null);
                              const { filename, byteSize } = await downloadCertificatePdf(cert, certSettings);
                              setCertFeedback({
                                type: 'success',
                                message: `Downloaded ${filename} (${Math.round(byteSize / 1024)} KB PDF verified).`,
                              });
                            } catch (err: any) {
                              setCertFeedback({
                                type: 'error',
                                message: err?.message || 'Failed to generate certificate PDF.',
                              });
                            } finally {
                              setBusyCertId(null);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#CCFF00] px-3 py-1.5 text-[11px] font-display font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-50 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {busyCertId === cert.certId ? 'Building...' : 'Download PDF'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPrintCert(cert);
                            window.setTimeout(() => {
                              triggerA4LandscapePrint(() => setPrintCert(null));
                            }, 80);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] bg-[#161922] px-2.5 py-1.5 text-[11px] font-mono text-zinc-200 hover:border-[#CCFF00] cursor-pointer"
                        >
                          <Printer className="h-3.5 w-3.5" /> Print
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/verify?id=${cert.certId}`)}
                        className="text-[#CCFF00] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Verify <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Physical Member Card Orders Tracking Tab */}
        {activeTab === 'card_orders' && (
          <MemberCardOrdersPanel orders={myCardOrders} navigate={navigate} />
        )}

        {/* Dedicated Notifications & Announcements Hub */}
        {activeTab === 'notifications' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <Bell className="h-5 w-5 text-[#CCFF00]" /> Notifications &amp; Activity Feed
                </h2>
                <p className="text-xs text-[#8e919b]">
                  Stay updated on membership status, startup team join requests, project reviews, tasks, and events.
                </p>
              </div>
              {sqlNotifications.some((n) => !n.isRead) && (
                <button
                  type="button"
                  onClick={async () => {
                    await apiRequest('/api/notifications/my/read-all', { method: 'PATCH', requireAuth: true }).catch(() => {});
                    setSqlNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#151821] px-4 py-2 font-mono text-xs text-[#CCFF00] hover:border-[#CCFF00]/50 cursor-pointer"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
                </button>
              )}
            </div>

            {sqlNotifications.length === 0 && myNotifications.length === 0 ? (
              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-10 text-center space-y-2">
                <Bell className="h-8 w-8 text-zinc-600 mx-auto" />
                <p className="text-sm font-semibold text-white">You&apos;re all caught up</p>
                <p className="text-xs text-zinc-400">
                  Team invitations, join requests, project updates, and ESC announcements will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sqlNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-2xl border p-5 text-xs space-y-2 ${
                      !n.isRead ? 'border-[#39FF14]/45 bg-[#111912]' : 'border-[#232731] bg-[#111317]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {!n.isRead && <span className="h-2 w-2 rounded-full bg-[#39FF14]" />}
                        <span className="font-display text-sm font-bold text-white">{n.title}</span>
                        <span className="rounded bg-[#1b1f29] px-2 py-0.5 font-mono text-[10px] uppercase text-[#CCFF00]">
                          {n.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-zinc-300 leading-relaxed">{n.description}</p>
                    <div className="flex flex-wrap items-center gap-3 pt-1 font-mono text-[11px]">
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/notifications/${n.id}/read`, { method: 'PATCH', requireAuth: true }).catch(() => {});
                            setSqlNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
                          }}
                          className="text-zinc-400 hover:text-white cursor-pointer"
                        >
                          Mark Read
                        </button>
                      )}
                      {n.linkTab && (
                        <button
                          type="button"
                          onClick={() => {
                            const allowedTabs = [
                              'overview',
                              'team',
                              'members',
                              'tasks',
                              'ideas',
                              'projects',
                              'problems',
                              'challenges',
                              'events',
                              'opportunities',
                              'certificates',
                              'card_orders',
                              'support',
                              'resources',
                            ] as const;
                            if ((allowedTabs as readonly string[]).includes(n.linkTab!)) {
                              setActiveTab(n.linkTab as any);
                            }
                          }}
                          className="text-[#39FF14] font-semibold hover:underline cursor-pointer"
                        >
                          Open {n.linkTab.replace(/_/g, ' ')} →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {myNotifications.map((n) => (
                  <div key={n.id} className="rounded-2xl border border-[#232731] bg-[#111317] p-5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-bold text-white">{n.title || n.senderName}</span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-zinc-300">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Member Resources, Digital/Physical Member Card & Guidelines Tab */}
        {activeTab === 'resources' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[#CCFF00]" /> ESC Member Resources &amp; Credentials
              </h2>
              <p className="text-xs text-[#8e919b]">
                Access your official ESC Digital &amp; Physical Member Card, community guidelines, builder tools, and support channels.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
              <div className="rounded-2xl border border-[#39FF14]/40 bg-[#0e1610] p-6 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1 rounded bg-[#39FF14]/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#39FF14]">
                    <ShieldCheck className="h-3.5 w-3.5" /> Official Identity
                  </span>
                  <h3 className="font-display text-base font-bold text-white">ESC Digital &amp; Physical Member Card</h3>
                  <p className="text-zinc-300 leading-relaxed">
                    Download your verified ESC Digital Member Card or order your official Physical Member Card delivered anywhere in India.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/verify')}
                    className="rounded-xl bg-[#39FF14] px-4 py-2 font-display text-[11px] font-extrabold uppercase text-black hover:bg-[#32e010] cursor-pointer"
                  >
                    Open Member Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('card_orders')}
                    className="rounded-xl border border-[#2b2f38] bg-[#161922] px-3 py-2 font-mono text-[11px] text-zinc-200 hover:text-white cursor-pointer"
                  >
                    Track Orders ({myCardOrders.length})
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1 rounded bg-[#CCFF00]/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#CCFF00]">
                    <MessageCircle className="h-3.5 w-3.5" /> Community Hub
                  </span>
                  <h3 className="font-display text-base font-bold text-white">Official ESC WhatsApp Group</h3>
                  <p className="text-zinc-400 leading-relaxed">
                    Connect directly with approved ESC engineering fellows, startup builders, and event mentors.
                  </p>
                </div>
                <a
                  href={resolveWhatsappCommunityUrl(siteSettings.whatsappCommunityUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-[11px] font-extrabold uppercase text-black hover:bg-[#b8e600]"
                >
                  Join WhatsApp Group <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-sky-300">
                    <Target className="h-3.5 w-3.5" /> Engineering Launchpad
                  </span>
                  <h3 className="font-display text-base font-bold text-white">Problem Exchange &amp; Startup Lab</h3>
                  <p className="text-zinc-400 leading-relaxed">
                    Discover 1,000+ real industry problems, pitch ideas in Startup Lab, and assemble a 4-member engineering venture team.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/problem-exchange')}
                    className="rounded-xl border border-[#2b2f38] bg-[#161922] px-3.5 py-2 font-mono text-[11px] text-[#39FF14] hover:border-[#39FF14]/50 cursor-pointer"
                  >
                    Problem Exchange →
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/ideas')}
                    className="rounded-xl border border-[#2b2f38] bg-[#161922] px-3.5 py-2 font-mono text-[11px] text-zinc-200 hover:text-white cursor-pointer"
                  >
                    Startup Lab →
                  </button>
                </div>
              </div>
            </div>

            {siteSettings.communityGuidelines && (
              <div className="rounded-2xl border border-[#232b24] bg-[#0f1310] p-6 space-y-2 text-xs">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14] block">
                  Official ESC Community Guidelines &amp; Code of Conduct
                </span>
                <p className="text-zinc-300 whitespace-pre-line leading-relaxed">
                  {siteSettings.communityGuidelines}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Support Tickets Tab */}
        {activeTab === 'support' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-white">My Support Tickets</h2>
                <p className="text-xs text-[#8e919b]">
                  Track the status of your private ESC help and support requests.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/support')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#32e010] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> New Support Request
              </button>
            </div>

            {mySupportTickets.length === 0 ? (
              <div className="rounded-2xl border border-[#232731] bg-[#111317] p-10 text-center space-y-3">
                <LifeBuoy className="h-8 w-8 text-zinc-600 mx-auto" />
                <p className="text-sm font-semibold text-white">No support requests submitted yet</p>
                <p className="text-xs text-[#8e919b] max-w-md mx-auto">
                  Need help with your fellowship application, a startup project, or a website issue? Submit a request from the ESC Support Center.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/support')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#32e010] cursor-pointer"
                >
                  Open Need Help Center <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {mySupportTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#39FF14]">
                          {ticket.ticketId}
                        </span>
                        <span className="rounded-lg border border-[#272b36] bg-[#171a22] px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                          {ticket.category}
                        </span>
                      </div>
                      <span className="rounded-full border border-[#39FF14]/40 bg-[#39FF14]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#39FF14]">
                        {getSupportStatusLabel(ticket.status)}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-sm font-bold text-white">{ticket.subject}</h3>
                      <p className="mt-1 text-xs text-zinc-400 whitespace-pre-wrap">{ticket.description}</p>
                    </div>

                    {ticket.adminNotes && (
                      <div className="rounded-xl border border-[#2a342a] bg-[#0f1510] p-3 text-xs text-zinc-200">
                        <span className="block font-mono text-[10px] uppercase text-[#39FF14] mb-0.5">
                          ESC Admin Update
                        </span>
                        {ticket.adminNotes}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-zinc-500 border-t border-[#1c1f26]">
                      <span>Submitted: {new Date(ticket.createdAt).toLocaleString()}</span>
                      <span>Last updated: {new Date(ticket.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      <StartupTeamCreateModal
        isOpen={teamCreateOpen}
        onClose={() => setTeamCreateOpen(false)}
        onCreated={async (created) => {
          setTeamFeedback({
            type: 'success',
            text: `Startup Team "${created.name}" (${created.teamCode}) launched! Invite up to 3 approved ESC members.`,
          });
          await refreshSqlWorkspace();
        }}
      />

      <CertificatePreviewModal
        certificate={previewCert}
        settings={certSettings}
        isOpen={Boolean(previewCert)}
        onClose={() => setPreviewCert(null)}
        onNavigateVerify={(certId) => navigate(`/verify?id=${certId}`)}
      />

      {printCert && (
        <CertificatePrintPortal certificate={printCert} settings={certSettings} />
      )}

      <MemberProjectSubmissionModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        userUid={user.uid}
        userName={profile?.fullName || user.displayName || 'ESC Member'}
        userEmail={user.email || ''}
        onCreated={(created) => {
          setMyProjects((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
          setProjectFeedback({
            type: 'success',
            text:
              created.status === 'draft'
                ? `Project "${created.title}" saved as Draft.`
                : `Project "${created.title}" submitted for ESC Admin review!`,
          });
        }}
      />

      <ProfilePhotoUploaderModal
        isOpen={photoModalOpen}
        currentPhotoUrl={profile?.profilePhotoUrl}
        userUid={user.uid}
        onClose={() => setPhotoModalOpen(false)}
        onSavePhoto={async (photoUrl) => {
          await updateUserProfile({
            profilePhotoUrl: photoUrl,
            profilePhotoUpdatedAt: new Date().toISOString(),
          });
          setPhotoFeedback(
            'Profile photo saved! It will appear on your ESC profile and official Digital Member Card.'
          );
        }}
      />
    </div>
  );
};

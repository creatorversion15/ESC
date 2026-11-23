import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  FileText,
  Lightbulb,
  FolderGit2,
  Calendar,
  Award,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  X,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  Megaphone,
  Settings,
  Activity,
  Lock,
  Eye,
  ExternalLink,
  Trophy,
  Briefcase,
  Rocket,
  ListChecks,
  Bot,
  Tag,
  LifeBuoy,
  Target,
  LayoutGrid,
  ArrowLeft,
  Menu,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { apiRequest } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import {
  exportToCSV,
  computeAdminMetrics,
  computeExtendedAdminMetrics,
  DEFAULT_CERTIFICATE_SETTINGS,
  getIdeaStatusLabel,
  normalizeIdeaReviewStatus,
} from '../utils/escLogic';
import { AdminCharts } from '../components/admin/AdminCharts';
import { ConfirmModal } from '../components/admin/ConfirmModal';
import { CertificateManagementSection } from '../components/admin/CertificateManagementSection';
import { ChallengeManagementSection } from '../components/admin/ChallengeManagementSection';
import { EventManagementSection } from '../components/admin/EventManagementSection';
import { OpportunityManagementSection } from '../components/admin/OpportunityManagementSection';
import { AdminNotificationCenter } from '../components/admin/AdminNotificationCenter';
import { MembersManagementSection } from '../components/admin/MembersManagementSection';
import { StartupTeamsAdminSection } from '../components/admin/StartupTeamsAdminSection';
import { TaskManagementSection } from '../components/admin/TaskManagementSection';
import { MemberActivityMonitorSection } from '../components/admin/MemberActivityMonitorSection';
import { CustomSkillsAdminSection } from '../components/admin/CustomSkillsAdminSection';
import { SupportRequestsAdminSection } from '../components/admin/SupportRequestsAdminSection';
import { ProblemManagementSection } from '../components/admin/ProblemManagementSection';
import { AdminModulesHub } from '../components/admin/AdminModulesHub';
import { AdminSidebarNav } from '../components/admin/AdminSidebarNav';
import { AdminNotificationsPage } from '../components/admin/AdminNotificationsPage';
import { PhysicalCardOrdersAdminSection } from '../components/admin/PhysicalCardOrdersAdminSection';
import {
  buildAdminModuleCards,
  buildAdminModuleHash,
  getAdminCategoryById,
  getAdminModuleById,
  normalizeAdminTab,
  parseAdminTabFromHash,
  type AdminTab,
} from '../utils/adminModules';
import type {
  Application,
  UserProfile,
  UserRole,
  StartupIdea,
  Project,
  ProjectStatus,
  ChallengeItem,
  ChallengeRegistration,
  ChallengeSubmission,
  EventItem,
  EventRegistration,
  OpportunityItem,
  OpportunityApplication,
  CertificateRecord,
  CertificateSettings,
  AdminAuditLog,
  MembershipStatus,
  Announcement,
  SiteSettings,
  MemberCategoryFilter,
  StartupTeam,
  TeamTask,
  TaskStatus,
  ProgressReport,
  PlatformNotification,
  MemberActivityLog,
  MemberCardOrder,
} from '../types';

interface AdminProps {
  navigate: (path: string) => void;
}

export const Admin: React.FC<AdminProps> = ({ navigate }) => {
  const { user, loading: authLoading, isSuperAdmin, isAdmin, serverVerified, signInWithGoogle } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>(() =>
    typeof window !== 'undefined' ? parseAdminTabFromHash(window.location.hash) : 'hub'
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [startupTeams, setStartupTeams] = useState<StartupTeam[]>([]);
  const [adminTasks, setAdminTasks] = useState<TeamTask[]>([]);
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<PlatformNotification[]>([]);
  const [memberActivities, setMemberActivities] = useState<MemberActivityLog[]>([]);
  const [problemExchangeStats, setProblemExchangeStats] = useState<{
    totalPublished: number;
    pendingReview: number;
    solverInterestsPending: number;
    reportsOpen: number;
  } | null>(null);
  const [supportTicketsSummary, setSupportTicketsSummary] = useState<{
    total: number;
    open: number;
  } | null>(null);
  const [customSkillsSummary, setCustomSkillsSummary] = useState<{
    total: number;
    pending: number;
  } | null>(null);
  const [cardOrders, setCardOrders] = useState<MemberCardOrder[]>([]);
  const [cardOrdersLoaded, setCardOrdersLoaded] = useState(false);

  const selectAdminTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
    if (typeof window !== 'undefined') {
      const targetHash = `#${buildAdminModuleHash(tab)}`;
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash.startsWith('#/admin')) {
        setActiveTab(parseAdminTabFromHash(window.location.hash));
      }
    };
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const [memberCategoryFilter, setMemberCategoryFilter] = useState<MemberCategoryFilter>('all');
  const [teamStatusFilter, setTeamStatusFilter] = useState<string>('all');
  const [selectedTeamIdJump, setSelectedTeamIdJump] = useState<string | null>(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | TaskStatus>('all');
  const [applications, setApplications] = useState<Application[]>([]);
  const [ideas, setIdeas] = useState<StartupIdea[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [challengeRegistrations, setChallengeRegistrations] = useState<ChallengeRegistration[]>([]);
  const [challengeSubmissions, setChallengeSubmissions] = useState<ChallengeSubmission[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventRegistrations, setEventRegistrations] = useState<EventRegistration[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [opportunityApplications, setOpportunityApplications] = useState<OpportunityApplication[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    heroBadgeText: 'Think. Engineer. Build. Launch.',
    heroAnnouncement: '',
    applicationsOpen: true,
    applicationCycleLabel: 'Student-Led Engineering Ecosystem',
    contactEmail: 'contact@esc.community',
    whatsappCommunityUrl: '',
    communityGuidelines: '',
    upiId: '9420482152-2@ybl',
    upiPayeeName: 'Engineering Startup Company (ESC)',
    physicalCardPrice: 151,
    updatedAt: new Date().toISOString(),
  });
  const [certSettings, setCertSettings] = useState<CertificateSettings>(DEFAULT_CERTIFICATE_SETTINGS);

  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Confirm Dialog State (replaces window.confirm)
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Filters
  const [appSearch, setAppSearch] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('all');
  const [ideaFilter, setIdeaFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [logSearch, setLogSearch] = useState('');

  // Modals State

  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [appNotes, setAppNotes] = useState('');
  const [updatingApp, setUpdatingApp] = useState(false);

  const [selectedIdea, setSelectedIdea] = useState<StartupIdea | null>(null);
  const [ideaFeedback, setIdeaFeedback] = useState('');
  const [updatingIdea, setUpdatingIdea] = useState(false);

  // Project Modal
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projTitle, setProjTitle] = useState('');
  const [projCategory, setProjCategory] = useState('Robotics & Mechatronics');
  const [projDesc, setProjDesc] = useState('');
  const [projStatus, setProjStatus] = useState<ProjectStatus>('recruiting');
  const [projLeaderId, setProjLeaderId] = useState('');
  const [projSkills, setProjSkills] = useState('');
  const [projRepoUrl, setProjRepoUrl] = useState('');
  const [projDemoUrl, setProjDemoUrl] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  // Announcement Modal
  const [annModalOpen, setAnnModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annType, setAnnType] = useState<Announcement['type']>('info');
  const [annLinkPath, setAnnLinkPath] = useState('/events');
  const [annLinkLabel, setAnnLinkLabel] = useState('View Details');
  const [annActive, setAnnActive] = useState(true);
  const [annPinned, setAnnPinned] = useState(false);
  const [savingAnn, setSavingAnn] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const notifyBanner = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => setStatusBanner(null), 5000);
  };

  const logAdminAction = async (
    action: string,
    targetType: string,
    targetId: string,
    details: string
  ) => {
    if (!user) return;
    try {
      const logRef = doc(collection(db, 'adminLogs'));
      const logItem: AdminAuditLog = {
        adminId: user.uid,
        adminEmail: user.email || '',
        action,
        targetType,
        targetId,
        details,
        timestamp: new Date().toISOString(),
      };
      await setDoc(logRef, logItem);
      setLogs((prev) => [{ id: logRef.id, ...logItem }, ...prev]);
    } catch (err) {
      console.warn('Could not record audit log:', err);
    }
  };

  const createUserNotification = async (
    recipientId: string,
    title: string,
    message: string,
    type: 'application' | 'idea' | 'event' | 'system'
  ) => {
    if (!recipientId) return;
    try {
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        recipientId,
        senderName: isSuperAdmin ? 'ESC Super Admin' : 'ESC Review Council',
        title,
        message,
        type,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Could not send user notification:', err);
    }
  };

  const fetchAllAdminData = async () => {
    if (!isAdmin || !serverVerified?.verified) return;

    try {
      setLoadingData(true);
      setDataError(null);

      const firestoreLabels = [
        'users',
        'applications',
        'ideas',
        'projects',
        'events',
        'challenges',
        'opportunities',
        'certificates',
        'announcements',
        'adminLogs',
        'siteSettings/public',
        'certificateSettings/default',
      ] as const;

      const [
        firestoreResults,
        sqlOverviewRes,
        sqlUsersRes,
        sqlTeamsRes,
        sqlTasksRes,
        sqlReportsRes,
        sqlNotifsRes,
        sqlActsRes,
        sqlSettingsRes,
        sqlPxStatsRes,
        sqlSupportRes,
        sqlCustomSkillsRes,
        sqlCardOrdersRes,
      ] = await Promise.all([
          Promise.allSettled([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'applications')),
            getDocs(collection(db, 'ideas')),
            getDocs(collection(db, 'projects')),
            getDocs(
              isSuperAdmin
                ? collection(db, 'events')
                : query(collection(db, 'events'), where('isPublished', '==', true))
            ),
            getDocs(
              isSuperAdmin
                ? collection(db, 'challenges')
                : query(collection(db, 'challenges'), where('isPublished', '==', true))
            ),
            getDocs(
              isSuperAdmin
                ? collection(db, 'opportunities')
                : query(collection(db, 'opportunities'), where('isPublished', '==', true))
            ),
            getDocs(collection(db, 'certificates')),
            getDocs(collection(db, 'announcements')),
            getDocs(collection(db, 'adminLogs')),
            getDoc(doc(db, 'siteSettings', 'public')),
            getDoc(doc(db, 'certificateSettings', 'default')),
          ]),
          apiRequest<Record<string, any[]>>('/api/admin/overview', { requireAuth: true }).catch(() => null),
          apiRequest<any[]>('/api/users', { requireAuth: true }).catch(() => null),
          apiRequest<StartupTeam[]>('/api/admin/teams', { requireAuth: true }).catch(() => null),
          apiRequest<TeamTask[]>('/api/admin/tasks', { requireAuth: true }).catch(() => null),
          apiRequest<ProgressReport[]>('/api/admin/reports', { requireAuth: true }).catch(() => null),
          apiRequest<PlatformNotification[]>('/api/admin/notifications', { requireAuth: true }).catch(() => null),
          apiRequest<MemberActivityLog[]>('/api/admin/activities', { requireAuth: true }).catch(() => null),
          apiRequest<SiteSettings>('/api/site-settings').catch(() => null),
          apiRequest<{
            totalPublished: number;
            pendingReview: number;
            solverInterestsPending: number;
            reportsOpen: number;
          }>('/api/admin/problem-exchange/stats', { requireAuth: true }).catch(() => null),
          apiRequest<any[]>('/api/admin/support', { requireAuth: true }).catch(() => null),
          apiRequest<any[]>('/api/admin/skills/custom', { requireAuth: true }).catch(() => null),
          apiRequest<MemberCardOrder[]>('/api/admin/card-orders', { requireAuth: true }).catch(() => null),
        ]);

      const [
        usersRes,
        appsRes,
        ideasRes,
        projectsRes,
        eventsRes,
        challengesRes,
        opportunitiesRes,
        certsRes,
        annRes,
        logsRes,
        settingsRes,
        certSettingsRes,
      ] = firestoreResults;

      const failedCollections: string[] = [];
      firestoreResults.forEach((res, idx) => {
        if (res.status === 'rejected') {
          const label = firestoreLabels[idx];
          if (label !== 'certificateSettings/default') {
            failedCollections.push(label);
            console.warn(`Admin Firestore read notice [${label}]:`, res.reason);
          }
        }
      });

      const sortNewest = <T extends { createdAt?: string; timestamp?: string; registeredAt?: string; submittedAt?: string; appliedAt?: string }>(items: T[]) =>
        [...items].sort((a, b) =>
          (b.createdAt || b.timestamp || b.submittedAt || b.registeredAt || b.appliedAt || '').localeCompare(
            a.createdAt || a.timestamp || a.submittedAt || a.registeredAt || a.appliedAt || ''
          )
        );

      const firestoreUsers: UserProfile[] =
        usersRes.status === 'fulfilled'
          ? usersRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile))
          : [];

      const sqlUserList = Array.isArray(sqlUsersRes)
        ? sqlUsersRes
        : Array.isArray(sqlOverviewRes?.users)
        ? sqlOverviewRes.users
        : [];

      const sqlUserMap = new Map<string, any>();
      for (const su of sqlUserList) {
        sqlUserMap.set(su.uid || su.userId, su);
      }

      const mergedUsers: UserProfile[] = firestoreUsers.map((fu) => {
        const su = sqlUserMap.get(fu.userId);
        if (!su) return fu;
        return {
          ...fu,
          escMemberId: su.escMemberId || fu.escMemberId || '',
          accountStatus: su.accountStatus || fu.accountStatus || 'active',
          approvalDate: su.approvalDate || fu.approvalDate || '',
          approvedBy: su.approvedBy || fu.approvedBy || '',
          lastActiveAt: su.lastActiveAt || fu.lastActiveAt || su.lastLoginAt || fu.lastLoginAt,
          startupTeamId: su.startupTeamId || fu.startupTeamId || '',
          teamRole: su.teamRole || fu.teamRole || '',
          membershipStatus: (su.membershipStatus as MembershipStatus) || fu.membershipStatus,
          profilePhotoUrl: su.profilePhotoUrl || fu.profilePhotoUrl || '',
          profilePhotoUpdatedAt: su.profilePhotoUpdatedAt || fu.profilePhotoUpdatedAt || '',
          memberCardGeneratedAt: su.memberCardGeneratedAt || fu.memberCardGeneratedAt || '',
        };
      });

      for (const [uid, su] of sqlUserMap.entries()) {
        if (!mergedUsers.some((u) => u.userId === uid)) {
          mergedUsers.push({
            userId: uid,
            fullName: su.fullName || 'ESC User',
            email: su.email || '',
            photoURL: su.photoUrl || '',
            profilePhotoUrl: su.profilePhotoUrl || '',
            profilePhotoUpdatedAt: su.profilePhotoUpdatedAt || '',
            memberCardGeneratedAt: su.memberCardGeneratedAt || '',
            college: su.college || '',
            branch: su.branch || '',
            academicYear: su.academicYear || '',
            technicalSkills: su.technicalSkills || [],
            role: (su.role || 'student') as UserRole,
            membershipStatus: (su.membershipStatus || 'unregistered') as MembershipStatus,
            escMemberId: su.escMemberId || '',
            accountStatus: su.accountStatus || 'active',
            approvalDate: su.approvalDate || '',
            approvedBy: su.approvedBy || '',
            lastActiveAt: su.lastActiveAt || su.lastLoginAt || '',
            createdAt: su.createdAt || new Date().toISOString(),
            updatedAt: su.updatedAt || new Date().toISOString(),
          });
        }
      }

      setUsersList(sortNewest(mergedUsers));
      if (Array.isArray(sqlTeamsRes)) setStartupTeams(sqlTeamsRes);
      if (Array.isArray(sqlTasksRes)) setAdminTasks(sqlTasksRes);
      if (Array.isArray(sqlReportsRes)) setProgressReports(sqlReportsRes);
      if (Array.isArray(sqlNotifsRes)) setAdminNotifications(sqlNotifsRes);
      if (Array.isArray(sqlActsRes)) setMemberActivities(sqlActsRes);
      if (sqlPxStatsRes && typeof sqlPxStatsRes.totalPublished === 'number') {
        setProblemExchangeStats({
          totalPublished: sqlPxStatsRes.totalPublished,
          pendingReview: Number(sqlPxStatsRes.pendingReview) || 0,
          solverInterestsPending: Number(sqlPxStatsRes.solverInterestsPending) || 0,
          reportsOpen: Number(sqlPxStatsRes.reportsOpen) || 0,
        });
      }
      if (Array.isArray(sqlSupportRes)) {
        const openCount = sqlSupportRes.filter((t) =>
          ['new', 'open', 'in_progress', 'pending'].includes(String(t?.status || '').toLowerCase())
        ).length;
        setSupportTicketsSummary({ total: sqlSupportRes.length, open: openCount });
      }
      if (Array.isArray(sqlCustomSkillsRes)) {
        const pendingSkills = sqlCustomSkillsRes.filter(
          (s) => String(s?.status || '').toLowerCase() === 'pending'
        ).length;
        setCustomSkillsSummary({ total: sqlCustomSkillsRes.length, pending: pendingSkills });
      }
      if (Array.isArray(sqlCardOrdersRes)) {
        setCardOrders(sqlCardOrdersRes);
        setCardOrdersLoaded(true);
      }

      const mapSnapOrSql = <T,>(
        res: PromiseSettledResult<any>,
        sqlFallbackKey: string
      ): T[] => {
        if (res.status === 'fulfilled') {
          return res.value.docs.map((d: any) => ({ id: d.id, ...d.data() } as T));
        }
        const fallback = sqlOverviewRes?.[sqlFallbackKey];
        return Array.isArray(fallback) ? (fallback as T[]) : [];
      };

      setApplications(sortNewest(mapSnapOrSql<Application>(appsRes, 'applications')));
      setIdeas(sortNewest(mapSnapOrSql<StartupIdea>(ideasRes, 'ideas')));
      {
        const fsProjects = mapSnapOrSql<Project>(projectsRes, 'projects');
        const sqlProjects = Array.isArray(sqlOverviewRes?.projects)
          ? (sqlOverviewRes.projects as Project[])
          : [];
        const mergedProjectMap = new Map<string, Project>();
        fsProjects.forEach((p) => {
          if (p.id) mergedProjectMap.set(p.id, p);
        });
        sqlProjects.forEach((p) => {
          if (p.id && !mergedProjectMap.has(p.id)) {
            mergedProjectMap.set(p.id, p);
          }
        });
        setProjects(sortNewest(Array.from(mergedProjectMap.values())));
      }
      setEvents(sortNewest(mapSnapOrSql<EventItem>(eventsRes, 'events')));
      setChallenges(sortNewest(mapSnapOrSql<ChallengeItem>(challengesRes, 'challenges')));
      setOpportunities(sortNewest(mapSnapOrSql<OpportunityItem>(opportunitiesRes, 'opportunities')));
      setCertificates(sortNewest(mapSnapOrSql<CertificateRecord>(certsRes, 'certificates')));
      setAnnouncements(sortNewest(mapSnapOrSql<Announcement>(annRes, 'announcements')));
      setLogs(sortNewest(mapSnapOrSql<AdminAuditLog>(logsRes, 'logs')));

      if (isSuperAdmin) {
        const [chalRegRes, chalSubRes, evRegRes, oppAppRes] = await Promise.allSettled([
          getDocs(collection(db, 'challengeRegistrations')),
          getDocs(collection(db, 'challengeSubmissions')),
          getDocs(collection(db, 'eventRegistrations')),
          getDocs(collection(db, 'opportunityApplications')),
        ]);
        setChallengeRegistrations(
          sortNewest(
            chalRegRes.status === 'fulfilled'
              ? chalRegRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeRegistration))
              : ((sqlOverviewRes?.challengeRegistrations || []) as ChallengeRegistration[])
          )
        );
        setChallengeSubmissions(
          sortNewest(
            chalSubRes.status === 'fulfilled'
              ? chalSubRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeSubmission))
              : ((sqlOverviewRes?.challengeSubmissions || []) as ChallengeSubmission[])
          )
        );
        setEventRegistrations(
          sortNewest(
            evRegRes.status === 'fulfilled'
              ? evRegRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as EventRegistration))
              : ((sqlOverviewRes?.eventRegistrations || []) as EventRegistration[])
          )
        );
        setOpportunityApplications(
          sortNewest(
            oppAppRes.status === 'fulfilled'
              ? oppAppRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as OpportunityApplication))
              : ((sqlOverviewRes?.opportunityApplications || []) as OpportunityApplication[])
          )
        );
      } else {
        setChallengeRegistrations([]);
        setChallengeSubmissions([]);
        setEventRegistrations([]);
        setOpportunityApplications([]);
      }

      const firestoreSettings =
        settingsRes.status === 'fulfilled' && settingsRes.value.exists()
          ? (settingsRes.value.data() as Partial<SiteSettings>)
          : {};
      const sqlSettings = sqlSettingsRes || {};
      setSiteSettings((prev) => ({
        ...prev,
        ...firestoreSettings,
        whatsappCommunityUrl:
          (sqlSettings as Partial<SiteSettings>).whatsappCommunityUrl ||
          firestoreSettings.whatsappCommunityUrl ||
          '',
        communityGuidelines:
          (sqlSettings as Partial<SiteSettings>).communityGuidelines ||
          firestoreSettings.communityGuidelines ||
          '',
        upiId:
          (sqlSettings as Partial<SiteSettings>).upiId ||
          firestoreSettings.upiId ||
          '9420482152-2@ybl',
        upiPayeeName:
          (sqlSettings as Partial<SiteSettings>).upiPayeeName ||
          firestoreSettings.upiPayeeName ||
          'Engineering Startup Company (ESC)',
        physicalCardPrice:
          (sqlSettings as Partial<SiteSettings>).physicalCardPrice ||
          firestoreSettings.physicalCardPrice ||
          151,
      }));

      if (certSettingsRes.status === 'fulfilled' && certSettingsRes.value.exists()) {
        setCertSettings({
          ...DEFAULT_CERTIFICATE_SETTINGS,
          ...(certSettingsRes.value.data() as Partial<CertificateSettings>),
        });
      }

      if (failedCollections.length === 11 && !sqlOverviewRes) {
        setDataError(
          `Permission or network error loading Firestore collections (${failedCollections.join(', ')}). Verify your administrator account and try syncing again.`
        );
      }
    } catch (err: any) {
      console.error('Failed to load admin database collections:', err);
      setDataError(
        err?.message ||
          'Permission or network error loading live database collections. Verify your admin authorization and try syncing again.'
      );
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin && serverVerified?.verified) {
      fetchAllAdminData();
    } else if (!authLoading) {
      setLoadingData(false);
    }
  }, [isAdmin, serverVerified?.verified, authLoading]);

  const metrics = useMemo(
    () =>
      computeAdminMetrics({
        users: usersList,
        applications,
        ideas,
        projects,
        events,
        certificates,
      }),
    [usersList, applications, ideas, projects, events, certificates]
  );

  const extendedMetrics = useMemo(
    () =>
      computeExtendedAdminMetrics({
        users: usersList,
        teams: startupTeams,
        tasks: adminTasks,
        projects,
      }),
    [usersList, startupTeams, adminTasks, projects]
  );

  const moduleCards = useMemo(
    () =>
      buildAdminModuleCards({
        totalMembers: usersList.length,
        membersUnderReview: extendedMetrics.membersUnderReview,
        totalApplications: applications.length,
        pendingApplications: metrics.pendingApplications,
        totalTeams: startupTeams.length,
        teamsUnderReview: extendedMetrics.teamsUnderReview,
        totalTasks: adminTasks.length,
        overdueTasks: extendedMetrics.overdueTasks,
        totalActivities: memberActivities.length,
        totalIdeas: ideas.length,
        pendingIdeas: ideas.filter((i) => normalizeIdeaReviewStatus(i.reviewStatus) === 'pending').length,
        publishedProblems: problemExchangeStats ? problemExchangeStats.totalPublished : null,
        pendingProblems: problemExchangeStats?.pendingReview || 0,
        pendingSolverInterests: problemExchangeStats?.solverInterestsPending || 0,
        openProblemReports: problemExchangeStats?.reportsOpen || 0,
        totalChallenges: challenges.length,
        totalChallengeSubmissions: challengeSubmissions.length,
        totalProjects: projects.length,
        activeProjects: metrics.totalActiveProjects,
        totalCustomSkills: customSkillsSummary ? customSkillsSummary.total : null,
        pendingCustomSkills: customSkillsSummary?.pending || 0,
        totalEvents: events.length,
        publishedEvents: events.filter((e) => e.isPublished).length,
        totalOpportunities: opportunities.length,
        totalOpportunityApplications: opportunityApplications.length,
        totalSupportTickets: supportTicketsSummary ? supportTicketsSummary.total : null,
        openSupportTickets: supportTicketsSummary?.open || 0,
        totalCertificates: certificates.length,
        validCertificates: certificates.filter((c) => c.status === 'valid').length,
        totalCardOrders: cardOrdersLoaded ? cardOrders.length : null,
        pendingCardOrders: cardOrders.filter((o) => o.paymentStatus === 'pending_verification').length,
        totalNotifications: adminNotifications.length,
        unreadNotifications: adminNotifications.filter((n) => !n.isRead).length,
        totalAnnouncements: announcements.length,
        totalLogs: logs.length,
        applicationsOpen: siteSettings.applicationsOpen,
      }),
    [
      usersList.length,
      extendedMetrics,
      applications.length,
      metrics,
      startupTeams.length,
      adminTasks.length,
      memberActivities.length,
      ideas,
      problemExchangeStats,
      challenges.length,
      challengeSubmissions.length,
      projects.length,
      customSkillsSummary,
      events,
      opportunities.length,
      opportunityApplications.length,
      supportTicketsSummary,
      certificates,
      cardOrders,
      cardOrdersLoaded,
      adminNotifications,
      announcements.length,
      logs.length,
      siteSettings.applicationsOpen,
    ]
  );

  // --- APPLICATION REVIEW ---
  const handleUpdateAppStatus = async (app: Application, newStatus: MembershipStatus) => {
    try {
      setUpdatingApp(true);
      const now = new Date().toISOString();
      const notes = appNotes.trim() || app.adminNotes || '';
      const appRef = doc(db, 'applications', app.id!);

      let generatedEscMemberId = '';
      if (newStatus === 'approved' && app.userId) {
        const sqlApproveRes = await apiRequest<{ escMemberId: string; user: any }>('/api/admin/members/approve', {
          method: 'POST',
          requireAuth: true,
          body: {
            userUid: app.userId,
            applicationId: app.id,
            adminNotes: notes,
          },
        });
        generatedEscMemberId = sqlApproveRes.escMemberId || '';
      }

      await updateDoc(appRef, {
        status: newStatus,
        adminNotes: notes,
        reviewedBy: user?.displayName || user?.email || 'Admin',
        ...(newStatus === 'approved'
          ? {
              approvalDate: now,
              approvedBy: user?.email || 'Admin',
            }
          : {}),
        updatedAt: now,
      });

      // Synchronize user profile membership status, ESC Member ID & member promotion
      if (app.userId) {
        const userRef = doc(db, 'users', app.userId);
        const targetUser = usersList.find((u) => u.userId === app.userId);
        const preserveElevatedRole =
          targetUser &&
          ['superadmin', 'admin', 'project_lead', 'lead', 'mentor'].includes(targetUser.role);
        const nextRole: UserRole = preserveElevatedRole
          ? targetUser!.role
          : newStatus === 'approved'
          ? 'member'
          : 'student';

        const userPatch: Record<string, any> = {
          membershipStatus: newStatus,
          role: nextRole,
          updatedAt: now,
        };
        if (newStatus === 'approved') {
          userPatch.escMemberId = generatedEscMemberId || targetUser?.escMemberId || '';
          userPatch.accountStatus = 'active';
          userPatch.approvalDate = now;
          userPatch.approvedBy = user?.email || 'Admin';
        }

        await updateDoc(userRef, userPatch);

        if (newStatus !== 'approved') {
          await Promise.all([
            apiRequest(`/api/admin/applications/${encodeURIComponent(app.id!)}`, {
              method: 'PATCH',
              requireAuth: true,
              body: { status: newStatus, adminNotes: notes },
            }).catch(() => {}),
            apiRequest(`/api/admin/members/${app.userId}`, {
              method: 'PATCH',
              requireAuth: true,
              body: { membershipStatus: newStatus, role: nextRole },
            }).catch(() => {}),
          ]);
        }

        setUsersList((prev) =>
          prev.map((u) =>
            u.userId === app.userId
              ? {
                  ...u,
                  ...userPatch,
                }
              : u
          )
        );

        await createUserNotification(
          app.userId,
          newStatus === 'approved'
            ? `ESC Membership Approved • ID ${generatedEscMemberId}`
            : `Application ${newStatus.replace('_', ' ').toUpperCase()}`,
          newStatus === 'approved'
            ? `Congratulations! You are an official approved ESC member (ID: ${generatedEscMemberId}). Open your Dashboard Overview to join the Official ESC WhatsApp Community and create/join a Startup Team.${notes ? ` Admin note: ${notes}` : ''}`
            : notes
            ? `Your ESC Fellowship application status is now "${newStatus.replace('_', ' ')}". Note: ${notes}`
            : `Your ESC Fellowship application status has been updated to "${newStatus.replace('_', ' ')}".`,
          'application'
        );
      }

      await logAdminAction(
        `APPLICATION_${newStatus.toUpperCase()}`,
        'Application',
        app.id!,
        `Changed ${app.fullName} (${app.email}) status to ${newStatus}${generatedEscMemberId ? ` • Member ID ${generatedEscMemberId}` : ''}`
      );

      if (newStatus === 'approved') {
        confetti({
          particleCount: 55,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#CCFF00', '#ffffff'],
        });
      }

      setApplications((prev) =>
        prev.map((a) =>
          a.id === app.id ? { ...a, status: newStatus, adminNotes: notes, updatedAt: now } : a
        )
      );
      setSelectedApp(null);
      setAppNotes('');
      notifyBanner(
        'success',
        newStatus === 'approved'
          ? `Approved ${app.fullName} • Issued ESC Member ID ${generatedEscMemberId}. In-app notification & WhatsApp access unlocked.`
          : `Application for ${app.fullName} updated to ${newStatus.replace('_', ' ')}.`
      );
    } catch (err: any) {
      notifyBanner('error', err?.message || 'Failed to update application status.');
    } finally {
      setUpdatingApp(false);
    }
  };

  // --- STARTUP IDEA REVIEW ---
  const handleReviewIdea = async (
    idea: StartupIdea,
    status: 'approved' | 'changes_requested' | 'rejected' | 'cancelled',
    makePublic: boolean
  ) => {
    try {
      setUpdatingIdea(true);
      const now = new Date().toISOString();
      const feedback = ideaFeedback.trim() || idea.adminFeedback || '';
      const adminEmail = user?.email || 'Admin';
      const resolvedPublic = status === 'approved' && makePublic;
      const nextHistory = [
        ...(Array.isArray(idea.decisionHistory) ? idea.decisionHistory : []),
        {
          status,
          feedback,
          adminEmail,
          timestamp: now,
        },
      ];

      const ideaRef = doc(db, 'ideas', idea.id!);
      await updateDoc(ideaRef, {
        reviewStatus: status,
        isPublic: resolvedPublic,
        adminFeedback: feedback,
        reviewedBy: adminEmail,
        reviewedAt: now,
        decisionHistory: nextHistory,
        updatedAt: now,
      }).catch(() => {});

      await apiRequest(`/api/admin/ideas/${idea.id}/review`, {
        method: 'PATCH',
        requireAuth: true,
        body: {
          reviewStatus: status,
          adminFeedback: feedback,
        },
      }).catch(() => {});

      const statusLabel = getIdeaStatusLabel(status);
      await logAdminAction(
        `IDEA_${status.toUpperCase()}`,
        'StartupIdea',
        idea.id!,
        `Marked idea "${idea.title}" as ${statusLabel} (public=${resolvedPublic})`
      );

      if (idea.authorId) {
        await createUserNotification(
          idea.authorId,
          `Startup Idea: ${statusLabel}`,
          `Your startup proposal "${idea.title}" was marked ${statusLabel}.${feedback ? ` Feedback: ${feedback}` : ''}`,
          'idea'
        );
      }

      setIdeas((prev) =>
        prev.map((i) =>
          i.id === idea.id
            ? {
                ...i,
                reviewStatus: status,
                isPublic: resolvedPublic,
                adminFeedback: feedback,
                reviewedBy: adminEmail,
                reviewedAt: now,
                decisionHistory: nextHistory,
                updatedAt: now,
              }
            : i
        )
      );
      setSelectedIdea(null);
      setIdeaFeedback('');
      notifyBanner('success', `Idea "${idea.title}" marked as ${statusLabel}.`);
    } catch (err: any) {
      notifyBanner('error', err?.message || 'Failed to review idea.');
    } finally {
      setUpdatingIdea(false);
    }
  };

  // --- PROJECTS CRUD ---
  const openProjectModal = (proj?: Project) => {
    if (proj) {
      setEditingProject(proj);
      setProjTitle(proj.title);
      setProjCategory(proj.category);
      setProjDesc(proj.description);
      setProjStatus(proj.status);
      setProjLeaderId(proj.leaderId);
      setProjSkills((proj.requiredSkills || []).join(', '));
      setProjRepoUrl(proj.repoUrl || '');
      setProjDemoUrl(proj.demoUrl || '');
    } else {
      setEditingProject(null);
      setProjTitle('');
      setProjCategory('Robotics & Mechatronics');
      setProjDesc('');
      setProjStatus('recruiting');
      setProjLeaderId(user?.uid || '');
      setProjSkills('');
      setProjRepoUrl('');
      setProjDemoUrl('');
    }
    setProjectModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projTitle.trim() || !projDesc.trim()) return;

    try {
      setSavingProject(true);
      const now = new Date().toISOString();
      const chosenLeader = usersList.find((u) => u.userId === projLeaderId);
      const leaderId = chosenLeader?.userId || projLeaderId || user?.uid || '';
      const leaderName = chosenLeader?.fullName || user?.displayName || 'ESC Project Lead';
      const skillsArr = projSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (editingProject?.id) {
        const ref = doc(db, 'projects', editingProject.id);
        const patch = {
          title: projTitle.trim(),
          category: projCategory.trim(),
          description: projDesc.trim(),
          status: projStatus,
          leaderId,
          leaderName,
          requiredSkills: skillsArr,
          repoUrl: projRepoUrl.trim(),
          demoUrl: projDemoUrl.trim(),
          updatedAt: now,
        };
        await updateDoc(ref, patch).catch(() => {});
        await apiRequest(`/api/admin/projects/${encodeURIComponent(editingProject.id)}`, {
          method: 'PATCH',
          requireAuth: true,
          body: { status: projStatus },
        }).catch(() => {});
        setProjects((prev) =>
          prev.map((p) => (p.id === editingProject.id ? { ...p, ...patch } : p))
        );
        await logAdminAction('PROJECT_UPDATED', 'Project', editingProject.id, `Updated project "${projTitle}"`);
        notifyBanner('success', `Updated project "${projTitle}".`);
      } else {
        const ref = doc(collection(db, 'projects'));
        const newProj: Project = {
          id: ref.id,
          title: projTitle.trim(),
          category: projCategory.trim(),
          description: projDesc.trim(),
          status: projStatus,
          leaderId,
          leaderName,
          leaderEmail: chosenLeader?.email || user?.email || '',
          objectives: [],
          requiredSkills: skillsArr,
          teamMemberIds: leaderId ? [leaderId] : [],
          teamMembers: leaderId ? [{ id: leaderId, name: leaderName, role: 'Project Lead' }] : [],
          repoUrl: projRepoUrl.trim(),
          demoUrl: projDemoUrl.trim(),
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(ref, newProj);
        setProjects((prev) => [newProj, ...prev]);
        await logAdminAction('PROJECT_CREATED', 'Project', ref.id, `Created project "${projTitle}"`);
        notifyBanner('success', `Created project "${projTitle}".`);
      }
      setProjectModalOpen(false);
    } catch (err: any) {
      notifyBanner('error', err?.message || 'Failed to save project.');
    } finally {
      setSavingProject(false);
    }
  };

  const handleQuickProjectStatus = async (proj: Project, nextStatus: ProjectStatus) => {
    if (!proj.id) return;
    try {
      const now = new Date().toISOString();
      await Promise.all([
        updateDoc(doc(db, 'projects', proj.id), { status: nextStatus, updatedAt: now }).catch(() => {}),
        apiRequest(`/api/admin/projects/${encodeURIComponent(proj.id)}`, {
          method: 'PATCH',
          requireAuth: true,
          body: { status: nextStatus },
        }).catch(() => {}),
      ]);
      setProjects((prev) =>
        prev.map((p) => (p.id === proj.id ? { ...p, status: nextStatus, updatedAt: now } : p))
      );
      await logAdminAction(
        'PROJECT_STATUS_UPDATED',
        'Project',
        proj.id,
        `Marked project "${proj.title}" as ${nextStatus.replace(/_/g, ' ')}`
      );
      notifyBanner('success', `Project "${proj.title}" marked as ${nextStatus.replace(/_/g, ' ')}.`);
    } catch (err: any) {
      notifyBanner('error', err?.message || 'Failed to update project status.');
    }
  };

  // --- WEBSITE CONTENT & ANNOUNCEMENTS ---
  const openAnnModal = (ann?: Announcement) => {
    if (ann) {
      setEditingAnn(ann);
      setAnnTitle(ann.title);
      setAnnMessage(ann.message);
      setAnnType(ann.type);
      setAnnLinkPath(ann.linkPath || '');
      setAnnLinkLabel(ann.linkLabel || '');
      setAnnActive(ann.isActive);
      setAnnPinned(ann.isPinned);
    } else {
      setEditingAnn(null);
      setAnnTitle('');
      setAnnMessage('');
      setAnnType('highlight');
      setAnnLinkPath('/events');
      setAnnLinkLabel('Learn More');
      setAnnActive(true);
      setAnnPinned(true);
    }
    setAnnModalOpen(true);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMessage.trim()) return;

    try {
      setSavingAnn(true);
      const now = new Date().toISOString();
      if (editingAnn?.id) {
        const ref = doc(db, 'announcements', editingAnn.id);
        const patch = {
          title: annTitle.trim(),
          message: annMessage.trim(),
          type: annType,
          linkPath: annLinkPath.trim(),
          linkLabel: annLinkLabel.trim(),
          isActive: annActive,
          isPinned: annPinned,
          updatedAt: now,
        };
        await updateDoc(ref, patch);
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === editingAnn.id ? { ...a, ...patch } : a))
        );
        await logAdminAction('ANNOUNCEMENT_UPDATED', 'Announcement', editingAnn.id, `Updated announcement "${annTitle}"`);
        notifyBanner('success', 'Announcement updated.');
      } else {
        const ref = doc(collection(db, 'announcements'));
        const newAnn: Announcement = {
          id: ref.id,
          title: annTitle.trim(),
          message: annMessage.trim(),
          type: annType,
          linkPath: annLinkPath.trim(),
          linkLabel: annLinkLabel.trim(),
          isActive: annActive,
          isPinned: annPinned,
          createdBy: user?.email || 'Admin',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(ref, newAnn);
        setAnnouncements((prev) => [newAnn, ...prev]);
        await logAdminAction('ANNOUNCEMENT_CREATED', 'Announcement', ref.id, `Created announcement "${annTitle}"`);
        notifyBanner('success', 'Announcement published to live site.');
      }
      setAnnModalOpen(false);
    } catch (err: any) {
      notifyBanner('error', err?.message || 'Failed to save announcement.');
    } finally {
      setSavingAnn(false);
    }
  };

  const handleSaveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      notifyBanner('error', 'Only the Super Admin can modify global website configuration.');
      return;
    }

    try {
      setSavingSettings(true);
      const now = new Date().toISOString();
      const payload: SiteSettings = {
        ...siteSettings,
        updatedAt: now,
        updatedBy: user?.email || 'soviraj50@gmail.com',
      };
      await Promise.all([
        setDoc(doc(db, 'siteSettings', 'public'), payload, { merge: true }),
        apiRequest('/api/admin/site-settings', {
          method: 'PUT',
          requireAuth: true,
          body: payload,
        }),
      ]);
      await logAdminAction(
        'SITE_SETTINGS_UPDATED',
        'SiteSettings',
        'public',
        `Updated global website settings (applicationsOpen=${payload.applicationsOpen})`
      );
      notifyBanner('success', 'Global website settings & WhatsApp Community URL updated.');
    } catch (err: any) {
      notifyBanner('error', err?.message || 'Failed to save global settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // --- CSV EXPORTS ---
  const triggerCSVDownload = (filename: string, csvContent: string) => {
    if (!csvContent) {
      notifyBanner('error', 'No records available to export.');
      return;
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportUsersCSV = () => {
    const csv = exportToCSV(usersList, [
      { key: 'userId', label: 'User ID' },
      { key: 'fullName', label: 'Full Name' },
      { key: 'email', label: 'Email' },
      { key: 'college', label: 'College' },
      { key: 'branch', label: 'Branch' },
      { key: 'academicYear', label: 'Year' },
      { key: 'role', label: 'Role' },
      { key: 'membershipStatus', label: 'Membership Status' },
      { key: 'technicalSkills', label: 'Technical Skills' },
      { key: 'createdAt', label: 'Registered Date' },
      { key: 'lastLoginAt', label: 'Last Login' },
    ]);
    triggerCSVDownload(`esc_users_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const handleExportApplicationsCSV = () => {
    const csv = exportToCSV(applications, [
      { key: 'id', label: 'Application ID' },
      { key: 'userId', label: 'User ID' },
      { key: 'fullName', label: 'Full Name' },
      { key: 'email', label: 'Email' },
      { key: 'college', label: 'College' },
      { key: 'branch', label: 'Branch' },
      { key: 'academicYear', label: 'Academic Year' },
      { key: 'status', label: 'Application Status' },
      { key: 'weeklyAvailability', label: 'Availability' },
      { key: 'teamGoal', label: 'Team Goal' },
      { key: 'technicalSkills', label: 'Technical Skills' },
      { key: 'whyJoin', label: 'Motivation' },
      { key: 'createdAt', label: 'Submitted At' },
    ]);
    triggerCSVDownload(`esc_applications_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const handleExportIdeasCSV = () => {
    const csv = exportToCSV(ideas, [
      { key: 'id', label: 'Idea ID' },
      { key: 'title', label: 'Title' },
      { key: 'authorName', label: 'Founder' },
      { key: 'authorEmail', label: 'Founder Email' },
      { key: 'industry', label: 'Industry' },
      { key: 'stage', label: 'Stage' },
      { key: 'reviewStatus', label: 'Review Status' },
      { key: 'isPublic', label: 'Public Listed' },
      { key: 'problemStatement', label: 'Problem Statement' },
      { key: 'proposedSolution', label: 'Solution' },
    ]);
    triggerCSVDownload(`esc_startup_ideas_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  // --- ACCESS CONTROL GATES ---
  if (authLoading) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center bg-[#0b0c0e] px-4">
        <div className="text-center space-y-3 font-mono text-xs text-[#CCFF00]">
          <div className="h-6 w-6 rounded-full border-2 border-[#CCFF00] border-t-transparent animate-spin mx-auto" />
          <p>Verifying administrator credentials...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center bg-[#0b0c0e] px-4">
        <div className="rounded-2xl border border-[#252932] bg-[#111317] p-8 text-center max-w-md space-y-5 shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/30">
            <Lock className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00]">
              Server-Verified Authentication Required
            </span>
            <h2 className="font-display text-2xl font-bold text-white">ESC Admin Control Center</h2>
            <p className="text-xs text-[#9ca3af] leading-relaxed">
              Sign in with an authorized Google administrator account to access community records, application reviews, and platform management.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => signInWithGoogle()}
              className="w-full rounded-xl bg-[#CCFF00] py-3 font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-[#b8e600] cursor-pointer"
            >
              Sign In with Google
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full rounded-xl border border-[#2b2f38] py-2.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin || !serverVerified?.verified) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center bg-[#0b0c0e] px-4">
        <div className="rounded-2xl border border-red-900/50 bg-[#120f12] p-8 text-center max-w-md space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-950/60 text-red-400">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h2 className="font-display text-2xl font-bold text-white">Restricted Access</h2>
          <p className="text-xs text-[#9ca3af] leading-relaxed">
            Your signed-in account (<strong className="text-white">{user.email}</strong>) does not hold verified Administrator or Super Admin permissions.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full rounded-xl bg-[#CCFF00] py-2.5 font-display text-xs font-bold uppercase tracking-wider text-black cursor-pointer"
          >
            Return to Homepage
          </button>
        </div>
      </div>
    );
  }

  // Filtered Views
  const filteredApps = applications.filter((app) => {
    if (appStatusFilter !== 'all' && app.status !== appStatusFilter) return false;
    if (appSearch.trim()) {
      const q = appSearch.toLowerCase();
      return (
        app.fullName?.toLowerCase().includes(q) ||
        app.email?.toLowerCase().includes(q) ||
        app.college?.toLowerCase().includes(q) ||
        app.branch?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredIdeas = ideas.filter((i) =>
    ideaFilter === 'all' ? true : normalizeIdeaReviewStatus(i.reviewStatus) === ideaFilter
  );

  const filteredProjects = projects.filter((p) =>
    projectFilter === 'all' ? true : p.status === projectFilter
  );

  const filteredLogs = logs.filter((l) => {
    if (!logSearch.trim()) return true;
    const q = logSearch.toLowerCase();
    return (
      l.action?.toLowerCase().includes(q) ||
      l.adminEmail?.toLowerCase().includes(q) ||
      l.details?.toLowerCase().includes(q) ||
      l.targetType?.toLowerCase().includes(q)
    );
  });

  const activeModuleMeta = getAdminModuleById(activeTab);
  const activeCategoryMeta = activeModuleMeta ? getAdminCategoryById(activeModuleMeta.category) : null;

  const handleNotificationTarget = (tab: string, relatedId?: string) => {
    const normalized = normalizeAdminTab(tab);
    if (normalized === 'teams') {
      setTeamStatusFilter('all');
      setSelectedTeamIdJump(relatedId || null);
      selectAdminTab('teams');
    } else if (normalized === 'tasks') {
      setTaskStatusFilter('all');
      selectAdminTab('tasks');
    } else if (normalized === 'users') {
      setMemberCategoryFilter('all');
      selectAdminTab('users');
    } else {
      selectAdminTab(normalized);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c0e] py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px] space-y-6">
        {/* Top Admin Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1f2229] pb-5">
          <div className="space-y-1.5 min-w-0">
            {/* Contextual Breadcrumb */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-400">
              <button
                type="button"
                onClick={() => selectAdminTab('hub')}
                className="text-[#39FF14] font-semibold hover:underline cursor-pointer"
              >
                {isSuperAdmin ? 'ESC Super Admin Control Center' : 'ESC Admin Control Center'}
              </button>
              {activeCategoryMeta && (
                <>
                  <span aria-hidden="true">/</span>
                  <span>{activeCategoryMeta.title}</span>
                </>
              )}
              {activeModuleMeta && (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="text-white font-semibold">{activeModuleMeta.name}</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeTab !== 'hub' && (
                <button
                  type="button"
                  onClick={() => selectAdminTab('hub')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#262b36] bg-[#14171f] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors cursor-pointer shrink-0"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> All Modules
                </button>
              )}
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {activeModuleMeta ? activeModuleMeta.name : 'Community Database & Platform Console'}
              </h1>
            </div>

            <p className="text-xs text-[#8e919b] flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>
                Verified Session: <strong className="text-white">{user.email}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[#39FF14]">
                {isSuperAdmin ? 'Super Admin' : 'Administrator'}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Mobile & Tablet Modules Drawer Trigger */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 rounded-xl border border-[#39FF14]/45 bg-[#121914] px-3.5 py-2 text-xs font-semibold text-[#39FF14] hover:bg-[#19261b] cursor-pointer whitespace-nowrap"
            >
              <Menu className="h-4 w-4" /> All Modules ({moduleCards.length})
            </button>

            <AdminNotificationCenter
              notifications={adminNotifications}
              setNotifications={setAdminNotifications}
              onNavigateTarget={handleNotificationTarget}
            />
            <button
              type="button"
              onClick={fetchAllAdminData}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#14161c] px-3.5 py-2 text-xs font-mono text-zinc-300 hover:border-[#39FF14]/60 hover:text-white cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} /> Sync Database
            </button>
            <button
              type="button"
              onClick={() => selectAdminTab('hub')}
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-display text-xs font-bold uppercase cursor-pointer whitespace-nowrap transition-colors ${
                activeTab === 'hub'
                  ? 'bg-[#39FF14] text-black hover:bg-[#32e010]'
                  : 'border border-[#2b2f38] bg-[#14161c] text-white hover:border-[#39FF14] hover:text-[#39FF14]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Dashboard Hub
            </button>
          </div>
        </div>

        {/* Status / Error Banners */}
        {statusBanner && (
          <div
            className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-3 ${
              statusBanner.type === 'success'
                ? 'border-[#39FF14]/40 bg-[#39FF14]/10 text-[#39FF14]'
                : 'border-red-800 bg-red-950/40 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{statusBanner.text}</span>
            </div>
            <button onClick={() => setStatusBanner(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {dataError && (
          <div className="rounded-xl border border-red-800 bg-red-950/30 p-4 text-xs text-red-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{dataError}</span>
            </div>
            <button
              onClick={fetchAllAdminData}
              className="rounded-lg bg-red-900/60 px-3 py-1.5 font-mono text-[11px] text-white hover:bg-red-800 shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Workspace: Persistent Organized Sidebar + Full-Width Content Viewport */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <AdminSidebarNav
            cards={moduleCards}
            activeTab={activeTab}
            onSelectTab={selectAdminTab}
            mobileOpen={mobileNavOpen}
            onCloseMobile={() => setMobileNavOpen(false)}
          />

          <div className="flex-1 min-w-0 w-full">
            {activeTab === 'hub' ? (
              <AdminModulesHub
                cards={moduleCards}
                loadingData={loadingData}
                isSuperAdmin={isSuperAdmin}
                onSelectModule={selectAdminTab}
              />
            ) : loadingData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-32 rounded-2xl border border-[#232731] bg-[#111317] animate-pulse p-5"
                  />
                ))}
              </div>
            ) : (
              <>
                {/* TAB 1: OVERVIEW (CLICKABLE ECOSYSTEM PULSE) */}
                {activeTab === 'overview' && (
                  <div className="space-y-8">
                {/* Clickable Startup Teams, Members & Tasks Executive KPI Strip */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[#CCFF00]">
                      Interactive Ecosystem Metrics (Click any card to open filtered view)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
                    {[
                      {
                        label: 'Total Members',
                        value: extendedMetrics.totalMembers,
                        accent: 'text-white',
                        onClick: () => {
                          setMemberCategoryFilter('all');
                          selectAdminTab('users');
                        },
                      },
                      {
                        label: 'Approved Members',
                        value: extendedMetrics.approvedMembers,
                        accent: 'text-[#CCFF00]',
                        onClick: () => {
                          setMemberCategoryFilter('approved');
                          selectAdminTab('users');
                        },
                      },
                      {
                        label: 'Active Members',
                        value: extendedMetrics.activeMembers,
                        accent: 'text-emerald-400',
                        onClick: () => {
                          setMemberCategoryFilter('active');
                          selectAdminTab('users');
                        },
                      },
                      {
                        label: 'Members Under Review',
                        value: extendedMetrics.membersUnderReview,
                        accent: 'text-amber-300',
                        onClick: () => {
                          setMemberCategoryFilter('under_review');
                          selectAdminTab('users');
                        },
                      },
                      {
                        label: 'Total Startup Teams',
                        value: extendedMetrics.totalStartupTeams,
                        accent: 'text-white',
                        onClick: () => {
                          setTeamStatusFilter('all');
                          selectAdminTab('teams');
                        },
                      },
                      {
                        label: 'Teams Under Review',
                        value: extendedMetrics.teamsUnderReview,
                        accent: 'text-amber-300',
                        onClick: () => {
                          setTeamStatusFilter('under_review_group');
                          selectAdminTab('teams');
                        },
                      },
                      {
                        label: 'Active Startup Teams',
                        value: extendedMetrics.activeStartupTeams,
                        accent: 'text-[#CCFF00]',
                        onClick: () => {
                          setTeamStatusFilter('active_group');
                          selectAdminTab('teams');
                        },
                      },
                      {
                        label: 'Completed Projects',
                        value: extendedMetrics.completedProjects,
                        accent: 'text-emerald-400',
                        onClick: () => {
                          setTeamStatusFilter('completed');
                          selectAdminTab('teams');
                        },
                      },
                      {
                        label: 'Total Tasks',
                        value: extendedMetrics.totalTasks,
                        accent: 'text-white',
                        onClick: () => {
                          setTaskStatusFilter('all');
                          selectAdminTab('tasks');
                        },
                      },
                      {
                        label: 'Completed Tasks',
                        value: extendedMetrics.completedTasks,
                        accent: 'text-[#CCFF00]',
                        onClick: () => {
                          setTaskStatusFilter('completed');
                          selectAdminTab('tasks');
                        },
                      },
                      {
                        label: 'Overdue Tasks',
                        value: extendedMetrics.overdueTasks,
                        accent: 'text-red-400',
                        onClick: () => {
                          setTaskStatusFilter('overdue');
                          selectAdminTab('tasks');
                        },
                      },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.onClick}
                        className="text-left rounded-2xl border border-[#232731] bg-[#111317] p-4 space-y-1 hover:border-[#CCFF00]/60 hover:bg-[#151820] transition-all cursor-pointer"
                      >
                        <span className="font-mono text-[10px] text-[#8e919b] block uppercase">{item.label}</span>
                        <p className={`font-display text-2xl font-black ${item.accent}`}>{item.value}</p>
                        <span className="font-mono text-[10px] text-zinc-500 block">Open list →</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Firestore Platform KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[
                    { label: 'Total Registered Users', value: metrics.totalUsers, accent: 'text-white', sub: 'Verified accounts' },
                    { label: 'New Registrations (7d)', value: metrics.newRegistrations7d, accent: 'text-[#CCFF00]', sub: `${metrics.newRegistrations30d} in 30 days` },
                    { label: 'Total Applications', value: metrics.totalApplications, accent: 'text-white', sub: 'All submissions' },
                    { label: 'Pending Applications', value: metrics.pendingApplications, accent: 'text-amber-400', sub: 'Awaiting decision' },
                    { label: 'Approved Applications', value: metrics.approvedApplications, accent: 'text-[#CCFF00]', sub: 'Admitted members' },
                    { label: 'Rejected Applications', value: metrics.rejectedApplications, accent: 'text-red-400', sub: 'Declined' },
                    { label: 'Total Startup Ideas', value: metrics.totalIdeas, accent: 'text-white', sub: `${ideas.filter((i) => i.reviewStatus === 'pending').length} pending review` },
                    { label: 'Total Active Projects', value: metrics.totalActiveProjects, accent: 'text-[#CCFF00]', sub: `${projects.length} total workspaces` },
                    { label: 'Total Events', value: metrics.totalEvents, accent: 'text-white', sub: `${events.filter((e) => e.isPublished).length} published` },
                    { label: 'Certificates Issued', value: metrics.totalCertificates, accent: 'text-[#CCFF00]', sub: `${certificates.filter((c) => c.status === 'valid').length} valid` },
                  ].map((card, idx) => (
                    <div key={idx} className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-1">
                      <span className="font-mono text-[11px] text-[#8e919b] block">{card.label}</span>
                      <p className={`font-display text-3xl font-black ${card.accent}`}>{card.value}</p>
                      <span className="text-[10px] font-mono text-zinc-500 block">{card.sub}</span>
                    </div>
                  ))}
                </div>

                {/* Interactive Charts */}
                <AdminCharts metrics={metrics} />

                {/* Recent Activity & CSV Exports */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Recent Activity Feed */}
                  <div className="lg:col-span-2 rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                        <Activity className="h-4 w-4 text-[#CCFF00]" /> Recent Admin Activity Feed
                      </h3>
                      <button
                        onClick={() => selectAdminTab('logs')}
                        className="text-xs font-mono text-[#CCFF00] hover:underline cursor-pointer"
                      >
                        Full Audit Log →
                      </button>
                    </div>
                    {logs.length === 0 ? (
                      <p className="text-xs text-zinc-500 py-6 text-center font-mono">
                        No administrative actions recorded yet. Actions you perform appear here automatically.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {logs.slice(0, 6).map((log, idx) => (
                          <div
                            key={log.id || idx}
                            className="flex items-start justify-between gap-3 rounded-xl border border-[#1d2028] bg-[#14171d] px-4 py-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-[#CCFF00]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#CCFF00]">
                                  {log.action}
                                </span>
                                <span className="text-zinc-400 font-mono text-[10px]">{log.adminEmail}</span>
                              </div>
                              <p className="text-zinc-200">{log.details}</p>
                            </div>
                            <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                              {new Date(log.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Data Exports Card */}
                  <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-4">
                    <h3 className="font-display text-base font-bold text-white">Export Community Data</h3>
                    <p className="text-xs text-[#8e919b]">
                      Download real-time CSV snapshots directly from Firestore collections.
                    </p>
                    <div className="space-y-2.5 pt-2">
                      <button
                        onClick={handleExportUsersCSV}
                        className="w-full flex items-center justify-between rounded-xl border border-[#2f333f] bg-[#171a21] px-4 py-3 text-xs font-mono text-white hover:border-[#CCFF00] hover:text-[#CCFF00] cursor-pointer"
                      >
                        <span>Registered Users ({usersList.length})</span>
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleExportApplicationsCSV}
                        className="w-full flex items-center justify-between rounded-xl border border-[#2f333f] bg-[#171a21] px-4 py-3 text-xs font-mono text-white hover:border-[#CCFF00] hover:text-[#CCFF00] cursor-pointer"
                      >
                        <span>Applications ({applications.length})</span>
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleExportIdeasCSV}
                        className="w-full flex items-center justify-between rounded-xl border border-[#2f333f] bg-[#171a21] px-4 py-3 text-xs font-mono text-white hover:border-[#CCFF00] hover:text-[#CCFF00] cursor-pointer"
                      >
                        <span>Startup Ideas ({ideas.length})</span>
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MEMBERS & USER DATABASE (7 CATEGORIES + 360 INSPECT) */}
            {activeTab === 'users' && (
              <MembersManagementSection
                usersList={usersList}
                setUsersList={setUsersList}
                currentUid={user.uid}
                isSuperAdmin={isSuperAdmin}
                initialCategory={memberCategoryFilter}
                onNotify={notifyBanner}
                onRefreshAll={fetchAllAdminData}
                onLogAdminAction={logAdminAction}
                onOpenTeamById={(teamId) => {
                  setTeamStatusFilter('all');
                  setSelectedTeamIdJump(teamId);
                  selectAdminTab('teams');
                }}
                onExportCSV={handleExportUsersCSV}
              />
            )}

            {/* TAB 2B: STARTUP TEAMS SUPERVISION */}
            {activeTab === 'teams' && (
              <StartupTeamsAdminSection
                teams={startupTeams}
                setTeams={setStartupTeams}
                usersList={usersList}
                reports={progressReports}
                setReports={setProgressReports}
                initialStatusFilter={teamStatusFilter}
                initialSelectedTeamId={selectedTeamIdJump}
                onNotify={notifyBanner}
                onRefreshAll={fetchAllAdminData}
              />
            )}

            {/* TAB 2C: TASK & DEADLINE MANAGEMENT */}
            {activeTab === 'tasks' && (
              <TaskManagementSection
                tasks={adminTasks}
                setTasks={setAdminTasks}
                teams={startupTeams}
                initialFilter={taskStatusFilter}
                onNotify={notifyBanner}
                onRefreshAll={fetchAllAdminData}
              />
            )}

            {/* TAB 2D: MEMBER ACTIVITY MONITOR */}
            {activeTab === 'activities' && (
              <MemberActivityMonitorSection
                activities={memberActivities}
                usersList={usersList}
                teams={startupTeams}
                onRefresh={fetchAllAdminData}
              />
            )}

            {/* TAB 3: APPLICATIONS MANAGEMENT */}
            {activeTab === 'applications' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-[#232731] bg-[#121419] p-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8e919b]" />
                    <input
                      type="text"
                      value={appSearch}
                      onChange={(e) => setAppSearch(e.target.value)}
                      placeholder="Search applicant name, email, college, branch..."
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-10 pr-4 py-2 text-xs text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <select
                      value={appStatusFilter}
                      onChange={(e) => setAppStatusFilter(e.target.value)}
                      className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
                    >
                      <option value="all">All Statuses</option>
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under Review</option>
                      <option value="shortlisted">Shortlisted</option>
                      <option value="more_info_required">More Information Required</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="draft">Draft</option>
                    </select>
                    <button
                      onClick={handleExportApplicationsCSV}
                      className="flex items-center gap-1.5 rounded-xl border border-[#2f333f] bg-[#17191e] px-3.5 py-2 text-xs font-mono text-white hover:border-[#CCFF00] hover:text-[#CCFF00] cursor-pointer shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" /> CSV
                    </button>
                  </div>
                </div>

                {filteredApps.length === 0 ? (
                  <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-2">
                    <FileText className="h-8 w-8 text-zinc-600 mx-auto" />
                    <p className="text-xs text-zinc-400">No applications found matching the selected filters.</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#232731] bg-[#111317] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#1f2229] bg-[#161820] text-zinc-400 font-mono text-[11px] uppercase">
                        <tr>
                          <th className="px-5 py-3">Applicant</th>
                          <th className="px-5 py-3">Institution & Branch</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Submitted</th>
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1c1f26]">
                        {filteredApps.map((app) => (
                          <tr key={app.id} className="hover:bg-[#14161d] transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-semibold text-white">{app.fullName}</div>
                              <div className="text-[11px] text-[#8e919b]">{app.email}</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-zinc-200">{app.college || '—'}</div>
                              <div className="text-[11px] font-mono text-[#CCFF00]">{app.branch || '—'}</div>
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase font-semibold border ${
                                  app.status === 'approved'
                                    ? 'bg-[#CCFF00]/10 border-[#CCFF00]/40 text-[#CCFF00]'
                                    : app.status === 'rejected'
                                    ? 'bg-red-950/40 border-red-800 text-red-400'
                                    : app.status === 'shortlisted'
                                    ? 'bg-purple-950/40 border-purple-800 text-purple-300'
                                    : app.status === 'more_info_required'
                                    ? 'bg-amber-950/40 border-amber-700 text-amber-300'
                                    : app.status === 'submitted'
                                    ? 'bg-blue-950/40 border-blue-800 text-blue-400'
                                    : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                                }`}
                              >
                                {app.status ? app.status.replace('_', ' ') : 'draft'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-zinc-400 font-mono text-[11px]">
                              {app.createdAt
                                ? new Date(app.createdAt).toLocaleDateString()
                                : app.updatedAt
                                ? new Date(app.updatedAt).toLocaleDateString()
                                : '—'}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedApp(app);
                                  setAppNotes(app.adminNotes || '');
                                }}
                                className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-1.5 font-semibold text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black transition-colors cursor-pointer"
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: STARTUP IDEAS */}
            {activeTab === 'ideas' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h3 className="font-display text-lg font-bold text-white">Startup Lab Submissions</h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={ideaFilter}
                      onChange={(e) => setIdeaFilter(e.target.value)}
                      className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
                    >
                      <option value="all">All Review Statuses</option>
                      <option value="under_review">Under Review</option>
                      <option value="changes_requested">Changes Requested</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button
                      onClick={handleExportIdeasCSV}
                      className="flex items-center gap-1.5 rounded-xl border border-[#2f333f] bg-[#17191e] px-3.5 py-2 text-xs font-mono text-white hover:border-[#CCFF00] hover:text-[#CCFF00] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" /> CSV
                    </button>
                  </div>
                </div>

                {filteredIdeas.length === 0 ? (
                  <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-2">
                    <Lightbulb className="h-8 w-8 text-zinc-600 mx-auto" />
                    <p className="text-xs text-zinc-400">No startup ideas found in this filter.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredIdeas.map((idea) => {
                      const normStatus = normalizeIdeaReviewStatus(idea.reviewStatus);
                      const statusLabel = getIdeaStatusLabel(idea.reviewStatus);
                      return (
                        <div key={idea.id} className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-4 flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                              <span className="text-[#CCFF00]">{idea.industry} • {idea.stage}</span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {idea.aiAssisted && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-950/60 border border-purple-500/40 px-2 py-0.5 text-[10px] text-purple-200">
                                    <Bot className="h-3 w-3" /> AI-Assisted
                                  </span>
                                )}
                                <span className="text-[10px] text-zinc-500">
                                  {idea.isPublic ? 'Public' : 'Private'}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 uppercase text-[10px] ${
                                    normStatus === 'approved'
                                      ? 'text-emerald-400 bg-emerald-950/40'
                                      : normStatus === 'changes_requested'
                                        ? 'text-sky-300 bg-sky-950/40'
                                        : normStatus === 'rejected'
                                          ? 'text-red-400 bg-red-950/40'
                                          : normStatus === 'cancelled'
                                            ? 'text-zinc-400 bg-zinc-800'
                                            : 'text-amber-400 bg-amber-950/40'
                                  }`}
                                >
                                  {statusLabel}
                                </span>
                              </div>
                            </div>
                            <h4 className="font-display text-base font-bold text-white">{idea.title}</h4>
                            <p className="text-xs text-zinc-400 line-clamp-3">{idea.problemStatement}</p>
                            {idea.reviewedAt && (
                              <p className="font-mono text-[10px] text-zinc-500">
                                Last decision: {new Date(idea.reviewedAt).toLocaleString()} {idea.reviewedBy ? `by ${idea.reviewedBy}` : ''}
                              </p>
                            )}
                          </div>

                          <div className="border-t border-[#1c1f26] pt-3 flex items-center justify-between text-xs">
                            <span className="text-zinc-500">Founder: <strong className="text-zinc-200">{idea.authorName}</strong></span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedIdea(idea);
                                  setIdeaFeedback(idea.adminFeedback || '');
                                }}
                                className="rounded-lg border border-[#2b2f38] px-3 py-1 text-[11px] font-semibold text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black cursor-pointer"
                              >
                                Inspect &amp; Decide
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmState({
                                    isOpen: true,
                                    title: 'Delete Startup Idea',
                                    message: `Permanently delete "${idea.title}"? This action cannot be undone.`,
                                    confirmLabel: 'Delete Idea',
                                    onConfirm: async () => {
                                      await deleteDoc(doc(db, 'ideas', idea.id!));
                                      await logAdminAction('IDEA_DELETED', 'StartupIdea', idea.id!, `Deleted idea "${idea.title}"`);
                                      setIdeas((prev) => prev.filter((item) => item.id !== idea.id));
                                      notifyBanner('success', `Deleted idea "${idea.title}".`);
                                    },
                                  })
                                }
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 cursor-pointer"
                                title="Delete Idea"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: CUSTOM SKILLS MODERATION */}
            {activeTab === 'skills' && (
              <CustomSkillsAdminSection onNotify={notifyBanner} />
            )}

            {/* TAB: SUPPORT REQUESTS */}
            {activeTab === 'support' && (
              <SupportRequestsAdminSection onNotify={notifyBanner} />
            )}

            {/* TAB 5: PROJECTS MANAGEMENT */}
            {activeTab === 'projects' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">Engineering Project Workspaces</h3>
                    <p className="text-xs text-[#8e919b]">Create workspaces, assign Project Leads, and update project lifecycle states.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                      className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
                    >
                      <option value="all">All Statuses</option>
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under Review</option>
                      <option value="approved">Approved</option>
                      <option value="recruiting">Recruiting</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="completed">Completed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <button
                      onClick={() => openProjectModal()}
                      className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
                    >
                      <Plus className="h-4 w-4" /> New Project
                    </button>
                  </div>
                </div>

                {filteredProjects.length === 0 ? (
                  <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-2">
                    <FolderGit2 className="h-8 w-8 text-zinc-600 mx-auto" />
                    <p className="text-xs text-zinc-400">No engineering projects match this filter yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map((proj) => (
                      <div key={proj.id} className="rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-4 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-[#CCFF00]">{proj.category}</span>
                            <span className="rounded-full bg-[#1b1e25] border border-[#2b2f38] px-2.5 py-0.5 uppercase text-zinc-300">
                              {proj.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <h4 className="font-display text-base font-bold text-white">{proj.title}</h4>
                          <p className="text-xs text-zinc-400 line-clamp-3">{proj.description}</p>
                          {(proj.status === 'submitted' || proj.status === 'under_review' || proj.status === 'review') && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => handleQuickProjectStatus(proj, 'approved')}
                                className="rounded-lg bg-[#39FF14]/15 border border-[#39FF14]/45 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-[#39FF14] hover:bg-[#39FF14] hover:text-black cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickProjectStatus(proj, 'in_progress')}
                                className="rounded-lg border border-[#CCFF00]/40 bg-[#CCFF00]/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black cursor-pointer"
                              >
                                In Progress
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickProjectStatus(proj, 'rejected')}
                                className="rounded-lg border border-red-800/60 bg-red-950/40 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-red-300 hover:bg-red-900 cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-[#1c1f26] pt-3 flex items-center justify-between text-xs">
                          <span className="text-zinc-500">Lead: <strong className="text-white">{proj.leaderName}</strong></span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openProjectModal(proj)}
                              className="flex items-center gap-1 rounded-lg border border-[#2b2f38] px-2.5 py-1 text-[11px] text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" /> Edit
                            </button>
                            <button
                              onClick={() =>
                                setConfirmState({
                                  isOpen: true,
                                  title: 'Delete Project Workspace',
                                  message: `Delete "${proj.title}" permanently from Firestore?`,
                                  confirmLabel: 'Delete Project',
                                  onConfirm: async () => {
                                    await deleteDoc(doc(db, 'projects', proj.id!));
                                    await logAdminAction('PROJECT_DELETED', 'Project', proj.id!, `Deleted project "${proj.title}"`);
                                    setProjects((prev) => prev.filter((item) => item.id !== proj.id));
                                    notifyBanner('success', `Deleted project "${proj.title}".`);
                                  },
                                })
                              }
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: CHALLENGE MANAGEMENT */}
            {activeTab === 'challenges' && (
              <ChallengeManagementSection
                challenges={challenges}
                setChallenges={setChallenges}
                registrations={challengeRegistrations}
                setRegistrations={setChallengeRegistrations}
                submissions={challengeSubmissions}
                setSubmissions={setChallengeSubmissions}
                isSuperAdmin={isSuperAdmin}
                adminEmail={user?.email || ''}
                onNotify={notifyBanner}
                onLogAdminAction={logAdminAction}
                onRequestDelete={(challenge, onDeleted) =>
                  setConfirmState({
                    isOpen: true,
                    title: 'Delete Engineering Challenge',
                    message: `Permanently delete "${challenge.title}"? This removes it from the public site immediately.`,
                    confirmLabel: 'Delete Challenge',
                    danger: true,
                    onConfirm: onDeleted,
                  })
                }
              />
            )}

            {/* TAB 7: EVENT MANAGEMENT */}
            {activeTab === 'events' && (
              <EventManagementSection
                events={events}
                setEvents={setEvents}
                registrations={eventRegistrations}
                setRegistrations={setEventRegistrations}
                isSuperAdmin={isSuperAdmin}
                adminEmail={user?.email || ''}
                onNotify={notifyBanner}
                onLogAdminAction={logAdminAction}
                onRequestDelete={(event, onDeleted) =>
                  setConfirmState({
                    isOpen: true,
                    title: 'Delete Event',
                    message: `Permanently delete "${event.title}" from Firestore?`,
                    confirmLabel: 'Delete Event',
                    danger: true,
                    onConfirm: onDeleted,
                  })
                }
              />
            )}

            {/* TAB 8: OPPORTUNITY MANAGEMENT */}
            {activeTab === 'opportunities' && (
              <OpportunityManagementSection
                opportunities={opportunities}
                setOpportunities={setOpportunities}
                applications={opportunityApplications}
                setApplications={setOpportunityApplications}
                isSuperAdmin={isSuperAdmin}
                adminEmail={user?.email || ''}
                onNotify={notifyBanner}
                onLogAdminAction={logAdminAction}
                onRequestDelete={(opp, onDeleted) =>
                  setConfirmState({
                    isOpen: true,
                    title: 'Delete Opportunity',
                    message: `Permanently delete "${opp.title}"?`,
                    confirmLabel: 'Delete Opportunity',
                    danger: true,
                    onConfirm: onDeleted,
                  })
                }
              />
            )}

            {/* TAB 7: CERTIFICATES */}
            {activeTab === 'certificates' && (
              <CertificateManagementSection
                certificates={certificates}
                setCertificates={setCertificates}
                usersList={usersList}
                certSettings={certSettings}
                setCertSettings={setCertSettings}
                isSuperAdmin={isSuperAdmin}
                adminEmail={user?.email || ''}
                onNotify={notifyBanner}
                onLogAdminAction={logAdminAction}
                onCreateNotification={(recipientId, title, message) =>
                  createUserNotification(recipientId, title, message, 'system')
                }
                onRequestRevoke={(cert) =>
                  setConfirmState({
                    isOpen: true,
                    title: 'Revoke Certificate',
                    message: `Revoke certificate ${cert.certId} issued to ${cert.studentName}?`,
                    confirmLabel: 'Revoke',
                    danger: true,
                    onConfirm: async () => {
                      await updateDoc(doc(db, 'certificates', cert.certId), { status: 'revoked' });
                      await logAdminAction(
                        'CERTIFICATE_REVOKED',
                        'Certificate',
                        cert.certId,
                        `Revoked certificate ${cert.certId}`
                      );
                      setCertificates((prev) =>
                        prev.map((c) => (c.certId === cert.certId ? { ...c, status: 'revoked' } : c))
                      );
                      notifyBanner('success', `Revoked certificate ${cert.certId}.`);
                    },
                  })
                }
                onNavigateVerify={(certId) => navigate(`/verify?id=${certId}`)}
              />
            )}

            {/* TAB: NOTIFICATIONS & SITE ANNOUNCEMENTS */}
            {activeTab === 'notifications' && (
              <AdminNotificationsPage
                notifications={adminNotifications}
                setNotifications={setAdminNotifications}
                announcements={announcements}
                onOpenAnnouncementModal={openAnnModal}
                onToggleAnnouncementActive={async (ann) => {
                  const next = !ann.isActive;
                  await updateDoc(doc(db, 'announcements', ann.id!), { isActive: next });
                  setAnnouncements((prev) =>
                    prev.map((a) => (a.id === ann.id ? { ...a, isActive: next } : a))
                  );
                }}
                onDeleteAnnouncement={(ann) =>
                  setConfirmState({
                    isOpen: true,
                    title: 'Delete Announcement',
                    message: `Delete announcement "${ann.title}"?`,
                    confirmLabel: 'Delete',
                    onConfirm: async () => {
                      await deleteDoc(doc(db, 'announcements', ann.id!));
                      await logAdminAction(
                        'ANNOUNCEMENT_DELETED',
                        'Announcement',
                        ann.id!,
                        `Deleted "${ann.title}"`
                      );
                      setAnnouncements((prev) => prev.filter((a) => a.id !== ann.id));
                      notifyBanner('success', 'Announcement deleted.');
                    },
                  })
                }
                onNavigateTarget={handleNotificationTarget}
              />
            )}

            {/* TAB: ANALYTICS & REPORTS */}
            {activeTab === 'analytics_reports' && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[
                    { label: 'Total Registered Users', value: metrics.totalUsers, accent: 'text-white', sub: 'Verified accounts' },
                    { label: 'New Registrations (7d)', value: metrics.newRegistrations7d, accent: 'text-[#39FF14]', sub: `${metrics.newRegistrations30d} in 30 days` },
                    { label: 'Pending Applications', value: metrics.pendingApplications, accent: 'text-amber-400', sub: `${metrics.approvedApplications} approved` },
                    { label: 'Active Startup Teams', value: extendedMetrics.activeStartupTeams, accent: 'text-[#39FF14]', sub: `${extendedMetrics.totalStartupTeams} total teams` },
                    { label: 'Published Problems', value: problemExchangeStats ? problemExchangeStats.totalPublished : '—', accent: 'text-white', sub: 'ESC Problem Exchange' },
                  ].map((card, idx) => (
                    <div key={idx} className="rounded-2xl border border-[#222630] bg-[#101217] p-5 space-y-1">
                      <span className="font-mono text-[11px] text-[#8e919b] block">{card.label}</span>
                      <p className={`font-display text-3xl font-black tabular-nums ${card.accent}`}>{card.value}</p>
                      <span className="text-[10px] font-mono text-zinc-500 block">{card.sub}</span>
                    </div>
                  ))}
                </div>

                <AdminCharts metrics={metrics} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 rounded-2xl border border-[#222630] bg-[#101217] p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                        <Activity className="h-4 w-4 text-[#39FF14]" /> Recent Admin Activity Feed
                      </h3>
                      <button
                        type="button"
                        onClick={() => selectAdminTab('logs')}
                        className="text-xs font-mono text-[#39FF14] hover:underline cursor-pointer"
                      >
                        Full Audit Log →
                      </button>
                    </div>
                    {logs.length === 0 ? (
                      <p className="text-xs text-zinc-500 py-6 text-center font-mono">
                        No administrative actions recorded yet.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {logs.slice(0, 6).map((log, idx) => (
                          <div
                            key={log.id || idx}
                            className="flex items-start justify-between gap-3 rounded-xl border border-[#1d2028] bg-[#14171d] px-4 py-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold text-[#39FF14]">
                                  {log.action}
                                </span>
                                <span className="text-zinc-500">·</span>
                                <span className="text-zinc-400 font-mono text-[10px]">{log.adminEmail}</span>
                              </div>
                              <p className="text-zinc-200">{log.details}</p>
                            </div>
                            <span className="font-mono text-[10px] tabular-nums text-zinc-500 shrink-0">
                              {new Date(log.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[#222630] bg-[#101217] p-6 space-y-4">
                    <h3 className="font-display text-base font-bold text-white">Export Community Data</h3>
                    <p className="text-xs text-[#8e919b]">
                      Download real-time CSV snapshots directly from live database collections.
                    </p>
                    <div className="space-y-2.5 pt-2">
                      <button
                        type="button"
                        onClick={handleExportUsersCSV}
                        className="w-full flex items-center justify-between rounded-xl border border-[#2f333f] bg-[#171a21] px-4 py-3 text-xs font-mono text-white hover:border-[#39FF14] hover:text-[#39FF14] cursor-pointer"
                      >
                        <span>Registered Users ({usersList.length})</span>
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleExportApplicationsCSV}
                        className="w-full flex items-center justify-between rounded-xl border border-[#2f333f] bg-[#171a21] px-4 py-3 text-xs font-mono text-white hover:border-[#39FF14] hover:text-[#39FF14] cursor-pointer"
                      >
                        <span>Applications ({applications.length})</span>
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleExportIdeasCSV}
                        className="w-full flex items-center justify-between rounded-xl border border-[#2f333f] bg-[#171a21] px-4 py-3 text-xs font-mono text-white hover:border-[#39FF14] hover:text-[#39FF14] cursor-pointer"
                      >
                        <span>Startup Ideas ({ideas.length})</span>
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ADMIN SETTINGS (SUPER ADMIN CONFIGURATION) */}
            {activeTab === 'settings' && (
              <div className="max-w-3xl space-y-6">
                <div className="rounded-2xl border border-[#222630] bg-[#101217] p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-[#1f2229] pb-4">
                    <div>
                      <span className="font-mono text-[10px] uppercase text-[#39FF14] block">
                        Super Admin Controls
                      </span>
                      <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                        <Settings className="h-4 w-4 text-[#39FF14]" /> Global Website &amp; Platform Settings
                      </h3>
                    </div>
                  </div>

                  {!isSuperAdmin && (
                    <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-[11px] text-amber-200">
                      Read-only: Only the Super Admin can modify critical website configuration.
                    </div>
                  )}

                  <form onSubmit={handleSaveSiteSettings} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-semibold text-white mb-1">Hero Tagline Badge</label>
                      <input
                        type="text"
                        value={siteSettings.heroBadgeText}
                        onChange={(e) => setSiteSettings({ ...siteSettings, heroBadgeText: e.target.value })}
                        disabled={!isSuperAdmin}
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#39FF14] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-white mb-1">Application Cycle Label</label>
                      <input
                        type="text"
                        value={siteSettings.applicationCycleLabel}
                        onChange={(e) =>
                          setSiteSettings({ ...siteSettings, applicationCycleLabel: e.target.value })
                        }
                        disabled={!isSuperAdmin}
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#39FF14] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-white mb-1">Homepage Bulletin Banner</label>
                      <textarea
                        value={siteSettings.heroAnnouncement}
                        onChange={(e) =>
                          setSiteSettings({ ...siteSettings, heroAnnouncement: e.target.value })
                        }
                        disabled={!isSuperAdmin}
                        rows={3}
                        placeholder="Optional featured bulletin shown below Hero..."
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#39FF14] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-white mb-1">Official Contact Email</label>
                      <input
                        type="email"
                        value={siteSettings.contactEmail}
                        onChange={(e) => setSiteSettings({ ...siteSettings, contactEmail: e.target.value })}
                        disabled={!isSuperAdmin}
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#39FF14] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-white mb-1">
                        Official ESC WhatsApp Community Invite Link
                      </label>
                      <input
                        type="url"
                        value={siteSettings.whatsappCommunityUrl || ''}
                        onChange={(e) =>
                          setSiteSettings({ ...siteSettings, whatsappCommunityUrl: e.target.value })
                        }
                        placeholder="https://chat.whatsapp.com/..."
                        disabled={!isSuperAdmin}
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#39FF14] focus:outline-none disabled:opacity-50"
                      />
                      <span className="text-[10px] text-zinc-500 block mt-1">
                        Displayed exclusively to approved active ESC members on their Dashboard.
                      </span>
                    </div>
                    <div>
                      <label className="block font-semibold text-white mb-1">
                        Community Guidelines (Shown to Approved Members)
                      </label>
                      <textarea
                        rows={3}
                        value={siteSettings.communityGuidelines || ''}
                        onChange={(e) =>
                          setSiteSettings({ ...siteSettings, communityGuidelines: e.target.value })
                        }
                        placeholder="Respect peers, keep WhatsApp discussions constructive, submit weekly sprint progress..."
                        disabled={!isSuperAdmin}
                        className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#39FF14] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    {/* Configurable UPI Payment Settings (Physical Member Card) */}
                    <div className="rounded-xl border border-[#39FF14]/35 bg-[#0e150f] p-4 space-y-3.5">
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14] block">
                          Physical Member Card Payment Config
                        </span>
                        <h4 className="font-display text-sm font-bold text-white">
                          Configurable Official ESC UPI Payment Details
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          Updating the UPI ID or price here immediately updates the scannable QR code and checkout display across the website.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-white mb-1">Official ESC UPI ID *</label>
                          <input
                            type="text"
                            value={siteSettings.upiId ?? ''}
                            onChange={(e) =>
                              setSiteSettings({ ...siteSettings, upiId: e.target.value })
                            }
                            placeholder="e.g. 9420482152-2@ybl"
                            disabled={!isSuperAdmin}
                            className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 font-mono text-white focus:border-[#39FF14] focus:outline-none disabled:opacity-50"
                          />
                          {siteSettings.upiId &&
                            !/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9]{2,32}$/.test(siteSettings.upiId.trim()) && (
                              <span className="text-[11px] text-amber-300 mt-1 block">
                                Enter a valid UPI ID (e.g. name@ybl or esc@okaxis). Invalid UPI IDs disable checkout.
                              </span>
                            )}
                        </div>
                        <div>
                          <label className="block font-semibold text-white mb-1">
                            Physical Card Price (INR) *
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={50000}
                            value={siteSettings.physicalCardPrice ?? 151}
                            onChange={(e) =>
                              setSiteSettings({
                                ...siteSettings,
                                physicalCardPrice: Number(e.target.value) || 151,
                              })
                            }
                            disabled={!isSuperAdmin}
                            className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 font-mono text-white focus:border-[#39FF14] focus:outline-none disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-white mb-1">UPI Payee Display Name</label>
                        <input
                          type="text"
                          value={siteSettings.upiPayeeName ?? ''}
                          onChange={(e) =>
                            setSiteSettings({ ...siteSettings, upiPayeeName: e.target.value })
                          }
                          placeholder="ESC"
                          disabled={!isSuperAdmin}
                          className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#39FF14] focus:outline-none disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={siteSettings.applicationsOpen}
                        onChange={(e) =>
                          setSiteSettings({ ...siteSettings, applicationsOpen: e.target.checked })
                        }
                        disabled={!isSuperAdmin}
                        className="h-4 w-4 accent-[#39FF14]"
                      />
                      <span className="text-zinc-200 font-medium">Fellowship Applications Open</span>
                    </label>

                    {isSuperAdmin && (
                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="w-full rounded-xl bg-[#39FF14] py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#32e010] cursor-pointer disabled:opacity-50"
                      >
                        {savingSettings ? 'Saving Settings...' : 'Save Global Settings'}
                      </button>
                    )}
                  </form>
                </div>
              </div>
            )}

            {/* TAB: PHYSICAL MEMBER CARD ORDERS */}
            {activeTab === 'card_orders' && (
              <PhysicalCardOrdersAdminSection
                orders={cardOrders}
                setOrders={setCardOrders}
                onRefresh={async () => {
                  const fresh = await apiRequest<MemberCardOrder[]>('/api/admin/card-orders', {
                    requireAuth: true,
                  });
                  if (Array.isArray(fresh)) {
                    setCardOrders(fresh);
                    setCardOrdersLoaded(true);
                  }
                }}
                onNotify={notifyBanner}
              />
            )}

            {/* TAB: ESC PROBLEM EXCHANGE */}
            {activeTab === 'problem_exchange' && (
              <ProblemManagementSection onNotify={notifyBanner} navigate={navigate} />
            )}

            {/* TAB 9: AUDIT LOGS */}
            {activeTab === 'logs' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="font-display text-lg font-bold text-white">Immutable Administrative Audit Trail</h3>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8e919b]" />
                    <input
                      type="text"
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="Filter action, admin, or target..."
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-9 pr-3 py-2 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                </div>
                {filteredLogs.length === 0 ? (
                  <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center text-xs text-zinc-500">
                    No audit log entries match your filter.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#232731] bg-[#111317] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#1f2229] bg-[#161820] text-zinc-400 font-mono text-[11px] uppercase">
                        <tr>
                          <th className="px-5 py-3">Timestamp</th>
                          <th className="px-5 py-3">Admin</th>
                          <th className="px-5 py-3">Action</th>
                          <th className="px-5 py-3">Target</th>
                          <th className="px-5 py-3">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1c1f26]">
                        {filteredLogs.map((log, i) => (
                          <tr key={log.id || i} className="hover:bg-[#14161d]">
                            <td className="px-5 py-3 font-mono text-zinc-500 whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-white font-medium">{log.adminEmail}</td>
                            <td className="px-5 py-3">
                              <span className="rounded bg-[#1c1f26] px-2 py-0.5 font-mono text-[10px] text-[#CCFF00]">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-mono text-[11px] text-zinc-400">
                              {log.targetType}
                            </td>
                            <td className="px-5 py-3 text-zinc-300">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </div>
        </div>

        {/* Application Review Modal follows below */}

        {/* MODAL: Application Review */}
        {selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
            <div className="relative w-full max-w-2xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
                <div>
                  <span className="font-mono text-[10px] text-[#CCFF00] uppercase">
                    Application Review: {selectedApp.id}
                  </span>
                  <h3 className="font-display text-xl font-bold text-white">{selectedApp.fullName}</h3>
                  <p className="text-xs text-zinc-400">{selectedApp.email}</p>
                </div>
                <button onClick={() => setSelectedApp(null)} className="rounded-lg p-1.5 text-[#9ca3af] hover:text-white cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs max-h-[55vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-3 bg-[#14161c] p-3.5 rounded-xl border border-[#232731]">
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-mono">Institution</span>
                    <span className="text-white font-medium">{selectedApp.college}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-mono">Branch & Year</span>
                    <span className="text-white font-medium">{selectedApp.branch} ({selectedApp.academicYear})</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-mono">Location</span>
                    <span className="text-white font-medium">{selectedApp.city}, {selectedApp.state}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-mono">Availability &amp; Goal</span>
                    <span className="text-white font-medium">
                      {selectedApp.weeklyAvailability} • {String(selectedApp.teamGoal || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                  {selectedApp.phone && (
                    <div className="col-span-2">
                      <span className="text-zinc-500 block text-[10px] uppercase font-mono">Phone (Private)</span>
                      <span className="text-white font-medium">{selectedApp.phone}</span>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-white mb-1">Technical Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedApp.technicalSkills?.map((s, i) => (
                      <span key={i} className="rounded bg-[#1a1d24] px-2 py-0.5 text-[#CCFF00] font-mono">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {selectedApp.nonTechnicalSkills && selectedApp.nonTechnicalSkills.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-white mb-1">Non-Technical &amp; Creative Skills</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedApp.nonTechnicalSkills.map((s, i) => (
                        <span key={i} className="rounded bg-sky-950/50 border border-sky-800/40 px-2 py-0.5 text-sky-200 font-mono">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedApp.customSkills && selectedApp.customSkills.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-white mb-1">Custom Added Skills</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedApp.customSkills.map((s, i) => (
                        <span key={i} className="rounded bg-purple-950/50 border border-purple-700/40 px-2 py-0.5 text-purple-200 font-mono">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold text-white mb-1">Why Join ESC?</h4>
                  <p className="text-zinc-300 leading-relaxed bg-[#14161c] p-3 rounded-xl border border-[#232731]">
                    {selectedApp.whyJoin}
                  </p>
                </div>

                {selectedApp.hasExistingIdea && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-[#CCFF00]">Existing Startup Idea</h4>
                      {selectedApp.ideaAiAssisted && (
                        <span className="inline-flex items-center gap-1 rounded bg-purple-950/60 border border-purple-500/40 px-2 py-0.5 font-mono text-[10px] text-purple-200">
                          <Bot className="h-3 w-3" /> AI-Assisted
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-300 leading-relaxed bg-[#14161c] p-3 rounded-xl border border-[#232731]">
                      {selectedApp.existingIdeaSummary}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-white mb-1">
                    Internal Reviewer Notes / Feedback to Applicant
                  </label>
                  <textarea
                    value={appNotes}
                    onChange={(e) => setAppNotes(e.target.value)}
                    placeholder="Provide review notes or information requests..."
                    rows={3}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-[#23262d] pt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">Set Status:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleUpdateAppStatus(selectedApp, 'under_review')}
                    disabled={updatingApp}
                    className="rounded-xl bg-sky-900/50 border border-sky-700 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-800 cursor-pointer"
                  >
                    Under Review
                  </button>
                  <button
                    onClick={() => handleUpdateAppStatus(selectedApp, 'shortlisted')}
                    disabled={updatingApp}
                    className="rounded-xl bg-purple-900/60 border border-purple-700 px-3 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-800 cursor-pointer"
                  >
                    Shortlist
                  </button>
                  <button
                    onClick={() => handleUpdateAppStatus(selectedApp, 'more_info_required')}
                    disabled={updatingApp}
                    className="rounded-xl bg-amber-900/50 border border-amber-700 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-800 cursor-pointer"
                  >
                    Request Info
                  </button>
                  <button
                    onClick={() => handleUpdateAppStatus(selectedApp, 'approved')}
                    disabled={updatingApp}
                    className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
                  >
                    Approve Member
                  </button>
                  <button
                    onClick={() => handleUpdateAppStatus(selectedApp, 'rejected')}
                    disabled={updatingApp}
                    className="rounded-xl bg-red-950/60 border border-red-800 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-900 cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Inspect Idea */}
        {selectedIdea && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
            <div className="relative w-full max-w-2xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5">
              <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-[#CCFF00] uppercase">
                      {selectedIdea.industry} • {selectedIdea.stage}
                    </span>
                    {selectedIdea.aiAssisted && (
                      <span className="inline-flex items-center gap-1 rounded bg-purple-950/60 border border-purple-500/40 px-2 py-0.5 font-mono text-[10px] text-purple-200">
                        <Bot className="h-3 w-3" /> AI-Assisted Submission
                      </span>
                    )}
                    <span className="rounded bg-[#1a1d24] px-2 py-0.5 font-mono text-[10px] text-zinc-300 uppercase">
                      {getIdeaStatusLabel(selectedIdea.reviewStatus)}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">{selectedIdea.title}</h3>
                  <p className="text-xs text-zinc-400">Submitted by {selectedIdea.authorName} ({selectedIdea.authorEmail})</p>
                </div>
                <button onClick={() => setSelectedIdea(null)} className="text-zinc-400 hover:text-white p-1 cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3 text-xs max-h-[50vh] overflow-y-auto pr-2">
                <div>
                  <span className="font-semibold text-white block mb-1">Problem Statement</span>
                  <p className="text-zinc-300 bg-[#14161c] p-3 rounded-xl border border-[#232731]">{selectedIdea.problemStatement}</p>
                </div>
                <div>
                  <span className="font-semibold text-white block mb-1">Proposed Solution</span>
                  <p className="text-zinc-300 bg-[#14161c] p-3 rounded-xl border border-[#232731]">{selectedIdea.proposedSolution}</p>
                </div>
                {Array.isArray(selectedIdea.decisionHistory) && selectedIdea.decisionHistory.length > 0 && (
                  <div className="rounded-xl border border-[#232731] bg-[#14161c] p-3 space-y-1.5">
                    <span className="font-mono text-[10px] uppercase text-[#CCFF00] block">Decision History</span>
                    {selectedIdea.decisionHistory.map((d, idx) => (
                      <div key={idx} className="text-[11px] text-zinc-300 flex flex-wrap items-center justify-between gap-2 border-t border-[#1e222b] pt-1 first:border-t-0 first:pt-0">
                        <span>
                          <strong className="text-white uppercase">{getIdeaStatusLabel(d.status)}</strong> by {d.adminEmail}
                          {d.feedback ? ` — ${d.feedback}` : ''}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          {new Date(d.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <label className="font-semibold text-white block mb-1">Admin Feedback to Founder</label>
                  <textarea
                    value={ideaFeedback}
                    onChange={(e) => setIdeaFeedback(e.target.value)}
                    rows={3}
                    placeholder="Provide technical evaluation, modification requests, or decision rationale..."
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#23262d] pt-4">
                <button
                  onClick={() => handleReviewIdea(selectedIdea, 'cancelled', false)}
                  disabled={updatingIdea}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel Idea
                </button>
                <button
                  onClick={() => handleReviewIdea(selectedIdea, 'rejected', false)}
                  disabled={updatingIdea}
                  className="rounded-xl bg-red-950/60 border border-red-800 px-3.5 py-2 text-xs font-semibold text-red-300 hover:bg-red-900 cursor-pointer"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleReviewIdea(selectedIdea, 'changes_requested', false)}
                  disabled={updatingIdea}
                  className="rounded-xl bg-sky-950/60 border border-sky-700 px-3.5 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-900 cursor-pointer"
                >
                  Request Changes
                </button>
                <button
                  onClick={() => handleReviewIdea(selectedIdea, 'approved', false)}
                  disabled={updatingIdea}
                  className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-xs font-semibold text-white hover:border-[#CCFF00] cursor-pointer"
                >
                  Approve (Private)
                </button>
                <button
                  onClick={() => handleReviewIdea(selectedIdea, 'approved', true)}
                  disabled={updatingIdea}
                  className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer"
                >
                  Approve &amp; Publish
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Create / Edit Project */}
        {projectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
            <div className="relative w-full max-w-lg rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
                <h3 className="font-display text-base font-bold text-white">
                  {editingProject ? 'Edit Project Workspace' : 'Create Project Workspace'}
                </h3>
                <button onClick={() => setProjectModalOpen(false)} className="text-zinc-400 hover:text-white p-1 cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSaveProject} className="space-y-4 pt-4 text-xs">
                <div>
                  <label className="block font-semibold text-white mb-1">Project Title *</label>
                  <input
                    type="text"
                    value={projTitle}
                    onChange={(e) => setProjTitle(e.target.value)}
                    required
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-white mb-1">Category *</label>
                    <input
                      type="text"
                      value={projCategory}
                      onChange={(e) => setProjCategory(e.target.value)}
                      required
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">Status *</label>
                    <select
                      value={projStatus}
                      onChange={(e) => setProjStatus(e.target.value as ProjectStatus)}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                    >
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under Review</option>
                      <option value="approved">Approved</option>
                      <option value="recruiting">Recruiting</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="completed">Completed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Assign Project Lead</label>
                  <select
                    value={projLeaderId}
                    onChange={(e) => setProjLeaderId(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  >
                    <option value={user.uid}>{user.displayName || user.email} (Current)</option>
                    {usersList.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.fullName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Description *</label>
                  <textarea
                    value={projDesc}
                    onChange={(e) => setProjDesc(e.target.value)}
                    required
                    rows={3}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Required Skills (comma-separated)</label>
                  <input
                    type="text"
                    value={projSkills}
                    onChange={(e) => setProjSkills(e.target.value)}
                    placeholder="ROS2, KiCad, Embedded C"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-white mb-1">Repo URL</label>
                    <input
                      type="url"
                      value={projRepoUrl}
                      onChange={(e) => setProjRepoUrl(e.target.value)}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">Demo URL</label>
                    <input
                      type="url"
                      value={projDemoUrl}
                      onChange={(e) => setProjDemoUrl(e.target.value)}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t border-[#23262d]">
                  <button type="button" onClick={() => setProjectModalOpen(false)} className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-400 cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingProject} className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer">
                    {savingProject ? 'Saving...' : 'Save Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Create / Edit Announcement */}
        {annModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
            <div className="relative w-full max-w-lg rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
                <h3 className="font-display text-base font-bold text-white">
                  {editingAnn ? 'Edit Announcement' : 'Publish Website Announcement'}
                </h3>
                <button onClick={() => setAnnModalOpen(false)} className="text-zinc-400 hover:text-white p-1 cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSaveAnnouncement} className="space-y-4 pt-4 text-xs">
                <div>
                  <label className="block font-semibold text-white mb-1">Headline *</label>
                  <input
                    type="text"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    required
                    placeholder="e.g. Winter 2026 Prototyping Grants Open"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Category</label>
                  <select
                    value={annType}
                    onChange={(e) => setAnnType(e.target.value as Announcement['type'])}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  >
                    <option value="highlight">Highlight</option>
                    <option value="event">Event</option>
                    <option value="deadline">Deadline</option>
                    <option value="info">Info</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Message *</label>
                  <textarea
                    value={annMessage}
                    onChange={(e) => setAnnMessage(e.target.value)}
                    required
                    rows={3}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-white mb-1">Target Path</label>
                    <input
                      type="text"
                      value={annLinkPath}
                      onChange={(e) => setAnnLinkPath(e.target.value)}
                      placeholder="/events"
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">CTA Label</label>
                    <input
                      type="text"
                      value={annLinkLabel}
                      onChange={(e) => setAnnLinkLabel(e.target.value)}
                      placeholder="Register Now"
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={annActive} onChange={(e) => setAnnActive(e.target.checked)} className="h-4 w-4 accent-[#CCFF00]" />
                    <span className="text-zinc-200">Active on Homepage</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={annPinned} onChange={(e) => setAnnPinned(e.target.checked)} className="h-4 w-4 accent-[#CCFF00]" />
                    <span className="text-zinc-200">Pin to Top Bar</span>
                  </label>
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t border-[#23262d]">
                  <button type="button" onClick={() => setAnnModalOpen(false)} className="rounded-xl border border-[#2b2f38] px-4 py-2 text-zinc-400 cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingAnn} className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer">
                    {savingAnn ? 'Publishing...' : 'Save Announcement'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* In-App Confirmation Modal */}
        <ConfirmModal
          isOpen={Boolean(confirmState?.isOpen)}
          title={confirmState?.title || ''}
          message={confirmState?.message || ''}
          confirmLabel={confirmState?.confirmLabel || 'Confirm'}
          danger={confirmState?.danger ?? true}
          busy={confirmBusy}
          onCancel={() => setConfirmState(null)}
          onConfirm={async () => {
            if (!confirmState) return;
            try {
              setConfirmBusy(true);
              await confirmState.onConfirm();
              setConfirmState(null);
            } catch (err: any) {
              notifyBanner('error', err?.message || 'Action failed.');
              setConfirmState(null);
            } finally {
              setConfirmBusy(false);
            }
          }}
        />
      </div>
    </div>
  );
};

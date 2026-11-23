import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  type User,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { syncToSqlApi } from '../lib/apiClient';
import { seedInitialDataIfNeeded } from '../lib/seedData';
import { buildUserLoginUpsert, sanitizeUserProfileUpdate } from '../utils/escLogic';
import {
  evaluateMembershipJourneyState,
  type MembershipJourneyEvaluation,
} from '../utils/memberOnboardingLogic';
import type { UserProfile, Application, ServerAuthVerification, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  application: Application | null;
  loading: boolean;
  role: UserRole;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isProjectLead: boolean;
  isApprovedMember: boolean;
  isSuspended: boolean;
  isInactive: boolean;
  membershipJourney: MembershipJourneyEvaluation;
  serverVerified: ServerAuthVerification | null;
  authNotice: string | null;
  dismissNotice: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [serverVerified, setServerVerified] = useState<ServerAuthVerification | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // Clean up any legacy demo session keys
  useEffect(() => {
    try {
      sessionStorage.removeItem('esc_demo_session');
    } catch {
      // ignore storage errors
    }
  }, []);

  // Admin & role status strictly derived from server-verified token claims + Firestore allowlist
  const isSuperAdmin = Boolean(serverVerified?.verified && serverVerified.isSuperAdmin);
  const isAdmin = Boolean(serverVerified?.verified && (serverVerified.isAdmin || serverVerified.isSuperAdmin));
  const resolvedRole: UserRole = serverVerified?.verified
    ? serverVerified.role
    : profile?.role && profile.role !== 'admin' && profile.role !== 'superadmin'
    ? profile.role
    : 'visitor';

  const isProjectLead = Boolean(
    isAdmin ||
      serverVerified?.isProjectLead ||
      resolvedRole === 'project_lead' ||
      resolvedRole === 'lead'
  );

  const effectiveAccountStatus =
    serverVerified?.accountStatus || profile?.accountStatus || 'active';

  const isSuspended = effectiveAccountStatus === 'suspended';
  const isInactive =
    effectiveAccountStatus === 'inactive' || effectiveAccountStatus === 'expired';

  const membershipJourney = evaluateMembershipJourneyState({
    isLoggedIn: Boolean(user),
    isAdmin,
    applicationStatus: application?.status || null,
    membershipStatus:
      serverVerified?.membershipStatus || profile?.membershipStatus || null,
    accountStatus: effectiveAccountStatus,
    escMemberId: serverVerified?.escMemberId || profile?.escMemberId || null,
    role: resolvedRole,
  });

  const isApprovedMember = membershipJourney.canAccessMemberDashboard;

  const verifyRoleWithBackend = async (currentUser: User): Promise<ServerAuthVerification | null> => {
    try {
      const idToken = await currentUser.getIdToken(true);
      const response = await fetch('/api/auth/verify-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as ServerAuthVerification;
      return data.verified ? data : null;
    } catch (err) {
      console.warn('Backend role verification notice:', err);
      return null;
    }
  };

  const fetchBackendUserRecord = async (currentUser: User): Promise<Partial<UserProfile> | null> => {
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/users/me', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (!response.ok) return null;
      const json = (await response.json()) as Partial<UserProfile> & {
        uid?: string;
        user?: Partial<UserProfile>;
      };
      return json.user || (json.uid || json.userId ? json : null);
    } catch {
      return null;
    }
  };

  const loadUserData = async (currentUser: User) => {
    try {
      // 1. Server-side cryptographic Firebase ID Token & allowlist verification
      const verifiedSession = await verifyRoleWithBackend(currentUser);

      const verifiedIsSuperAdmin = Boolean(
        verifiedSession?.verified && verifiedSession.isSuperAdmin && currentUser.emailVerified
      );

      // 2. Sync protected /admins/{uid} allowlist BEFORE triggering downstream Admin queries
      if (verifiedIsSuperAdmin) {
        const adminDocRef = doc(db, 'admins', currentUser.uid);
        await setDoc(
          adminDocRef,
          {
            userId: currentUser.uid,
            email: currentUser.email || '',
            role: 'superadmin',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        ).catch((err) => {
          console.warn('Notice syncing admins allowlist doc:', err);
        });
      }

      setServerVerified(verifiedSession);

      // 3. Individual User Database (/users/{userId}) + PostgreSQL authoritative sync
      const userRef = doc(db, 'users', currentUser.uid);
      const [userSnap, sqlUser] = await Promise.all([
        getDoc(userRef),
        fetchBackendUserRecord(currentUser),
      ]);
      const existingData = userSnap.exists() ? (userSnap.data() as UserProfile) : null;

      const { isNew, payload, mergedProfile } = buildUserLoginUpsert(
        existingData,
        {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          email: currentUser.email,
          photoURL: currentUser.photoURL,
        },
        verifiedIsSuperAdmin
      );

      if (isNew) {
        await setDoc(userRef, payload);
      } else {
        await setDoc(userRef, payload, { merge: true });
      }

      // Hydrate authoritative ESC Member ID, account status, uploaded photo & member card status from Cloud SQL
      const hydratedProfile: UserProfile = {
        ...mergedProfile,
        profilePhotoUrl:
          sqlUser?.profilePhotoUrl ||
          mergedProfile.profilePhotoUrl ||
          '',
        profilePhotoUpdatedAt:
          sqlUser?.profilePhotoUpdatedAt ||
          mergedProfile.profilePhotoUpdatedAt ||
          '',
        memberCardGeneratedAt:
          sqlUser?.memberCardGeneratedAt ||
          mergedProfile.memberCardGeneratedAt ||
          '',
        escMemberId:
          sqlUser?.escMemberId ||
          verifiedSession?.escMemberId ||
          mergedProfile.escMemberId ||
          '',
        accountStatus:
          (sqlUser?.accountStatus as UserProfile['accountStatus']) ||
          verifiedSession?.accountStatus ||
          mergedProfile.accountStatus ||
          'active',
        membershipStatus:
          (sqlUser?.membershipStatus as UserProfile['membershipStatus']) ||
          verifiedSession?.membershipStatus ||
          mergedProfile.membershipStatus,
        approvalDate: sqlUser?.approvalDate || mergedProfile.approvalDate,
        approvedBy: sqlUser?.approvedBy || mergedProfile.approvedBy,
        startupTeamId: sqlUser?.startupTeamId || mergedProfile.startupTeamId,
        teamRole: (sqlUser?.teamRole as UserProfile['teamRole']) || mergedProfile.teamRole,
      };

      setProfile(hydratedProfile);

      if (verifiedSession?.isAdmin || verifiedIsSuperAdmin) {
        await seedInitialDataIfNeeded();
      }

      // 4. Load user's membership application directly from both Cloud SQL (authoritative) and Firestore
      const appsRef = collection(db, 'applications');
      const q = query(appsRef, where('userId', '==', currentUser.uid), limit(1));
      const [appSnap, sqlApp] = await Promise.all([
        getDocs(q).catch(() => null),
        (async () => {
          try {
            const idToken = await currentUser.getIdToken();
            const sqlAppRes = await fetch('/api/applications/me', {
              headers: { Authorization: `Bearer ${idToken}` },
            });
            if (!sqlAppRes.ok) return null;
            const parsed = await sqlAppRes.json();
            return parsed && parsed.id ? parsed : null;
          } catch {
            return null;
          }
        })(),
      ]);

      const fsApp =
        appSnap && !appSnap.empty
          ? ({ id: appSnap.docs[0].id, ...(appSnap.docs[0].data() as Application) } as Application)
          : null;

      if (sqlApp || fsApp) {
        const mergedApp: Application = {
          ...(fsApp || ({} as Application)),
          ...(sqlApp
            ? {
                ...sqlApp,
                userId: sqlApp.userUid || currentUser.uid,
              }
            : {}),
        };

        // Ensure authoritative profile status (approved / rejected) never lags behind
        const authoritativeStatus =
          hydratedProfile.membershipStatus === 'approved' ||
          hydratedProfile.membershipStatus === 'rejected'
            ? hydratedProfile.membershipStatus
            : sqlApp?.status || fsApp?.status || hydratedProfile.membershipStatus;

        setApplication({
          ...mergedApp,
          status: authoritativeStatus,
          adminNotes: sqlApp?.adminNotes || fsApp?.adminNotes || '',
          approvalDate: sqlApp?.approvalDate || hydratedProfile.approvalDate || fsApp?.approvalDate || '',
          approvedBy: sqlApp?.approvedBy || hydratedProfile.approvedBy || fsApp?.approvedBy || '',
        });
      } else {
        setApplication(null);
      }
    } catch (err) {
      console.warn('Notice loading user profile from Firestore:', err);
    }
  };

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      if (err?.message) {
        setAuthNotice(`Google sign-in redirect notice: ${err.message}`);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadUserData(currentUser);
      } else {
        setProfile(null);
        setApplication(null);
        setServerVerified(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setAuthNotice(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/popup-blocked') {
        setAuthNotice(
          'Browser popup was blocked. Allow popups for this site or click "Use Redirect Sign-In" to authenticate with Google.'
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setAuthNotice('Sign-in popup was closed before completion. Click Google Sign In to try again.');
      } else {
        setAuthNotice(`Authentication error: ${error?.message || 'Unable to sign in with Google'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogleRedirect = async () => {
    try {
      setLoading(true);
      setAuthNotice(null);
      await signInWithRedirect(auth, googleProvider);
    } catch (error: any) {
      setAuthNotice(`Redirect sign-in error: ${error?.message || 'Unable to redirect to Google Auth'}`);
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await fbSignOut(auth);
      setUser(null);
      setProfile(null);
      setApplication(null);
      setServerVerified(null);
      setAuthNotice(null);
    } catch {
      setUser(null);
      setProfile(null);
      setApplication(null);
      setServerVerified(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserData(user);
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const safeData = sanitizeUserProfileUpdate(data);
      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          ...safeData,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      await syncToSqlApi('/api/users/me', 'PUT', safeData);
      await refreshProfile();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const dismissNotice = () => setAuthNotice(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        application,
        loading,
        role: resolvedRole,
        isSuperAdmin,
        isAdmin,
        isProjectLead,
        isApprovedMember,
        isSuspended,
        isInactive,
        membershipJourney,
        serverVerified,
        authNotice,
        dismissNotice,
        signInWithGoogle,
        signInWithGoogleRedirect,
        signOut,
        refreshProfile,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

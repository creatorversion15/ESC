import { desc, eq, isNotNull, or } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';
import { formatEscMemberId } from '../utils/escLogic.ts';

export async function getOrCreateUser(params: {
  uid: string;
  email: string;
  fullName?: string;
  photoUrl?: string;
  isSuperAdmin?: boolean;
}) {
  try {
    const now = new Date();
    const fallbackName = params.fullName?.trim() || 'Engineering Student';
    const initialRole = params.isSuperAdmin ? 'superadmin' : 'student';
    const initialStatus = params.isSuperAdmin ? 'approved' : 'unregistered';

    const existing = await db.select().from(users).where(eq(users.uid, params.uid)).limit(1);
    let assignedMemberId = existing[0]?.escMemberId || null;

    if (params.isSuperAdmin && !assignedMemberId) {
      const existingIdsRows = await db
        .select({ escMemberId: users.escMemberId })
        .from(users)
        .where(isNotNull(users.escMemberId));
      const existingSet = new Set(
        existingIdsRows.map((r) => r.escMemberId).filter((id): id is string => Boolean(id))
      );
      assignedMemberId = formatEscMemberId(new Date().getFullYear(), existingSet, existingSet.size + 1);
    }

    const updateSet: {
      email: string;
      lastLoginAt: Date;
      lastActiveAt: Date;
      updatedAt: Date;
      photoUrl?: string;
      role?: string;
      membershipStatus?: string;
      accountStatus?: string;
      escMemberId?: string;
    } = {
      email: params.email,
      lastLoginAt: now,
      lastActiveAt: now,
      updatedAt: now,
    };

    if (params.photoUrl) {
      updateSet.photoUrl = params.photoUrl;
    }
    if (params.isSuperAdmin) {
      updateSet.role = 'superadmin';
      updateSet.membershipStatus = 'approved';
      updateSet.accountStatus = 'active';
      if (assignedMemberId) {
        updateSet.escMemberId = assignedMemberId;
      }
    }

    const result = await db
      .insert(users)
      .values({
        uid: params.uid,
        email: params.email,
        fullName: fallbackName,
        photoUrl: params.photoUrl || '',
        role: initialRole,
        membershipStatus: initialStatus,
        escMemberId: assignedMemberId,
        accountStatus: 'active',
        lastActiveAt: now,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: updateSet,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile. Please try again later.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to fetch user profile. Please try again later.', { cause: error });
  }
}

export async function listUsers() {
  try {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  } catch (error) {
    console.error('Database query failed in listUsers:', error);
    throw new Error('Failed to fetch users. Please try again later.', { cause: error });
  }
}

export async function listApprovedMemberDirectory() {
  try {
    const rows = await db
      .select({
        uid: users.uid,
        fullName: users.fullName,
        photoUrl: users.photoUrl,
        college: users.college,
        branch: users.branch,
        academicYear: users.academicYear,
        technicalSkills: users.technicalSkills,
        role: users.role,
        membershipStatus: users.membershipStatus,
        escMemberId: users.escMemberId,
        accountStatus: users.accountStatus,
        startupTeamId: users.startupTeamId,
        teamRole: users.teamRole,
      })
      .from(users)
      .where(or(eq(users.membershipStatus, 'approved'), isNotNull(users.escMemberId)));

    return rows.filter((r) => r.accountStatus !== 'suspended');
  } catch (error) {
    console.error('Database query failed in listApprovedMemberDirectory:', error);
    throw new Error('Failed to fetch approved member directory.', { cause: error });
  }
}

export async function getUserByEscMemberId(memberId: string) {
  try {
    const clean = memberId.trim().toUpperCase();
    if (!clean) return null;
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.escMemberId, clean))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByEscMemberId:', error);
    throw new Error('Failed to verify member ID. Please try again later.', { cause: error });
  }
}

export async function markMemberCardGenerated(uid: string) {
  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const rows = await db
      .update(users)
      .set({
        memberCardGeneratedAt: nowIso,
        lastActiveAt: now,
        updatedAt: now,
      })
      .where(eq(users.uid, uid))
      .returning();
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in markMemberCardGenerated:', error);
    throw new Error('Failed to record member card generation.', { cause: error });
  }
}

export async function updateUserProfileByUid(
  uid: string,
  patch: {
    fullName?: string;
    phone?: string;
    college?: string;
    city?: string;
    state?: string;
    branch?: string;
    academicYear?: string;
    technicalSkills?: string[];
    nonTechnicalSkills?: string[];
    customSkills?: string[];
    interests?: string[];
    portfolioUrl?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    bio?: string;
    weeklyAvailability?: string;
    profilePhotoUrl?: string;
    profilePhotoUpdatedAt?: string;
  }
) {
  try {
    const now = new Date();
    const cleanPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    );
    const result = await db
      .update(users)
      .set({
        ...cleanPatch,
        lastActiveAt: now,
        updatedAt: now,
      })
      .where(eq(users.uid, uid))
      .returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in updateUserProfileByUid:', error);
    throw new Error('Failed to update user profile. Please try again later.', { cause: error });
  }
}

export async function updateUserRoleByUid(uid: string, role: string, membershipStatus?: string) {
  try {
    const updateValues: { role: string; updatedAt: Date; membershipStatus?: string } = {
      role,
      updatedAt: new Date(),
    };
    if (membershipStatus) {
      updateValues.membershipStatus = membershipStatus;
    }
    const result = await db
      .update(users)
      .set(updateValues)
      .where(eq(users.uid, uid))
      .returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in updateUserRoleByUid:', error);
    throw new Error('Failed to update user role. Please try again later.', { cause: error });
  }
}

export async function adminUpdateMemberByUid(
  uid: string,
  patch: {
    fullName?: string;
    college?: string;
    branch?: string;
    academicYear?: string;
    technicalSkills?: string[];
    accountStatus?: 'active' | 'inactive' | 'suspended' | 'expired';
    role?: string;
    membershipStatus?: string;
    escMemberId?: string;
    approvalDate?: string;
    approvedBy?: string;
  }
) {
  try {
    const result = await db
      .update(users)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(users.uid, uid))
      .returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in adminUpdateMemberByUid:', error);
    throw new Error('Failed to update member details.', { cause: error });
  }
}


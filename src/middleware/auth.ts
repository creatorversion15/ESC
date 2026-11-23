import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser, getUserByUid } from '../db/users.ts';

export const SUPER_ADMIN_EMAIL = 'soviraj50@gmail.com';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  idToken?: string;
  escRole?: string;
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
}

function isConfiguredSuperAdminToken(decoded: DecodedIdToken): boolean {
  const email = (decoded.email || '').toLowerCase();
  const emailVerified = Boolean(decoded.email_verified);
  const signInProvider = decoded.firebase?.sign_in_provider || '';
  return (
    emailVerified &&
    email === SUPER_ADMIN_EMAIL.toLowerCase() &&
    (signInProvider === 'google.com' || signInProvider === '')
  );
}

async function resolveAndSyncUser(decoded: DecodedIdToken) {
  const isSuper = isConfiguredSuperAdminToken(decoded);
  const existing = await getUserByUid(decoded.uid).catch(() => null);
  const synced = await getOrCreateUser({
    uid: decoded.uid,
    email: decoded.email || '',
    fullName: typeof decoded.name === 'string' ? decoded.name : existing?.fullName || 'Engineering Student',
    photoUrl: typeof decoded.picture === 'string' ? decoded.picture : existing?.photoUrl || '',
    isSuperAdmin: isSuper,
  }).catch(() => null);

  const effectiveRole = isSuper
    ? 'superadmin'
    : synced?.role || existing?.role || 'student';

  return {
    role: effectiveRole,
    isSuperAdmin: isSuper || effectiveRole === 'superadmin',
    isAdmin: isSuper || effectiveRole === 'superadmin' || effectiveRole === 'admin',
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing token' });
    return;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Empty token' });
    return;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    req.idToken = token;

    const resolved = await resolveAndSyncUser(decodedToken);
    req.escRole = resolved.role;
    req.isSuperAdmin = resolved.isSuperAdmin;
    req.isAdmin = resolved.isAdmin;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    next();
    return;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    req.idToken = token;
    const resolved = await resolveAndSyncUser(decodedToken);
    req.escRole = resolved.role;
    req.isSuperAdmin = resolved.isSuperAdmin;
    req.isAdmin = resolved.isAdmin;
  } catch {
    // Public routes continue unauthenticated if token is invalid/expired
  }
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.isAdmin) {
    res.status(403).json({ error: 'Forbidden: Administrator privileges required' });
    return;
  }
  next();
};

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.isSuperAdmin) {
    res.status(403).json({ error: 'Forbidden: Super Admin privileges required' });
    return;
  }
  next();
};

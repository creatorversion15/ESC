import crypto from 'node:crypto';
import { desc, eq, or } from 'drizzle-orm';
import { db } from './index.ts';
import { supportTickets } from './schema.ts';
import type {
  SupportCategory,
  SupportStatusHistoryEntry,
  SupportTicket,
  SupportTicketStatus,
} from '../types/index.ts';
import { generateSupportTicketId, isValidSupportStatus } from '../utils/supportLogic.ts';

function wrapDbError(context: string, error: unknown): never {
  console.error(`Database query failed [${context}]:`, error);
  throw new Error('Database operation failed. Please try again later.', { cause: error });
}

function serializeTicket(row: typeof supportTickets.$inferSelect): SupportTicket {
  const history = Array.isArray(row.statusHistory)
    ? row.statusHistory.map((item) => ({
        status: isValidSupportStatus(item.status) ? item.status : 'new',
        changedBy: String(item.changedBy || 'System'),
        note: item.note ? String(item.note) : undefined,
        timestamp: String(item.timestamp || new Date().toISOString()),
      }))
    : [];

  return {
    id: row.id,
    ticketId: row.ticketId,
    userUid: row.userUid || undefined,
    fullName: row.fullName,
    email: row.email,
    category: row.category as SupportCategory,
    subject: row.subject,
    description: row.description,
    attachmentName: row.attachmentName || undefined,
    attachmentType: row.attachmentType || undefined,
    attachmentDataUrl: row.attachmentDataUrl || undefined,
    status: isValidSupportStatus(row.status) ? row.status : 'new',
    adminNotes: row.adminNotes || undefined,
    statusHistory: history,
    createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString(),
  };
}

export async function createSupportTicket(input: {
  idempotencyKey?: string;
  userUid?: string;
  fullName: string;
  email: string;
  category: SupportCategory;
  subject: string;
  description: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentDataUrl?: string;
}): Promise<{ ticket: SupportTicket; deduplicated: boolean }> {
  try {
    const cleanKey = input.idempotencyKey?.trim() || null;

    if (cleanKey) {
      const existing = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.idempotencyKey, cleanKey))
        .limit(1);

      if (existing[0]) {
        return { ticket: serializeTicket(existing[0]), deduplicated: true };
      }
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const randomSuffix = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
    const ticketId = generateSupportTicketId(now, randomSuffix);
    const id = `sup_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const initialHistory: SupportStatusHistoryEntry[] = [
      {
        status: 'new',
        changedBy: input.fullName.trim(),
        note: 'Support request submitted',
        timestamp: nowIso,
      },
    ];

    const inserted = await db
      .insert(supportTickets)
      .values({
        id,
        ticketId,
        idempotencyKey: cleanKey,
        userUid: input.userUid || '',
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        category: input.category,
        subject: input.subject.trim(),
        description: input.description.trim(),
        attachmentName: input.attachmentName?.trim().slice(0, 180) || '',
        attachmentType: input.attachmentType?.trim().slice(0, 80) || '',
        attachmentDataUrl: input.attachmentDataUrl?.trim() || '',
        status: 'new',
        adminNotes: '',
        statusHistory: initialHistory,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return { ticket: serializeTicket(inserted[0]), deduplicated: false };
  } catch (error: any) {
    // Handle race condition on idempotency_key unique constraint gracefully
    const cleanKey = input.idempotencyKey?.trim();
    if (cleanKey && error?.code === '23505') {
      const existing = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.idempotencyKey, cleanKey))
        .limit(1);
      if (existing[0]) {
        return { ticket: serializeTicket(existing[0]), deduplicated: true };
      }
    }
    wrapDbError('createSupportTicket', error);
  }
}

export async function listUserSupportTickets(userUid: string, userEmail?: string): Promise<SupportTicket[]> {
  try {
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const condition = cleanEmail
      ? or(eq(supportTickets.userUid, userUid), eq(supportTickets.email, cleanEmail))
      : eq(supportTickets.userUid, userUid);

    const rows = await db
      .select()
      .from(supportTickets)
      .where(condition)
      .orderBy(desc(supportTickets.createdAt));

    return rows.map(serializeTicket);
  } catch (error) {
    wrapDbError('listUserSupportTickets', error);
  }
}

export async function listAllSupportTicketsForAdmin(): Promise<SupportTicket[]> {
  try {
    const rows = await db
      .select()
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt));
    return rows.map(serializeTicket);
  } catch (error) {
    wrapDbError('listAllSupportTicketsForAdmin', error);
  }
}

export async function updateSupportTicketStatus(input: {
  id: string;
  status: SupportTicketStatus;
  adminNotes?: string;
  adminEmail: string;
}): Promise<SupportTicket | null> {
  try {
    const existingRows = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, input.id))
      .limit(1);

    const existing = existingRows[0];
    if (!existing) return null;

    const now = new Date();
    const prevHistory = Array.isArray(existing.statusHistory) ? existing.statusHistory : [];
    const nextNote = typeof input.adminNotes === 'string' ? input.adminNotes.trim() : existing.adminNotes || '';
    const nextHistory = [
      ...prevHistory,
      {
        status: input.status,
        changedBy: input.adminEmail,
        note: nextNote || undefined,
        timestamp: now.toISOString(),
      },
    ];

    const updated = await db
      .update(supportTickets)
      .set({
        status: input.status,
        adminNotes: nextNote,
        statusHistory: nextHistory,
        updatedAt: now,
      })
      .where(eq(supportTickets.id, input.id))
      .returning();

    return updated[0] ? serializeTicket(updated[0]) : null;
  } catch (error) {
    wrapDbError('updateSupportTicketStatus', error);
  }
}

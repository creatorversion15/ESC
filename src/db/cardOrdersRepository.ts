import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { memberCardOrders } from './schema.ts';
import {
  createNotificationSafe,
  recordActivityLog,
} from './teamsAndTasksRepository.ts';
import { createAdminAuditLog } from './escRepository.ts';
import type {
  CardOrderPaymentStatus,
  CardOrderStatus,
  CardOrderStatusHistoryEntry,
  MemberCardOrder,
} from '../types/index.ts';
import {
  generateNextCardOrderId,
  getCardOrderStatusLabel,
  getPaymentStatusLabel,
} from '../utils/physicalCardOrderLogic.ts';

function mapOrderRow(row: typeof memberCardOrders.$inferSelect): MemberCardOrder {
  return {
    id: row.id,
    orderId: row.orderId,
    userUid: row.userUid,
    escMemberId: row.escMemberId,
    fullName: row.fullName,
    email: row.email,
    mobileNumber: row.mobileNumber,
    college: row.college,
    branch: row.branch,
    academicYear: row.academicYear,
    profilePhotoUrl: row.profilePhotoUrl,
    addressLine1: row.addressLine1,
    streetArea: row.streetArea,
    cityVillage: row.cityVillage,
    district: row.district,
    state: row.state,
    pinCode: row.pinCode,
    amountInr: row.amountInr,
    upiIdUsed: row.upiIdUsed,
    transactionId: row.transactionId,
    paymentScreenshotUrl: row.paymentScreenshotUrl,
    paymentConfirmedByMember: row.paymentConfirmedByMember,
    paymentStatus: (row.paymentStatus || 'pending_verification') as CardOrderPaymentStatus,
    orderStatus: (row.orderStatus || 'order_received') as CardOrderStatus,
    courierCompany: row.courierCompany || '',
    trackingNumber: row.trackingNumber || '',
    dispatchDate: row.dispatchDate || '',
    deliveredDate: row.deliveredDate || '',
    adminNotes: row.adminNotes || '',
    verifiedBy: row.verifiedBy || '',
    verifiedAt: row.verifiedAt || '',
    statusHistory: Array.isArray(row.statusHistory)
      ? (row.statusHistory as CardOrderStatusHistoryEntry[])
      : [],
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

export async function createMemberCardOrderSql(input: {
  userUid: string;
  escMemberId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  college: string;
  branch: string;
  academicYear: string;
  profilePhotoUrl: string;
  addressLine1: string;
  streetArea: string;
  cityVillage: string;
  district: string;
  state: string;
  pinCode: string;
  amountInr: number;
  upiIdUsed: string;
  transactionId: string;
  paymentScreenshotUrl: string;
  paymentConfirmedByMember: boolean;
}): Promise<MemberCardOrder> {
  const existing = await db
    .select({ orderId: memberCardOrders.orderId })
    .from(memberCardOrders);

  const orderId = generateNextCardOrderId(existing.map((e) => e.orderId));
  const id = `cardord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const nowIso = now.toISOString();

  const initialHistory: CardOrderStatusHistoryEntry[] = [
    {
      orderStatus: 'order_received',
      paymentStatus: 'pending_verification',
      changedBy: input.email || input.fullName,
      note: `Order submitted with UPI Transaction ID ${input.transactionId}. Awaiting ESC Admin payment verification.`,
      timestamp: nowIso,
    },
  ];

  // Never auto-verify payment: always starts as pending_verification + order_received
  const rows = await db
    .insert(memberCardOrders)
    .values({
      id,
      orderId,
      userUid: input.userUid,
      escMemberId: input.escMemberId,
      fullName: input.fullName,
      email: input.email,
      mobileNumber: input.mobileNumber,
      college: input.college,
      branch: input.branch,
      academicYear: input.academicYear,
      profilePhotoUrl: input.profilePhotoUrl,
      addressLine1: input.addressLine1,
      streetArea: input.streetArea,
      cityVillage: input.cityVillage,
      district: input.district,
      state: input.state,
      pinCode: input.pinCode,
      amountInr: input.amountInr,
      upiIdUsed: input.upiIdUsed,
      transactionId: input.transactionId,
      paymentScreenshotUrl: input.paymentScreenshotUrl,
      paymentConfirmedByMember: input.paymentConfirmedByMember,
      paymentStatus: 'pending_verification',
      orderStatus: 'order_received',
      statusHistory: initialHistory,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const created = mapOrderRow(rows[0]);

  await Promise.all([
    createNotificationSafe({
      recipientType: 'user',
      recipientUid: input.userUid,
      title: `Physical Member Card Order Received · ${orderId}`,
      description: `Your order for an official ESC Physical Member Card (₹${input.amountInr}) has been received. Payment status: Pending Verification.`,
      senderName: 'ESC Card Desk',
      type: 'card_order_update',
      relatedMemberUid: input.userUid,
      linkTab: 'card_orders',
    }).catch(() => {}),
    createNotificationSafe({
      recipientType: 'admin',
      title: `New Physical Member Card Order · ${orderId}`,
      description: `${input.fullName} (${input.escMemberId}) submitted a ₹${input.amountInr} card order with UTR ${input.transactionId}. Manual payment verification required.`,
      senderName: input.fullName,
      type: 'card_order_update',
      relatedMemberUid: input.userUid,
      linkTab: 'card_orders',
    }).catch(() => {}),
    recordActivityLog({
      actorUid: input.userUid,
      actorName: input.fullName,
      memberUid: input.userUid,
      activityType: 'physical_card_ordered',
      title: `Ordered Physical ESC Member Card (${orderId})`,
      details: `${input.fullName} (${input.escMemberId}) placed a pan-India delivery order for ₹${input.amountInr}.`,
      status: 'order_received',
    }).catch(() => {}),
  ]);

  return created;
}

export async function listMemberCardOrdersByUserSql(userUid: string): Promise<MemberCardOrder[]> {
  const rows = await db
    .select()
    .from(memberCardOrders)
    .where(eq(memberCardOrders.userUid, userUid))
    .orderBy(desc(memberCardOrders.createdAt));
  return rows.map(mapOrderRow);
}

export async function listAllMemberCardOrdersSql(): Promise<MemberCardOrder[]> {
  const rows = await db
    .select()
    .from(memberCardOrders)
    .orderBy(desc(memberCardOrders.createdAt));
  return rows.map(mapOrderRow);
}

export async function getMemberCardOrderByIdSql(id: string): Promise<MemberCardOrder | null> {
  const rows = await db
    .select()
    .from(memberCardOrders)
    .where(eq(memberCardOrders.id, id))
    .limit(1);
  return rows[0] ? mapOrderRow(rows[0]) : null;
}

export async function updateMemberCardOrderAdminSql(params: {
  id: string;
  adminUid: string;
  adminEmail: string;
  paymentStatus?: CardOrderPaymentStatus;
  orderStatus?: CardOrderStatus;
  courierCompany?: string;
  trackingNumber?: string;
  dispatchDate?: string;
  deliveredDate?: string;
  adminNotes?: string;
}): Promise<MemberCardOrder | null> {
  const existing = await getMemberCardOrderByIdSql(params.id);
  if (!existing) return null;

  const now = new Date();
  const nowIso = now.toISOString();

  const nextPaymentStatus: CardOrderPaymentStatus =
    params.paymentStatus || existing.paymentStatus;
  const nextOrderStatus: CardOrderStatus =
    params.orderStatus || existing.orderStatus;

  const nextCourier =
    params.courierCompany !== undefined ? params.courierCompany.trim() : existing.courierCompany || '';
  const nextTracking =
    params.trackingNumber !== undefined ? params.trackingNumber.trim() : existing.trackingNumber || '';
  const nextDispatchDate =
    params.dispatchDate !== undefined ? params.dispatchDate.trim() : existing.dispatchDate || '';
  const nextDeliveredDate =
    params.deliveredDate !== undefined ? params.deliveredDate.trim() : existing.deliveredDate || '';
  const nextAdminNotes =
    params.adminNotes !== undefined ? params.adminNotes.trim() : existing.adminNotes || '';

  const isNewlyVerified =
    nextPaymentStatus === 'verified' && existing.paymentStatus !== 'verified';

  const historyEntry: CardOrderStatusHistoryEntry = {
    orderStatus: nextOrderStatus,
    paymentStatus: nextPaymentStatus,
    changedBy: params.adminEmail || params.adminUid,
    note: nextAdminNotes || undefined,
    timestamp: nowIso,
  };

  const nextHistory = [...(existing.statusHistory || []), historyEntry];

  const rows = await db
    .update(memberCardOrders)
    .set({
      paymentStatus: nextPaymentStatus,
      orderStatus: nextOrderStatus,
      courierCompany: nextCourier,
      trackingNumber: nextTracking,
      dispatchDate: nextDispatchDate,
      deliveredDate: nextDeliveredDate,
      adminNotes: nextAdminNotes,
      verifiedBy: isNewlyVerified ? params.adminEmail || params.adminUid : existing.verifiedBy || '',
      verifiedAt: isNewlyVerified ? nowIso : existing.verifiedAt || '',
      statusHistory: nextHistory,
      updatedAt: now,
    })
    .where(eq(memberCardOrders.id, params.id))
    .returning();

  const updated = mapOrderRow(rows[0]);

  const statusLabel = getCardOrderStatusLabel(updated.orderStatus);
  const paymentLabel = getPaymentStatusLabel(updated.paymentStatus);

  const trackingInfo =
    updated.courierCompany || updated.trackingNumber
      ? ` Courier: ${updated.courierCompany || 'Assigned'}${updated.trackingNumber ? ` · Tracking #: ${updated.trackingNumber}` : ''}.`
      : '';

  await Promise.all([
    createNotificationSafe({
      recipientType: 'user',
      recipientUid: updated.userUid,
      title: `Card Order ${updated.orderId} · ${statusLabel}`,
      description: `Order status updated to "${statusLabel}" (Payment: ${paymentLabel}).${trackingInfo}${updated.adminNotes ? ` Note: ${updated.adminNotes}` : ''}`,
      senderName: 'ESC Card Desk',
      type: 'card_order_update',
      relatedMemberUid: updated.userUid,
      linkTab: 'card_orders',
    }).catch(() => {}),
    createAdminAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      action: 'CARD_ORDER_UPDATED',
      targetType: 'MemberCardOrder',
      targetId: updated.orderId,
      details: `Updated ${updated.orderId} (${updated.fullName}) → Order: ${statusLabel}, Payment: ${paymentLabel}${trackingInfo}`,
    }).catch(() => {}),
    recordActivityLog({
      actorUid: params.adminUid,
      actorName: params.adminEmail || 'ESC Admin',
      memberUid: updated.userUid,
      activityType: 'card_order_status_updated',
      title: `Card Order ${updated.orderId}: ${statusLabel}`,
      details: `Payment: ${paymentLabel}${trackingInfo}`,
      status: updated.orderStatus,
    }).catch(() => {}),
  ]);

  return updated;
}

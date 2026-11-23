import type {
  AccountStatus,
  CardOrderPaymentStatus,
  CardOrderStatus,
  MemberCardOrder,
  MembershipStatus,
} from '../types/index.ts';

export const PHYSICAL_CARD_PRICE_INR = 151;
export const DEFAULT_ESC_UPI_ID = '9420482152-2@ybl';
export const DEFAULT_ESC_UPI_PAYEE = 'ESC';
export const DEFAULT_ESC_UPI_NOTE = 'ESC Physical Member Card Order';

export const CARD_ORDER_STATUS_LIST: {
  value: CardOrderStatus;
  label: string;
  stepIndex: number;
  description: string;
}[] = [
  {
    value: 'order_received',
    label: 'Order Received',
    stepIndex: 1,
    description: 'Order submitted with delivery address and UPI transaction details.',
  },
  {
    value: 'payment_verification_pending',
    label: 'Payment Verification Pending',
    stepIndex: 2,
    description: 'ESC Admin is reviewing your UPI Transaction ID and payment proof.',
  },
  {
    value: 'payment_verified',
    label: 'Payment Verified',
    stepIndex: 3,
    description: 'Payment of ₹151 has been verified by ESC Administration.',
  },
  {
    value: 'card_processing',
    label: 'Card Processing',
    stepIndex: 4,
    description: 'Your official ESC Physical Member Card artwork is being prepared for print.',
  },
  {
    value: 'card_printed',
    label: 'Card Printed',
    stepIndex: 5,
    description: 'Your physical PVC card has been printed and quality checked.',
  },
  {
    value: 'dispatched',
    label: 'Dispatched',
    stepIndex: 6,
    description: 'Card handed over to the courier partner for pan-India delivery.',
  },
  {
    value: 'out_for_delivery',
    label: 'Out for Delivery',
    stepIndex: 7,
    description: 'Your ESC Physical Member Card is out for delivery to your address.',
  },
  {
    value: 'delivered',
    label: 'Delivered',
    stepIndex: 8,
    description: 'Your official ESC Physical Member Card has been delivered.',
  },
  {
    value: 'rejected',
    label: 'Rejected / Payment Issue',
    stepIndex: -1,
    description: 'Order could not be processed due to a payment verification or eligibility issue.',
  },
];

export const VALID_CARD_ORDER_STATUSES = new Set<CardOrderStatus>(
  CARD_ORDER_STATUS_LIST.map((s) => s.value)
);

export const VALID_PAYMENT_STATUSES = new Set<CardOrderPaymentStatus>([
  'pending_verification',
  'verified',
  'rejected',
]);

export function getCardOrderStatusLabel(status?: string | null): string {
  const found = CARD_ORDER_STATUS_LIST.find((s) => s.value === status);
  return found ? found.label : 'Order Received';
}

export function getCardOrderStatusStep(status?: string | null): number {
  const found = CARD_ORDER_STATUS_LIST.find((s) => s.value === status);
  return found ? found.stepIndex : 1;
}

export function getPaymentStatusLabel(status?: string | null): string {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'rejected':
      return 'Rejected / Issue';
    default:
      return 'Pending Verification';
  }
}

/**
 * Validates an NPCI Virtual Payment Address (UPI ID), e.g. "9420482152-2@ybl" or "esc@okaxis".
 * Rejects whitespace, missing handle/PSP suffix, multiple '@', or incomplete values.
 */
export function isValidUpiId(value?: string | null): boolean {
  const clean = (value || '').trim();
  if (!clean || clean.length < 5 || clean.length > 99) return false;
  return /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9]{2,32}$/.test(clean);
}

/**
 * Strictly validates the configured ESC UPI ID without inventing or substituting
 * an unconfigured ID when Admin Settings is missing or invalid.
 */
export function validateConfiguredUpiId(configured?: string | null): {
  valid: boolean;
  upiId: string;
  error?: string;
} {
  const clean = (configured || '').trim();
  if (!clean) {
    return {
      valid: false,
      upiId: '',
      error:
        'Official ESC UPI ID is not configured in Admin Settings. Online UPI payment is temporarily unavailable until an administrator configures a valid UPI ID.',
    };
  }
  if (!isValidUpiId(clean)) {
    return {
      valid: false,
      upiId: '',
      error:
        'The configured ESC UPI ID is invalid. Please contact ESC Administration to update the official UPI ID in Admin Settings.',
    };
  }
  return { valid: true, upiId: clean };
}

export function resolveConfiguredUpiId(configured?: string | null): string {
  const check = validateConfiguredUpiId(configured);
  return check.valid ? check.upiId : '';
}

export function resolveConfiguredCardPrice(configured?: number | null): number {
  if (typeof configured === 'number' && Number.isFinite(configured) && configured >= 1 && configured <= 50000) {
    return Math.round(configured);
  }
  return PHYSICAL_CARD_PRICE_INR;
}

/**
 * Generates a unique, NPCI-safe alphanumeric transaction reference (`tr`) for a card order session.
 */
export function generateUpiOrderReference(memberId?: string | null, now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const memberSuffix = (memberId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-4)
    .toUpperCase();
  const timePart = now.getTime().toString(36).toUpperCase().slice(-5);
  const randPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ESCCARD${yyyy}${mm}${dd}${memberSuffix}${timePart}${randPart}`.slice(0, 32);
}

function normalizeUpiPayeeName(payeeName?: string | null): string {
  const raw = (payeeName || '').trim();
  if (!raw || raw.toLowerCase() === 'engineering startup company (esc)') {
    return DEFAULT_ESC_UPI_PAYEE;
  }
  const cleaned = raw
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || DEFAULT_ESC_UPI_PAYEE).slice(0, 30);
}

/**
 * Generates a strict NPCI UPI Linking Specification deep-link URI for both direct
 * "PAY NOW" intent launching and genuine scannable UPI QR codes.
 *
 * CRITICAL:
 * - Preserves literal `@` in `pa` (never percent-encoded as `%40`), which PhonePe,
 *   Paytm, BHIM, and bank UPI scanners expect.
 * - Uses RFC 3986 `%20` encoding for spaces (never `+` from URLSearchParams).
 * - Returns `null` when UPI ID is missing or invalid so callers never render a broken QR.
 */
export function buildUpiPaymentUri(params: {
  upiId: string;
  payeeName?: string;
  amountInr?: number;
  note?: string;
  orderRef?: string;
}): string | null {
  const check = validateConfiguredUpiId(params.upiId);
  if (!check.valid) return null;

  const pa = check.upiId;
  const pn = normalizeUpiPayeeName(params.payeeName);
  const am = resolveConfiguredCardPrice(params.amountInr).toFixed(2);
  const rawNote = (params.note || DEFAULT_ESC_UPI_NOTE)
    .replace(/[^a-zA-Z0-9 ._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tn = (rawNote || DEFAULT_ESC_UPI_NOTE).slice(0, 50);
  const tr = (params.orderRef || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 35);

  const queryParts = [
    `pa=${pa}`,
    `pn=${encodeURIComponent(pn)}`,
    `am=${am}`,
    `cu=INR`,
    `tn=${encodeURIComponent(tn)}`,
  ];

  if (tr) {
    queryParts.push(`tr=${encodeURIComponent(tr)}`);
  }

  return `upi://pay?${queryParts.join('&')}`;
}

/**
 * Builds an Android Chrome Intent fallback URL for mobile browsers that restrict
 * raw `upi://` links inside embedded webviews.
 */
export function buildAndroidUpiIntentUri(upiUri: string | null): string | null {
  if (!upiUri || !upiUri.startsWith('upi://')) return null;
  return `intent://${upiUri.slice('upi://'.length)}#Intent;scheme=upi;end`;
}

export type PhysicalCardEligibilityCode =
  | 'not_logged_in'
  | 'pending_approval'
  | 'rejected'
  | 'inactive_or_suspended'
  | 'missing_member_id'
  | 'eligible';

export interface PhysicalCardEligibilityResult {
  eligible: boolean;
  reasonCode: PhysicalCardEligibilityCode;
  message: string;
}

/**
 * Only logged-in members whose ESC membership is APPROVED and ACTIVE with an official
 * ESC Member ID can place an order for a Physical Member Card.
 * (Profile photo can be uploaded or updated directly inside the order form before submission.)
 */
export function evaluatePhysicalCardOrderEligibility(input: {
  isLoggedIn: boolean;
  membershipStatus?: MembershipStatus | null;
  accountStatus?: AccountStatus | null;
  escMemberId?: string | null;
}): PhysicalCardEligibilityResult {
  if (!input.isLoggedIn) {
    return {
      eligible: false,
      reasonCode: 'not_logged_in',
      message: 'Please sign in with your verified Google account to order your physical ESC Member Card.',
    };
  }
  if (input.membershipStatus === 'rejected') {
    return {
      eligible: false,
      reasonCode: 'rejected',
      message:
        'Only approved and active ESC members are eligible to order an official physical ESC Member Card.',
    };
  }
  if (input.membershipStatus !== 'approved') {
    return {
      eligible: false,
      reasonCode: 'pending_approval',
      message:
        'Your ESC membership is awaiting admin approval. Physical member card ordering unlocks once your membership is approved and active.',
    };
  }

  const acct = input.accountStatus || 'active';
  if (acct !== 'active') {
    return {
      eligible: false,
      reasonCode: 'inactive_or_suspended',
      message: `Your ESC membership is currently ${acct}. Active membership status is required to order a physical ESC Member Card.`,
    };
  }

  if (!input.escMemberId || !input.escMemberId.trim()) {
    return {
      eligible: false,
      reasonCode: 'missing_member_id',
      message:
        'Your official ESC Member ID has not been issued yet. Please wait for ESC Admin approval to complete.',
    };
  }

  return {
    eligible: true,
    reasonCode: 'eligible',
    message: 'You are eligible to order your official physical ESC Member Card with pan-India home delivery.',
  };
}

const ALLOWED_SCREENSHOT_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const ALLOWED_SCREENSHOT_EXT = /\.(jpe?g|png)$/i;
const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;

export function validatePaymentScreenshotFile(file: {
  type?: string;
  name?: string;
  size?: number;
}): { valid: boolean; error?: string } {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').trim();
  const mimeOk = mime ? ALLOWED_SCREENSHOT_MIMES.has(mime) : false;
  const extOk = name ? ALLOWED_SCREENSHOT_EXT.test(name) : false;

  if (!mimeOk && !extOk) {
    return {
      valid: false,
      error: 'Payment screenshot must be a JPG, JPEG, or PNG image.',
    };
  }
  if (typeof file.size === 'number' && file.size > MAX_SCREENSHOT_BYTES) {
    return {
      valid: false,
      error: 'Payment screenshot exceeds 10 MB limit. Please upload a smaller image.',
    };
  }
  return { valid: true };
}

export function isValidImageUrlOrDataUrl(
  value: string | undefined | null,
  allowWebp: boolean = true
): boolean {
  const raw = (value || '').trim();
  if (!raw) return false;
  if (raw.startsWith('https://')) return true;
  if (raw.startsWith('data:image/jpeg;base64,') || raw.startsWith('data:image/jpg;base64,') || raw.startsWith('data:image/png;base64,')) {
    return raw.length > 50;
  }
  if (allowWebp && raw.startsWith('data:image/webp;base64,')) {
    return raw.length > 50;
  }
  return false;
}

export interface PhysicalCardDeliveryFormInput {
  fullName: string;
  email: string;
  mobileNumber: string;
  addressLine1: string;
  streetArea: string;
  cityVillage: string;
  district: string;
  state: string;
  pinCode: string;
  college: string;
  branch: string;
  academicYear: string;
  profilePhotoUrl: string;
}

export function validateDeliveryDetails(input: PhysicalCardDeliveryFormInput): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.fullName?.trim() || input.fullName.trim().length < 2) {
    errors.fullName = 'Full Name is required.';
  }
  if (!input.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.email = 'Valid registered Email ID is required.';
  }

  const digits = (input.mobileNumber || '').replace(/\D/g, '');
  const indianMobile = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(indianMobile)) {
    errors.mobileNumber = 'Enter a valid 10-digit Indian mobile number.';
  }

  if (!input.addressLine1?.trim() || input.addressLine1.trim().length < 3) {
    errors.addressLine1 = 'Complete House/Flat/Building address is required.';
  }
  if (!input.streetArea?.trim() || input.streetArea.trim().length < 2) {
    errors.streetArea = 'Street / Area / Locality is required.';
  }
  if (!input.cityVillage?.trim() || input.cityVillage.trim().length < 2) {
    errors.cityVillage = 'City or Village is required.';
  }
  if (!input.district?.trim() || input.district.trim().length < 2) {
    errors.district = 'District is required.';
  }
  if (!input.state?.trim() || input.state.trim().length < 2) {
    errors.state = 'State is required.';
  }
  if (!/^[1-9]\d{5}$/.test((input.pinCode || '').trim())) {
    errors.pinCode = 'Enter a valid 6-digit Indian PIN Code.';
  }

  if (!input.college?.trim() || input.college.trim().length < 2) {
    errors.college = 'College / University name is required.';
  }
  if (!input.branch?.trim() || input.branch.trim().length < 2) {
    errors.branch = 'Engineering Branch is required.';
  }
  if (!input.academicYear?.trim()) {
    errors.academicYear = 'Academic Year is required.';
  }
  if (!isValidImageUrlOrDataUrl(input.profilePhotoUrl, true)) {
    errors.profilePhotoUrl = 'A valid Profile Photograph (JPG, JPEG, PNG, or WebP) is required.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface PhysicalCardPaymentInput {
  transactionId: string;
  paymentScreenshotUrl?: string;
  paymentConfirmedByMember: boolean;
}

export function validatePaymentSubmission(input: PhysicalCardPaymentInput): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const cleanUtr = (input.transactionId || '').trim();
  const cleanScreenshot = (input.paymentScreenshotUrl || '').trim();

  if (!cleanUtr || cleanUtr.length < 6 || cleanUtr.length > 64 || !/^[a-zA-Z0-9._/-]+$/.test(cleanUtr)) {
    errors.transactionId = 'Enter a valid UPI Transaction ID / UTR Number (6–64 alphanumeric characters).';
  }
  if (cleanScreenshot && !isValidImageUrlOrDataUrl(cleanScreenshot, false)) {
    errors.paymentScreenshotUrl = 'Optional payment screenshot must be a valid JPG, JPEG, or PNG image.';
  }
  if (!input.paymentConfirmedByMember) {
    errors.paymentConfirmedByMember = 'Please confirm that you have completed the payment of ₹151.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function formatFullDeliveryAddress(order: {
  addressLine1: string;
  streetArea: string;
  cityVillage: string;
  district: string;
  state: string;
  pinCode: string;
}): string {
  const parts = [
    order.addressLine1?.trim(),
    order.streetArea?.trim(),
    order.cityVillage?.trim(),
    order.district?.trim(),
    order.state?.trim(),
  ].filter(Boolean);
  return `${parts.join(', ')} - ${(order.pinCode || '').trim()}`;
}

export function generateNextCardOrderId(existingOrderIds: string[], year: number = new Date().getFullYear()): string {
  const prefix = `ESC-ORD-${year}-`;
  let maxSeq = 0;
  for (const id of existingOrderIds) {
    if (id && id.startsWith(prefix)) {
      const seq = parseInt(id.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

export function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCardOrdersCsv(orders: MemberCardOrder[]): string {
  const headers = [
    'Order ID',
    'Order Date',
    'Member Name',
    'ESC Member ID',
    'Email',
    'Mobile Number',
    'College',
    'Branch',
    'Academic Year',
    'Delivery Address',
    'PIN Code',
    'Amount (INR)',
    'UPI ID Used',
    'Transaction ID / UTR',
    'Payment Status',
    'Order Status',
    'Courier Company',
    'Tracking Number',
    'Dispatch Date',
    'Delivered Date',
    'Admin Notes',
  ];

  const rows = orders.map((o) =>
    [
      o.orderId,
      o.createdAt,
      o.fullName,
      o.escMemberId,
      o.email,
      o.mobileNumber,
      o.college,
      o.branch,
      o.academicYear,
      formatFullDeliveryAddress(o),
      o.pinCode,
      o.amountInr,
      o.upiIdUsed,
      o.transactionId,
      getPaymentStatusLabel(o.paymentStatus),
      getCardOrderStatusLabel(o.orderStatus),
      o.courierCompany || '',
      o.trackingNumber || '',
      o.dispatchDate || '',
      o.deliveredDate || '',
      o.adminNotes || '',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}

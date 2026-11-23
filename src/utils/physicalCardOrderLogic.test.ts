import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import {
  buildAndroidUpiIntentUri,
  buildCardOrdersCsv,
  buildUpiPaymentUri,
  CARD_ORDER_STATUS_LIST,
  DEFAULT_ESC_UPI_ID,
  evaluatePhysicalCardOrderEligibility,
  formatFullDeliveryAddress,
  generateNextCardOrderId,
  generateUpiOrderReference,
  getCardOrderStatusLabel,
  isValidUpiId,
  PHYSICAL_CARD_PRICE_INR,
  validateConfiguredUpiId,
  validateDeliveryDetails,
  validatePaymentScreenshotFile,
  validatePaymentSubmission,
} from './physicalCardOrderLogic';
import type { MemberCardOrder } from '../types';

test('Physical card eligibility strictly permits only logged-in approved active members with an ESC Member ID', () => {
  assert.equal(
    evaluatePhysicalCardOrderEligibility({ isLoggedIn: false }).reasonCode,
    'not_logged_in'
  );
  assert.equal(
    evaluatePhysicalCardOrderEligibility({
      isLoggedIn: true,
      membershipStatus: 'submitted',
      accountStatus: 'active',
    }).reasonCode,
    'pending_approval'
  );
  assert.equal(
    evaluatePhysicalCardOrderEligibility({
      isLoggedIn: true,
      membershipStatus: 'rejected',
      accountStatus: 'active',
    }).reasonCode,
    'rejected'
  );
  assert.equal(
    evaluatePhysicalCardOrderEligibility({
      isLoggedIn: true,
      membershipStatus: 'approved',
      accountStatus: 'suspended',
      escMemberId: 'ESC-2026-0001',
    }).reasonCode,
    'inactive_or_suspended'
  );
  assert.equal(
    evaluatePhysicalCardOrderEligibility({
      isLoggedIn: true,
      membershipStatus: 'approved',
      accountStatus: 'active',
      escMemberId: '',
    }).reasonCode,
    'missing_member_id'
  );
  const ok = evaluatePhysicalCardOrderEligibility({
    isLoggedIn: true,
    membershipStatus: 'approved',
    accountStatus: 'active',
    escMemberId: 'ESC-2026-0001',
  });
  assert.equal(ok.eligible, true);
  assert.equal(ok.reasonCode, 'eligible');
});

test('UPI payment URI follows strict NPCI format (literal @, %20 spaces, am=151.00, cu=INR, tr) and rejects invalid UPI IDs', async () => {
  const orderRef = generateUpiOrderReference('ESC-2026-0042');
  assert.ok(/^[A-Z0-9]{12,32}$/.test(orderRef));

  const uri = buildUpiPaymentUri({
    upiId: DEFAULT_ESC_UPI_ID,
    amountInr: PHYSICAL_CARD_PRICE_INR,
    orderRef,
  });
  assert.ok(uri, 'Valid UPI ID must produce a URI');
  assert.equal(
    uri,
    `upi://pay?pa=9420482152-2@ybl&pn=ESC&am=151.00&cu=INR&tn=ESC%20Physical%20Member%20Card%20Order&tr=${orderRef}`
  );
  assert.ok(!uri.includes('%40'), 'pa must keep literal @ for PhonePe/Paytm/BHIM scanner compatibility');
  assert.ok(!uri.includes('+'), 'spaces must be encoded as %20, never +');

  // Android Intent URI fallback
  const intentUri = buildAndroidUpiIntentUri(uri);
  assert.equal(
    intentUri,
    `intent://pay?pa=9420482152-2@ybl&pn=ESC&am=151.00&cu=INR&tn=ESC%20Physical%20Member%20Card%20Order&tr=${orderRef}#Intent;scheme=upi;end`
  );

  // Genuine QR code generation with high error correction and quiet zone
  const qrModel = QRCode.create(uri, { errorCorrectionLevel: 'H' });
  assert.ok(qrModel.modules.size >= 37, 'QR matrix must encode full UPI URI');
  const qrDataUrl = await QRCode.toDataURL(uri, {
    width: 640,
    margin: 4,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  assert.ok(qrDataUrl.startsWith('data:image/png;base64,'));
  assert.ok(qrDataUrl.length > 1000);

  // Custom configured UPI ID from Admin Settings
  const customUri = buildUpiPaymentUri({
    upiId: 'esc.payments@okaxis',
    payeeName: 'ESC Official',
    amountInr: 151,
    orderRef: 'ESCORD001',
  });
  assert.equal(
    customUri,
    'upi://pay?pa=esc.payments@okaxis&pn=ESC%20Official&am=151.00&cu=INR&tn=ESC%20Physical%20Member%20Card%20Order&tr=ESCORD001'
  );

  // Missing or invalid UPI ID must fail cleanly instead of generating an invalid QR code
  assert.equal(isValidUpiId(''), false);
  assert.equal(isValidUpiId('not-a-upi-id'), false);
  assert.equal(isValidUpiId('bad@'), false);
  assert.equal(isValidUpiId('9420482152-2@ybl'), true);
  assert.equal(validateConfiguredUpiId('').valid, false);
  assert.equal(validateConfiguredUpiId('broken_vpa').valid, false);
  assert.equal(buildUpiPaymentUri({ upiId: '' }), null);
  assert.equal(buildUpiPaymentUri({ upiId: 'broken_vpa' }), null);
});

test('Delivery form and payment submission validators enforce mandatory UTR + checkbox while keeping screenshot optional', () => {
  const invalidDelivery = validateDeliveryDetails({
    fullName: '',
    email: 'bad-email',
    mobileNumber: '12345',
    addressLine1: '',
    streetArea: '',
    cityVillage: '',
    district: '',
    state: '',
    pinCode: '00012',
    college: '',
    branch: '',
    academicYear: '',
    profilePhotoUrl: 'javascript:alert(1)',
  });
  assert.equal(invalidDelivery.isValid, false);
  assert.ok(invalidDelivery.errors.mobileNumber);
  assert.ok(invalidDelivery.errors.pinCode);
  assert.ok(invalidDelivery.errors.profilePhotoUrl);

  const validDelivery = validateDeliveryDetails({
    fullName: 'Aarav Kulkarni',
    email: 'aarav@example.com',
    mobileNumber: '+91 9876543210',
    addressLine1: 'Flat 402, Tech Park Residency',
    streetArea: 'Baner Road',
    cityVillage: 'Pune',
    district: 'Pune',
    state: 'Maharashtra',
    pinCode: '411045',
    college: 'COEP Technological University',
    branch: 'Mechanical Engineering',
    academicYear: '3rd Year',
    profilePhotoUrl: `data:image/jpeg;base64,${'A'.repeat(80)}`,
  });
  assert.equal(validDelivery.isValid, true);

  // Payment submission requires UTR + checkbox confirmation; screenshot is optional
  const badPayment = validatePaymentSubmission({
    transactionId: '123',
    paymentScreenshotUrl: '',
    paymentConfirmedByMember: false,
  });
  assert.equal(badPayment.isValid, false);
  assert.ok(badPayment.errors.transactionId);
  assert.equal(badPayment.errors.paymentScreenshotUrl, undefined);
  assert.ok(badPayment.errors.paymentConfirmedByMember);

  // Valid without optional screenshot
  const goodWithoutScreenshot = validatePaymentSubmission({
    transactionId: '432512345678',
    paymentScreenshotUrl: '',
    paymentConfirmedByMember: true,
  });
  assert.equal(goodWithoutScreenshot.isValid, true);

  // Invalid screenshot payload rejected when provided
  const badScreenshotPayload = validatePaymentSubmission({
    transactionId: '432512345678',
    paymentScreenshotUrl: 'javascript:alert(1)',
    paymentConfirmedByMember: true,
  });
  assert.equal(badScreenshotPayload.isValid, false);
  assert.ok(badScreenshotPayload.errors.paymentScreenshotUrl);

  // Screenshot file validator allows only JPG, JPEG, PNG (not WebP or SVG)
  assert.equal(validatePaymentScreenshotFile({ type: 'image/png', name: 'upi.png', size: 50_000 }).valid, true);
  assert.equal(validatePaymentScreenshotFile({ type: 'image/jpeg', name: 'upi.jpg', size: 50_000 }).valid, true);
  assert.equal(validatePaymentScreenshotFile({ type: 'image/svg+xml', name: 'bad.svg', size: 1000 }).valid, false);
  assert.equal(validatePaymentScreenshotFile({ type: 'application/pdf', name: 'receipt.pdf', size: 1000 }).valid, false);

  const goodWithScreenshot = validatePaymentSubmission({
    transactionId: '432512345678',
    paymentScreenshotUrl: `data:image/png;base64,${'B'.repeat(80)}`,
    paymentConfirmedByMember: true,
  });
  assert.equal(goodWithScreenshot.isValid, true);
});

test('Order IDs increment sequentially, cover all 9 statuses, and export clean CSV', () => {
  assert.equal(CARD_ORDER_STATUS_LIST.length, 9);
  assert.equal(getCardOrderStatusLabel('out_for_delivery'), 'Out for Delivery');
  assert.equal(getCardOrderStatusLabel('rejected'), 'Rejected / Payment Issue');

  const nextId = generateNextCardOrderId(['ESC-ORD-2026-0001', 'ESC-ORD-2026-0007'], 2026);
  assert.equal(nextId, 'ESC-ORD-2026-0008');

  const sampleOrder: MemberCardOrder = {
    id: 'ord_1',
    orderId: 'ESC-ORD-2026-0001',
    userUid: 'uid_1',
    escMemberId: 'ESC-2026-0001',
    fullName: 'Aarav Kulkarni',
    email: 'aarav@example.com',
    mobileNumber: '9876543210',
    college: 'COEP, Pune',
    branch: 'Mechanical',
    academicYear: '3rd Year',
    profilePhotoUrl: 'https://example.com/photo.jpg',
    addressLine1: 'Flat 402',
    streetArea: 'Baner Road',
    cityVillage: 'Pune',
    district: 'Pune',
    state: 'Maharashtra',
    pinCode: '411045',
    amountInr: 151,
    upiIdUsed: '9420482152-2@ybl',
    transactionId: 'UTR1234567890',
    paymentScreenshotUrl: 'https://example.com/upi.png',
    paymentConfirmedByMember: true,
    paymentStatus: 'pending_verification',
    orderStatus: 'order_received',
    statusHistory: [],
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
  };

  assert.equal(
    formatFullDeliveryAddress(sampleOrder),
    'Flat 402, Baner Road, Pune, Pune, Maharashtra - 411045'
  );
  const csv = buildCardOrdersCsv([sampleOrder]);
  assert.ok(csv.includes('"COEP, Pune"'));
  assert.ok(csv.includes('ESC-ORD-2026-0001'));
  assert.ok(csv.includes('Pending Verification'));
});

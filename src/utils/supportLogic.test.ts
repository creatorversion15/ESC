import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICIAL_ESC_CONTACT,
  SUPPORT_CATEGORIES,
  SUPPORT_FAQS,
  SUPPORT_OPTION_CARDS,
  SUPPORT_STATUSES,
  filterSupportTickets,
  generateSupportTicketId,
  getSupportStatusLabel,
  isValidSupportStatus,
  resolveSupportCategoryFromQuery,
  validateSupportRequestInput,
} from './supportLogic';
import type { SupportTicket } from '../types';

test('official ESC contact details and 4 support cards match requirements', () => {
  assert.equal(OFFICIAL_ESC_CONTACT.heading, "NEED HELP? WE'RE HERE TO SUPPORT YOU.");
  assert.equal(OFFICIAL_ESC_CONTACT.email, 'soviraj50@gmail.com');
  assert.equal(OFFICIAL_ESC_CONTACT.mailtoHref, 'mailto:soviraj50@gmail.com');
  assert.equal(
    OFFICIAL_ESC_CONTACT.linkedinUrl,
    'https://www.linkedin.com/in/viraj-bansod-46940129a/'
  );
  assert.equal('instagramUrl' in OFFICIAL_ESC_CONTACT, false);
  assert.equal('name' in OFFICIAL_ESC_CONTACT, false);
  assert.equal(SUPPORT_OPTION_CARDS.length, 4);
  assert.deepEqual(
    SUPPORT_OPTION_CARDS.map((c) => c.buttonLabel),
    ['GET APPLICATION HELP', 'GET PROJECT SUPPORT', 'REPORT AN ISSUE', 'CONTACT ESC']
  );
  assert.equal(SUPPORT_CATEGORIES.length, 6);
  assert.equal(SUPPORT_STATUSES.length, 5);
  assert.equal(SUPPORT_FAQS.length, 6);
  assert.ok(SUPPORT_FAQS[5].answer.includes('soviraj50@gmail.com'));
  assert.ok(SUPPORT_FAQS[5].answer.includes('LinkedIn'));
  assert.equal(SUPPORT_FAQS[5].answer.toLowerCase().includes('instagram'), false);
});

test('validateSupportRequestInput rejects missing fields and invalid attachments', () => {
  const empty = validateSupportRequestInput({
    fullName: '',
    email: 'bad-email',
    category: 'Unknown',
    subject: 'Hi',
    description: 'Too short',
  });
  assert.equal(empty.isValid, false);
  assert.ok(empty.errors.fullName);
  assert.ok(empty.errors.email);
  assert.ok(empty.errors.category);
  assert.ok(empty.errors.subject);
  assert.ok(empty.errors.description);

  const badFile = validateSupportRequestInput({
    fullName: 'Aarav Kulkarni',
    email: 'aarav@example.com',
    category: 'Website / Technical Issue',
    subject: 'Login screen freezes on mobile',
    description: 'When I tap Google Sign In from mobile Safari the button does not respond.',
    attachmentName: 'script.exe',
    attachmentDataUrl: 'data:application/octet-stream;base64,AAAA',
  });
  assert.equal(badFile.isValid, false);
  assert.ok(badFile.errors.attachment);
});

test('validateSupportRequestInput accepts valid payload with optional PNG screenshot', () => {
  const valid = validateSupportRequestInput({
    fullName: 'Aarav Kulkarni',
    email: 'aarav@example.com',
    category: 'Fellowship Application',
    subject: 'Need help uploading college ID details',
    description: 'I completed Step 3 of the application and need guidance on Step 4 team selection.',
    attachmentName: 'screenshot.png',
    attachmentType: 'image/png',
    attachmentDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  });
  assert.equal(valid.isValid, true);
  assert.deepEqual(valid.errors, {});
});

test('generateSupportTicketId formats deterministic and readable IDs', () => {
  const id = generateSupportTicketId(new Date('2026-11-19T00:00:00Z'), 'ab12cd');
  assert.equal(id, 'ESC-SUP-2026-AB12CD');
  const randomId = generateSupportTicketId();
  assert.match(randomId, /^ESC-SUP-\d{4}-[A-Z0-9]{6}$/);
});

test('resolveSupportCategoryFromQuery maps query parameters cleanly', () => {
  assert.equal(resolveSupportCategoryFromQuery('Fellowship Application'), 'Fellowship Application');
  assert.equal(resolveSupportCategoryFromQuery('project'), 'Startup / Project');
  assert.equal(resolveSupportCategoryFromQuery('technical'), 'Website / Technical Issue');
  assert.equal(resolveSupportCategoryFromQuery('college'), 'College Collaboration');
  assert.equal(resolveSupportCategoryFromQuery('general'), 'General Enquiry');
});

test('filterSupportTickets searches by ticketId, name, email and filters category/status', () => {
  const sample: SupportTicket[] = [
    {
      id: '1',
      ticketId: 'ESC-SUP-2026-AAA111',
      fullName: 'Riya Deshmukh',
      email: 'riya@college.edu',
      category: 'Fellowship Application',
      subject: 'Step 4 clarification',
      description: 'Need help selecting the right option in step 4.',
      status: 'new',
      statusHistory: [],
      createdAt: '2026-11-19T01:00:00Z',
      updatedAt: '2026-11-19T01:00:00Z',
    },
    {
      id: '2',
      ticketId: 'ESC-SUP-2026-BBB222',
      fullName: 'Kabir Mehta',
      email: 'kabir@startup.io',
      category: 'Website / Technical Issue',
      subject: 'Certificate print layout',
      description: 'Seeing extra margin when printing.',
      status: 'resolved',
      statusHistory: [],
      createdAt: '2026-11-19T02:00:00Z',
      updatedAt: '2026-11-19T03:00:00Z',
    },
  ];

  assert.equal(filterSupportTickets(sample, { search: 'BBB222' }).length, 1);
  assert.equal(filterSupportTickets(sample, { search: 'riya@college.edu' }).length, 1);
  assert.equal(filterSupportTickets(sample, { category: 'Fellowship Application' }).length, 1);
  assert.equal(filterSupportTickets(sample, { status: 'resolved' }).length, 1);
  assert.equal(isValidSupportStatus('in_progress'), true);
  assert.equal(getSupportStatusLabel('in_progress'), 'In Progress');
});

import type { SupportCategory, SupportTicket, SupportTicketStatus } from '../types/index.ts';

export const SUPPORT_CATEGORIES: readonly SupportCategory[] = [
  'Fellowship Application',
  'Startup / Project',
  'Website / Technical Issue',
  'College Collaboration',
  'General Enquiry',
  'Other',
] as const;

export const SUPPORT_STATUSES: readonly SupportTicketStatus[] = [
  'new',
  'under_review',
  'in_progress',
  'resolved',
  'closed',
] as const;

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  new: 'New',
  under_review: 'Under Review',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const OFFICIAL_ESC_CONTACT = {
  heading: "NEED HELP? WE'RE HERE TO SUPPORT YOU.",
  description:
    'Have questions or facing an issue with ESC? Contact our support team for assistance.',
  emailLabel: 'Email Support',
  email: 'soviraj50@gmail.com',
  mailtoHref: 'mailto:soviraj50@gmail.com',
  linkedinLabel: 'LinkedIn Support',
  linkedinUrl: 'https://www.linkedin.com/in/viraj-bansod-46940129a/',
} as const;

export interface SupportOptionCard {
  code: 'A' | 'B' | 'C' | 'D';
  title: string;
  description: string;
  buttonLabel: string;
  category: SupportCategory;
}

export const SUPPORT_OPTION_CARDS: readonly SupportOptionCard[] = [
  {
    code: 'A',
    title: 'Fellowship Application Help',
    description:
      'Having trouble applying for ESC fellowship or completing your application? Contact us for assistance.',
    buttonLabel: 'GET APPLICATION HELP',
    category: 'Fellowship Application',
  },
  {
    code: 'B',
    title: 'Startup & Project Support',
    description:
      'Have questions about submitting a startup idea, building a team or participating in an ESC project?',
    buttonLabel: 'GET PROJECT SUPPORT',
    category: 'Startup / Project',
  },
  {
    code: 'C',
    title: 'Website & Technical Support',
    description:
      'Facing login issues, website errors or problems using ESC features? Let us know.',
    buttonLabel: 'REPORT AN ISSUE',
    category: 'Website / Technical Issue',
  },
  {
    code: 'D',
    title: 'General Enquiries',
    description:
      'For general questions, collaborations, partnerships and other enquiries, contact the ESC team.',
    buttonLabel: 'CONTACT ESC',
    category: 'General Enquiry',
  },
] as const;

export interface SupportFaqItem {
  id: string;
  question: string;
  answer: string;
}

export const SUPPORT_FAQS: readonly SupportFaqItem[] = [
  {
    id: 'q1',
    question: 'Q1. What is ESC?',
    answer:
      'ESC stands for Engineering Startup Company. Engineering Startup Company (ESC) is an engineering and entrepreneurship-focused organisation that connects engineering students, innovators, startups and industry professionals to develop ideas, build products, explore opportunities and create real-world solutions.',
  },
  {
    id: 'q2',
    question: 'Q2. How can I join ESC?',
    answer:
      'Visit the ESC website and click Apply for Fellowship to submit your application.',
  },
  {
    id: 'q3',
    question: 'Q3. Is fellowship application approval guaranteed?',
    answer: 'No. Applications are reviewed by the ESC Admin Team.',
  },
  {
    id: 'q4',
    question: 'Q4. Can I submit my own startup idea?',
    answer:
      'Yes. You can submit a startup or product idea for ESC Admin review.',
  },
  {
    id: 'q5',
    question: 'Q5. Can I join an existing project?',
    answer:
      'Yes. You can express interest in joining an existing approved project, subject to eligibility and selection.',
  },
  {
    id: 'q6',
    question: 'Q6. How can I contact ESC?',
    answer:
      'You can email soviraj50@gmail.com or connect through the official LinkedIn link provided on the website.',
  },
] as const;

export const ALLOWED_SUPPORT_ATTACHMENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const;

// 2 MB binary limit (~2.8 MB base64 data URL string)
export const MAX_SUPPORT_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const MAX_SUPPORT_ATTACHMENT_DATA_URL_LENGTH = 2_900_000;

export interface SupportRequestInput {
  fullName: string;
  email: string;
  category: string;
  subject: string;
  description: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentDataUrl?: string;
}

export interface SupportValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidSupportCategory(value: string): value is SupportCategory {
  return (SUPPORT_CATEGORIES as readonly string[]).includes(value);
}

export function isValidSupportStatus(value: string): value is SupportTicketStatus {
  return (SUPPORT_STATUSES as readonly string[]).includes(value);
}

export function getSupportStatusLabel(status: string): string {
  if (isValidSupportStatus(status)) {
    return SUPPORT_STATUS_LABELS[status];
  }
  return 'New';
}

export function resolveSupportCategoryFromQuery(raw: string | null | undefined): SupportCategory {
  if (!raw) return 'Fellowship Application';
  const trimmed = raw.trim();
  if (isValidSupportCategory(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.includes('fellowship') || lower.includes('application')) return 'Fellowship Application';
  if (lower.includes('startup') || lower.includes('project')) return 'Startup / Project';
  if (lower.includes('website') || lower.includes('technical') || lower.includes('issue')) {
    return 'Website / Technical Issue';
  }
  if (lower.includes('college') || lower.includes('collab')) return 'College Collaboration';
  if (lower.includes('general')) return 'General Enquiry';
  return 'Other';
}

export function validateSupportRequestInput(
  input: SupportRequestInput
): SupportValidationResult {
  const errors: Record<string, string> = {};

  const fullName = (input.fullName || '').trim();
  const email = (input.email || '').trim();
  const category = (input.category || '').trim();
  const subject = (input.subject || '').trim();
  const description = (input.description || '').trim();

  if (fullName.length < 2) {
    errors.fullName = 'Please enter your full name (at least 2 characters).';
  } else if (fullName.length > 120) {
    errors.fullName = 'Full name must be 120 characters or fewer.';
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Please enter a valid email address.';
  } else if (email.length > 160) {
    errors.email = 'Email address is too long.';
  }

  if (!isValidSupportCategory(category)) {
    errors.category = 'Please select a valid support category.';
  }

  if (subject.length < 4) {
    errors.subject = 'Please enter a brief subject (at least 4 characters).';
  } else if (subject.length > 180) {
    errors.subject = 'Subject must be 180 characters or fewer.';
  }

  if (description.length < 15) {
    errors.description = 'Please describe your issue in at least 15 characters.';
  } else if (description.length > 4000) {
    errors.description = 'Issue description must be 4000 characters or fewer.';
  }

  if (input.attachmentDataUrl) {
    const dataUrl = input.attachmentDataUrl.trim();
    const validPrefix = ALLOWED_SUPPORT_ATTACHMENT_TYPES.some((mime) =>
      dataUrl.startsWith(`data:${mime};base64,`)
    );
    if (!validPrefix) {
      errors.attachment = 'Attachment must be a PNG, JPG, WebP image, or PDF file.';
    } else if (dataUrl.length > MAX_SUPPORT_ATTACHMENT_DATA_URL_LENGTH) {
      errors.attachment = 'Attachment must be 2 MB or smaller.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function generateSupportTicketId(
  now: Date = new Date(),
  randomSuffix?: string
): string {
  const year = now.getUTCFullYear();
  const suffix = (
    randomSuffix ||
    Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, 'X')
  )
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 6);
  return `ESC-SUP-${year}-${suffix}`;
}

export function filterSupportTickets(
  tickets: SupportTicket[],
  filters: {
    search?: string;
    category?: string;
    status?: string;
  }
): SupportTicket[] {
  const search = (filters.search || '').trim().toLowerCase();
  const category = filters.category || 'all';
  const status = filters.status || 'all';

  return tickets.filter((ticket) => {
    if (category !== 'all' && ticket.category !== category) return false;
    if (status !== 'all' && ticket.status !== status) return false;
    if (search) {
      const hay = [
        ticket.ticketId,
        ticket.fullName,
        ticket.email,
        ticket.subject,
        ticket.category,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

import React, { useEffect, useRef, useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  Send,
  CheckCircle2,
  Mail,
  Linkedin,
  ExternalLink,
  Paperclip,
  X,
  AlertCircle,
  FileText,
  Rocket,
  Wrench,
  MessageSquare,
  ArrowRight,
  Copy,
  Check,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/apiClient';
import {
  ALLOWED_SUPPORT_ATTACHMENT_TYPES,
  MAX_SUPPORT_ATTACHMENT_BYTES,
  OFFICIAL_ESC_CONTACT,
  SUPPORT_CATEGORIES,
  SUPPORT_FAQS,
  SUPPORT_OPTION_CARDS,
  resolveSupportCategoryFromQuery,
  validateSupportRequestInput,
} from '../utils/supportLogic';
import type { SupportCategory, SupportTicket } from '../types';

interface ContactProps {
  navigate: (path: string) => void;
}

function readCategoryFromUrl(): SupportCategory | null {
  try {
    const hashQuery = window.location.hash.includes('?')
      ? window.location.hash.split('?')[1]
      : '';
    const searchQuery = window.location.search ? window.location.search.slice(1) : '';
    const params = new URLSearchParams(hashQuery || searchQuery);
    const raw = params.get('category');
    if (!raw) return null;
    return resolveSupportCategoryFromQuery(raw);
  } catch {
    return null;
  }
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sup_req_${crypto.randomUUID()}`;
  }
  return `sup_req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const CARD_ICONS = {
  A: FileText,
  B: Rocket,
  C: Wrench,
  D: MessageSquare,
} as const;

export const Contact: React.FC<ContactProps> = ({ navigate }) => {
  const { user, profile } = useAuth();
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [openFaqId, setOpenFaqId] = useState<string | null>(SUPPORT_FAQS[0].id);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<SupportCategory>(
    () => readCategoryFromUrl() || 'Fellowship Application'
  );
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  // Attachment state
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentType, setAttachmentType] = useState('');
  const [attachmentDataUrl, setAttachmentDataUrl] = useState('');
  const [attachmentSize, setAttachmentSize] = useState<number>(0);

  // Submission state
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => createIdempotencyKey());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<SupportTicket | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Sync user profile defaults if fields are still empty
  useEffect(() => {
    if (user) {
      setFullName((prev) => prev || profile?.fullName || user.displayName || '');
      setEmail((prev) => prev || user.email || '');
    }
  }, [user, profile]);

  // Listen for hash query changes (e.g., navigating from Apply or Footer with ?category=...)
  useEffect(() => {
    const syncCategory = () => {
      const fromUrl = readCategoryFromUrl();
      if (fromUrl) {
        setCategory(fromUrl);
      }
    };
    syncCategory();
    window.addEventListener('hashchange', syncCategory);
    return () => window.removeEventListener('hashchange', syncCategory);
  }, []);

  const clearError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSelectSupportOption = (selectedCategory: SupportCategory) => {
    setCategory(selectedCategory);
    clearError('category');
    setSubmittedTicket(null);
    setSubmitError(null);
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      subjectInputRef.current?.focus();
    }, 350);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!(ALLOWED_SUPPORT_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        attachment: 'Attachment must be a PNG, JPG, WebP image, or PDF file.',
      }));
      e.target.value = '';
      return;
    }

    if (file.size > MAX_SUPPORT_ATTACHMENT_BYTES) {
      setFieldErrors((prev) => ({
        ...prev,
        attachment: 'Attachment must be 2 MB or smaller.',
      }));
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        setFieldErrors((prev) => ({
          ...prev,
          attachment: 'Unable to read attachment file. Please try another file.',
        }));
        return;
      }
      setAttachmentName(file.name);
      setAttachmentType(file.type);
      setAttachmentDataUrl(result);
      setAttachmentSize(file.size);
      clearError('attachment');
    };
    reader.onerror = () => {
      setFieldErrors((prev) => ({
        ...prev,
        attachment: 'Unable to read attachment file. Please try again.',
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setAttachmentName('');
    setAttachmentType('');
    setAttachmentDataUrl('');
    setAttachmentSize(0);
    clearError('attachment');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitError(null);

    const validation = validateSupportRequestInput({
      fullName,
      email,
      category,
      subject,
      description,
      attachmentName: attachmentName || undefined,
      attachmentType: attachmentType || undefined,
      attachmentDataUrl: attachmentDataUrl || undefined,
    });

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setSubmitError('Please review the highlighted fields before submitting.');
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await apiRequest<{ ticket: SupportTicket; deduplicated?: boolean }>(
        '/api/support/tickets',
        {
          method: 'POST',
          requireAuth: false,
          body: {
            idempotencyKey,
            fullName: fullName.trim(),
            email: email.trim(),
            category,
            subject: subject.trim(),
            description: description.trim(),
            attachmentName: attachmentName || undefined,
            attachmentType: attachmentType || undefined,
            attachmentDataUrl: attachmentDataUrl || undefined,
          },
        }
      );

      setSubmittedTicket(response.ticket);
      setSubject('');
      setDescription('');
      removeAttachment();
    } catch (err: any) {
      setSubmitError(
        err?.message || 'Unable to submit your support request right now. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNewRequest = () => {
    setSubmittedTicket(null);
    setSubmitError(null);
    setFieldErrors({});
    setIdempotencyKey(createIdempotencyKey());
  };

  const handleCopyTicketId = async (ticketId: string) => {
    try {
      await navigator.clipboard.writeText(ticketId);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c0e] py-14 sm:py-18 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-16">
        {/* 1. NEED HELP? HERO SECTION */}
        <section className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#39FF14]/35 bg-[#39FF14]/10 px-4 py-1 font-mono text-[11px] uppercase tracking-widest text-[#39FF14]">
            <HelpCircle className="h-3.5 w-3.5" /> ESC Support Center
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight text-white uppercase">
            {OFFICIAL_ESC_CONTACT.heading}
          </h1>
          <p className="text-sm sm:text-base text-[#9ca3af] leading-relaxed">
            {OFFICIAL_ESC_CONTACT.description}
          </p>
        </section>

        {/* 2. FOUR INTERACTIVE SUPPORT OPTIONS (A–D) */}
        <section aria-label="Support Options" className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {SUPPORT_OPTION_CARDS.map((card) => {
            const Icon = CARD_ICONS[card.code];
            const isSelected = category === card.category;
            return (
              <div
                key={card.code}
                className={`group rounded-2xl border p-6 flex flex-col justify-between gap-5 transition-all bg-[#111317] ${
                  isSelected
                    ? 'border-[#39FF14]/60 shadow-[0_0_25px_rgba(57,255,20,0.08)]'
                    : 'border-[#232731] hover:border-[#39FF14]/40'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#39FF14]/30 bg-[#39FF14]/10 text-[#39FF14]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 border border-[#232731] bg-[#0d0f13] px-2.5 py-1 rounded-lg">
                      Option {card.code}
                    </span>
                  </div>
                  <h2 className="font-display text-lg font-bold text-white group-hover:text-[#39FF14] transition-colors">
                    {card.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#9ca3af] leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => handleSelectSupportOption(card.category)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-[#32e010] transition-colors cursor-pointer"
                  >
                    {card.buttonLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* 3. OFFICIAL CONTACT PERSON CARD + CONTACT SUPPORT FORM */}
        <section
          ref={formSectionRef}
          id="support-form"
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start scroll-mt-24"
        >
          {/* Left Column: Official Support Contact Information Card */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-2xl border border-[#232731] bg-[#101216] p-6 sm:p-7 space-y-6">
              <div className="space-y-2 border-b border-[#1d2028] pb-4">
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#39FF14]">
                  Official ESC Support
                </span>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white uppercase leading-snug">
                  {OFFICIAL_ESC_CONTACT.heading}
                </h2>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  {OFFICIAL_ESC_CONTACT.description}
                </p>
              </div>

              <div className="space-y-3 text-xs">
                {/* Email Support */}
                <a
                  href={OFFICIAL_ESC_CONTACT.mailtoHref}
                  aria-label="Email Support"
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#252933] bg-[#151820] px-4 py-3.5 text-zinc-200 hover:border-[#39FF14]/60 hover:text-white transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#39FF14]/10 text-[#39FF14]">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                        {OFFICIAL_ESC_CONTACT.emailLabel}
                      </span>
                      <span className="font-medium text-white group-hover:text-[#39FF14] truncate block">
                        {OFFICIAL_ESC_CONTACT.email}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-500 group-hover:text-[#39FF14] shrink-0" />
                </a>

                {/* LinkedIn Support */}
                <a
                  href={OFFICIAL_ESC_CONTACT.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn Support"
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#252933] bg-[#151820] px-4 py-3.5 text-zinc-200 hover:border-[#39FF14]/60 hover:text-white transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#39FF14]/10 text-[#39FF14]">
                      <Linkedin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                        {OFFICIAL_ESC_CONTACT.linkedinLabel}
                      </span>
                      <span className="font-medium text-white group-hover:text-[#39FF14] truncate block">
                        Connect on LinkedIn
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-500 group-hover:text-[#39FF14] shrink-0" />
                </a>
              </div>

              <div className="rounded-xl border border-[#222630] bg-[#0c0e12] p-4 flex items-start gap-3 text-[11px] text-[#9ca3af] leading-relaxed">
                <ShieldCheck className="h-4 w-4 text-[#39FF14] shrink-0 mt-0.5" />
                <p>
                  All support requests and uploaded screenshots are stored privately and visible only to you (when signed in) and the ESC Admin Team.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Support Form */}
          <div className="lg:col-span-7 rounded-2xl border border-[#232731] bg-[#101216] p-6 sm:p-8 space-y-6">
            <div className="space-y-1 border-b border-[#1d2028] pb-4">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#39FF14]">
                Direct Support Queue
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                Submit a Support Request
              </h2>
              <p className="text-xs text-[#8e919b]">
                Tell us what you need help with. Every request receives a unique ESC ticket ID tracked by the ESC Admin Team.
              </p>
            </div>

            {submittedTicket ? (
              <div
                data-testid="support-confirmation"
                className="rounded-2xl border border-[#39FF14]/45 bg-[#39FF14]/10 p-6 space-y-5"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#39FF14] text-black">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-bold text-white">
                      Support Request Submitted
                    </h3>
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      Your request has been logged in the ESC Support Queue for review by the ESC Admin Team. Save your ticket ID below for reference.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#273127] bg-[#0b0d0c] p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                      Support Ticket ID
                    </span>
                    <span
                      data-testid="support-ticket-id"
                      className="font-mono text-base sm:text-lg font-bold text-[#39FF14]"
                    >
                      {submittedTicket.ticketId}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyTicketId(submittedTicket.ticketId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#2e352e] bg-[#151a15] px-3 py-1.5 text-xs font-mono text-zinc-200 hover:border-[#39FF14] hover:text-white cursor-pointer"
                  >
                    {copiedId ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#39FF14]" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy ID
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-[#232731] bg-[#0e1014] p-3">
                    <span className="block text-[10px] font-mono uppercase text-zinc-500">Category</span>
                    <span className="font-semibold text-white">{submittedTicket.category}</span>
                  </div>
                  <div className="rounded-xl border border-[#232731] bg-[#0e1014] p-3">
                    <span className="block text-[10px] font-mono uppercase text-zinc-500">Current Status</span>
                    <span className="font-semibold text-[#39FF14]">New</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {user && (
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard')}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-[#32e010] cursor-pointer"
                    >
                      <Ticket className="h-4 w-4" /> View My Tickets in Dashboard
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleStartNewRequest}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#2b2f38] bg-[#151820] px-4 py-2.5 text-xs font-semibold text-white hover:border-[#39FF14] cursor-pointer"
                  >
                    Submit Another Request
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs">
                {submitError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/40 bg-red-950/35 px-4 py-3 text-xs text-red-200 flex items-start gap-2.5"
                  >
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="support-full-name" className="block font-semibold text-white mb-1.5">
                      Full Name <span className="text-[#39FF14]">*</span>
                    </label>
                    <input
                      id="support-full-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        clearError('fullName');
                      }}
                      placeholder="Enter your full name"
                      className={`w-full rounded-xl border bg-[#17191e] px-3.5 py-2.5 text-white placeholder-[#5a5f6e] focus:outline-none ${
                        fieldErrors.fullName
                          ? 'border-red-500 focus:border-red-400'
                          : 'border-[#2b2f38] focus:border-[#39FF14]'
                      }`}
                    />
                    {fieldErrors.fullName && (
                      <p className="mt-1 text-[11px] text-red-400">{fieldErrors.fullName}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="support-email" className="block font-semibold text-white mb-1.5">
                      Email Address <span className="text-[#39FF14]">*</span>
                    </label>
                    <input
                      id="support-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearError('email');
                      }}
                      placeholder="you@example.com"
                      className={`w-full rounded-xl border bg-[#17191e] px-3.5 py-2.5 text-white placeholder-[#5a5f6e] focus:outline-none ${
                        fieldErrors.email
                          ? 'border-red-500 focus:border-red-400'
                          : 'border-[#2b2f38] focus:border-[#39FF14]'
                      }`}
                    />
                    {fieldErrors.email && (
                      <p className="mt-1 text-[11px] text-red-400">{fieldErrors.email}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="support-category" className="block font-semibold text-white mb-1.5">
                    Select Support Category <span className="text-[#39FF14]">*</span>
                  </label>
                  <select
                    id="support-category"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value as SupportCategory);
                      clearError('category');
                    }}
                    className={`w-full rounded-xl border bg-[#17191e] px-3.5 py-2.5 text-white focus:outline-none ${
                      fieldErrors.category
                        ? 'border-red-500 focus:border-red-400'
                        : 'border-[#2b2f38] focus:border-[#39FF14]'
                    }`}
                  >
                    {SUPPORT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.category && (
                    <p className="mt-1 text-[11px] text-red-400">{fieldErrors.category}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="support-subject" className="block font-semibold text-white mb-1.5">
                    Subject <span className="text-[#39FF14]">*</span>
                  </label>
                  <input
                    ref={subjectInputRef}
                    id="support-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      clearError('subject');
                    }}
                    placeholder="Brief summary of your question or issue"
                    className={`w-full rounded-xl border bg-[#17191e] px-3.5 py-2.5 text-white placeholder-[#5a5f6e] focus:outline-none ${
                      fieldErrors.subject
                        ? 'border-red-500 focus:border-red-400'
                        : 'border-[#2b2f38] focus:border-[#39FF14]'
                    }`}
                  />
                  {fieldErrors.subject && (
                    <p className="mt-1 text-[11px] text-red-400">{fieldErrors.subject}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="support-description" className="block font-semibold text-white mb-1.5">
                    Describe Your Issue <span className="text-[#39FF14]">*</span>
                  </label>
                  <textarea
                    id="support-description"
                    rows={5}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      clearError('description');
                    }}
                    placeholder="Share full details, error messages, or questions so the ESC team can help quickly..."
                    className={`w-full rounded-xl border bg-[#17191e] px-3.5 py-2.5 text-white placeholder-[#5a5f6e] focus:outline-none ${
                      fieldErrors.description
                        ? 'border-red-500 focus:border-red-400'
                        : 'border-[#2b2f38] focus:border-[#39FF14]'
                    }`}
                  />
                  {fieldErrors.description && (
                    <p className="mt-1 text-[11px] text-red-400">{fieldErrors.description}</p>
                  )}
                </div>

                {/* Optional Screenshot / Attachment */}
                <div>
                  <label htmlFor="support-attachment" className="block font-semibold text-white mb-1.5">
                    Optional Screenshot / Attachment{' '}
                    <span className="font-normal text-zinc-500">(PNG, JPG, WebP, or PDF — max 2 MB)</span>
                  </label>

                  {attachmentDataUrl ? (
                    <div className="rounded-xl border border-[#2b332b] bg-[#131713] p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {attachmentType.startsWith('image/') ? (
                          <img
                            src={attachmentDataUrl}
                            alt="Uploaded attachment preview"
                            className="h-11 w-11 rounded-lg object-cover border border-[#2b2f38] shrink-0"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#1c212b] text-[#39FF14] shrink-0">
                            <Paperclip className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{attachmentName}</p>
                          <p className="text-[10px] font-mono text-zinc-400">
                            {attachmentSize > 0 ? `${Math.max(1, Math.round(attachmentSize / 1024))} KB` : 'Attached'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeAttachment}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/30 cursor-pointer"
                        aria-label="Remove attachment"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="support-attachment"
                      className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[#2b2f38] bg-[#14161c] px-4 py-3 text-zinc-400 hover:border-[#39FF14]/50 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-[#39FF14]" />
                        Attach screenshot or supporting file (optional)
                      </span>
                      <span className="font-mono text-[10px] uppercase text-[#39FF14]">Browse</span>
                      <input
                        ref={fileInputRef}
                        id="support-attachment"
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                    </label>
                  )}

                  {fieldErrors.attachment && (
                    <p className="mt-1 text-[11px] text-red-400">{fieldErrors.attachment}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] py-3.5 font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-[#32e010] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? 'SUBMITTING SUPPORT REQUEST...' : 'SUBMIT SUPPORT REQUEST'}
                </button>
              </form>
            )}
          </div>
        </section>

        {/* 4. FREQUENTLY ASKED QUESTIONS (EXACT Q1–Q6) */}
        <section aria-label="Frequently Asked Questions" className="max-w-4xl mx-auto space-y-5">
          <div className="space-y-1 text-center sm:text-left">
            <span className="font-mono text-[11px] uppercase tracking-widest text-[#39FF14]">
              Quick Answers
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white flex items-center justify-center sm:justify-start gap-2.5">
              <HelpCircle className="h-6 w-6 text-[#39FF14]" /> Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {SUPPORT_FAQS.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`rounded-2xl border bg-[#111317] overflow-hidden transition-all ${
                    isOpen ? 'border-[#39FF14]/45' : 'border-[#232731]'
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left text-sm font-semibold text-white hover:text-[#39FF14] transition-colors cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#8e919b] transition-transform ${
                        isOpen ? 'rotate-180 text-[#39FF14]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-2 text-xs sm:text-sm text-[#c7cbd6] leading-relaxed border-t border-[#1c1f26]">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

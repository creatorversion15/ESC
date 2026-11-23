import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, CheckCircle2, AlertCircle, FileText, Trash2, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/apiClient';
import {
  ALLOWED_PROBLEM_ATTACHMENT_TYPES,
  MAX_PROBLEM_ATTACHMENT_BYTES,
  PROBLEM_EXCHANGE_CATEGORIES,
  validateProblemSubmission,
} from '../../utils/problemExchangeLogic';
import type { ExchangeProblem } from '../../types';

interface SubmitProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: (problem: ExchangeProblem) => void;
}

export const SubmitProblemModal: React.FC<SubmitProblemModalProps> = ({
  isOpen,
  onClose,
  onSubmitted,
}) => {
  const { user, profile } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(PROBLEM_EXCHANGE_CATEGORIES[0]);
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('Pan-India');
  const [affectedUsers, setAffectedUsers] = useState('');
  const [whyItMatters, setWhyItMatters] = useState('');
  const [evidenceLinksText, setEvidenceLinksText] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');

  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentType, setAttachmentType] = useState('');
  const [attachmentDataUrl, setAttachmentDataUrl] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{
    message: string;
    problem?: ExchangeProblem;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSubmitterName((prev) => prev || profile?.fullName || user?.displayName || '');
      setSubmitterEmail((prev) => prev || profile?.email || user?.email || '');
    }
  }, [isOpen, user, profile]);

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory(PROBLEM_EXCHANGE_CATEGORIES[0]);
    setIndustry('');
    setLocation('Pan-India');
    setAffectedUsers('');
    setWhyItMatters('');
    setEvidenceLinksText('');
    setAttachmentName('');
    setAttachmentType('');
    setAttachmentDataUrl('');
    setFieldErrors({});
    setServerError(null);
    setSubmittedResult(null);
  };

  const handleClose = () => {
    if (submittedResult) {
      resetForm();
    }
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_PROBLEM_ATTACHMENT_TYPES.includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        attachment: 'Only PNG, JPG, WEBP, or PDF files are permitted.',
      }));
      return;
    }

    if (file.size > MAX_PROBLEM_ATTACHMENT_BYTES) {
      setFieldErrors((prev) => ({
        ...prev,
        attachment: 'Attachment must be 2 MB or smaller.',
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      setAttachmentName(file.name);
      setAttachmentType(file.type);
      setAttachmentDataUrl(dataUrl);
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.attachment;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const evidenceLinks = evidenceLinksText
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    const payload = {
      title,
      description,
      category,
      industry,
      location,
      affectedUsers,
      whyItMatters,
      evidenceLinks,
      attachmentName,
      attachmentType,
      attachmentDataUrl,
      submitterName,
      submitterEmail,
    };

    const validation = validateProblemSubmission(payload);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await apiRequest<{ message: string; problem: ExchangeProblem }>(
        '/api/problem-exchange/submit',
        {
          method: 'POST',
          body: payload,
        }
      );

      setSubmittedResult({
        message:
          response.message || 'THANK YOU. YOUR PROBLEM HAS BEEN SUBMITTED FOR ESC REVIEW.',
        problem: response.problem,
      });

      if (response.problem && onSubmitted) {
        onSubmitted(response.problem);
      }
    } catch (err: any) {
      setServerError(err?.message || 'Unable to submit problem right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-problem-modal-title"
      data-testid="submit-problem-modal"
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/85 p-4 sm:py-10 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-[#2a2f3b] bg-[#0f1116] p-6 sm:p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#1f232c] pb-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#39FF14]">
              ESC Problem Exchange // Community Intake
            </p>
            <h2
              id="submit-problem-modal-title"
              className="mt-1 font-display text-2xl font-extrabold text-white"
            >
              Submit a Real-World Problem
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Every submission is reviewed by the ESC Admin Desk for clarity, originality, and feasibility before appearing publicly.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close submit problem modal"
            className="rounded-lg border border-[#282d38] bg-[#161922] p-2 text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Success Confirmation View */}
        {submittedResult ? (
          <div className="py-10 text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#39FF14]/40 bg-[#39FF14]/15 text-[#39FF14]">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div className="space-y-2 max-w-xl mx-auto">
              <h3 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[#39FF14]">
                {submittedResult.message}
              </h3>
              {submittedResult.problem && (
                <p className="font-mono text-xs text-zinc-300">
                  Reference ID:{' '}
                  <strong className="text-white">{submittedResult.problem.problemCode}</strong> •
                  Status: <span className="text-amber-300">Pending Review</span>
                </p>
              )}
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed pt-1">
                Our admin desk will verify originality, assign an initial ESC Opportunity Score, and publish it once approved. Signed-in members can track and edit pending submissions in their Member Dashboard.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-[#2c313e] bg-[#161922] px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white hover:border-[#39FF14] cursor-pointer"
              >
                Submit Another Problem
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl bg-[#39FF14] px-6 py-2.5 font-display text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#32e010] cursor-pointer"
              >
                Back to Problem Exchange
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            {serverError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-800/70 bg-red-950/40 p-3.5 text-xs text-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Problem Title */}
            <div>
              <label
                htmlFor="px-submit-title"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
              >
                Problem Title <span className="text-[#39FF14]">*</span>
              </label>
              <input
                id="px-submit-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., High cold-chain spoilage for small-lot rural dairy cooperatives during power outages"
                maxLength={180}
                className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
              />
              {fieldErrors.title && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.title}</p>
              )}
            </div>

            {/* Category, Industry, Location */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="px-submit-category"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                >
                  Category (40 Domains) <span className="text-[#39FF14]">*</span>
                </label>
                <select
                  id="px-submit-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3 py-2.5 text-sm text-white focus:border-[#39FF14] focus:outline-none"
                >
                  {PROBLEM_EXCHANGE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {fieldErrors.category && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.category}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="px-submit-industry"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                >
                  Industry / Sector <span className="text-[#39FF14]">*</span>
                </label>
                <input
                  id="px-submit-industry"
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g., Dairy & Cold Logistics"
                  className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                />
                {fieldErrors.industry && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.industry}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="px-submit-location"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                >
                  Location / Geography <span className="text-[#39FF14]">*</span>
                </label>
                <input
                  id="px-submit-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Tier-2/3 India, Maharashtra"
                  className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                />
                {fieldErrors.location && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.location}</p>
                )}
              </div>
            </div>

            {/* Detailed Description */}
            <div>
              <label
                htmlFor="px-submit-description"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
              >
                Detailed Problem Description <span className="text-[#39FF14]">*</span>
              </label>
              <textarea
                id="px-submit-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what breaks in the real world, where current workflows fail, and any technical or operational bottlenecks observed..."
                className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
              />
              {fieldErrors.description && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.description}</p>
              )}
            </div>

            {/* Affected Users & Why It Matters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="px-submit-affected"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                >
                  Affected Users / Stakeholders <span className="text-[#39FF14]">*</span>
                </label>
                <textarea
                  id="px-submit-affected"
                  rows={3}
                  value={affectedUsers}
                  onChange={(e) => setAffectedUsers(e.target.value)}
                  placeholder="Who faces this problem directly? (e.g., village dairy collection centers, small-scale MSME machine shops)"
                  className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                />
                {fieldErrors.affectedUsers && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.affectedUsers}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="px-submit-why"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                >
                  Why It Matters <span className="text-[#39FF14]">*</span>
                </label>
                <textarea
                  id="px-submit-why"
                  rows={3}
                  value={whyItMatters}
                  onChange={(e) => setWhyItMatters(e.target.value)}
                  placeholder="Explain the economic, safety, sustainability, or productivity cost of leaving this problem unsolved..."
                  className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                />
                {fieldErrors.whyItMatters && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.whyItMatters}</p>
                )}
              </div>
            </div>

            {/* Evidence Links & Optional Attachment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="px-submit-links"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                >
                  Evidence / Reference Links (Optional)
                </label>
                <textarea
                  id="px-submit-links"
                  rows={2}
                  value={evidenceLinksText}
                  onChange={(e) => setEvidenceLinksText(e.target.value)}
                  placeholder="https://... (one URL per line)"
                  className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="px-submit-file"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                >
                  Supporting Image / PDF (Optional, max 2 MB)
                </label>
                {attachmentName ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[#39FF14]/40 bg-[#121a10] px-3.5 py-2.5 text-xs text-zinc-200">
                    <span className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-[#39FF14] shrink-0" />
                      <span className="truncate">{attachmentName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentName('');
                        setAttachmentType('');
                        setAttachmentDataUrl('');
                      }}
                      aria-label="Remove attachment"
                      className="text-zinc-400 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="px-submit-file"
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#343a47] bg-[#141720] px-4 py-3 text-xs text-zinc-400 hover:border-[#39FF14]/60 hover:text-white transition-colors"
                  >
                    <Upload className="h-4 w-4 text-[#39FF14]" />
                    <span>Upload PNG, JPG, WEBP, or PDF</span>
                    <input
                      id="px-submit-file"
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                )}
                {fieldErrors.attachment && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.attachment}</p>
                )}
              </div>
            </div>

            {/* Submitter Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1e222b]">
              <div>
                <label
                  htmlFor="px-submit-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                >
                  Your Name <span className="text-[#39FF14]">*</span>
                </label>
                <input
                  id="px-submit-name"
                  type="text"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                />
                {fieldErrors.submitterName && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.submitterName}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="px-submit-email"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-200 mb-1.5"
                >
                  Your Email <span className="text-[#39FF14]">*</span>
                </label>
                <input
                  id="px-submit-email"
                  type="email"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  placeholder="you@college.edu"
                  className="w-full rounded-xl border border-[#2b303c] bg-[#151821] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none"
                />
                {fieldErrors.submitterEmail && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.submitterEmail}</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#242935] bg-[#14171f] p-3 text-[11px] text-zinc-400">
              All community submissions enter <strong className="text-white">Pending Review</strong> and become publicly visible on ESC Problem Exchange only after ESC Admin approval.
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-[#2b303c] px-5 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-6 py-2.5 font-display text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#32e010] disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? 'Submitting for Review...' : 'Submit Problem for Review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};

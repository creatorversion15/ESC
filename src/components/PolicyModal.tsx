import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { buildTermsDocument, buildPrivacyDocument } from '../data/policies';
import { downloadPolicyPdf } from '../utils/policyPdfGenerator';

interface PolicyModalProps {
  policyType: 'terms' | 'privacy' | null;
  contactEmail?: string;
  onClose: () => void;
  onOpenFullPage?: (path: string) => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({
  policyType,
  contactEmail,
  onClose,
  onOpenFullPage,
}) => {
  const [downloading, setDownloading] = useState(false);

  if (!policyType) return null;

  const policy =
    policyType === 'terms'
      ? buildTermsDocument(contactEmail)
      : buildPrivacyDocument(contactEmail);

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      await downloadPolicyPdf(policy);
    } finally {
      setDownloading(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={policy.shortTitle}
    >
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#2b2f38] bg-[#0f1115] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23262d] bg-[#0b0c0e] px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#CCFF00]">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base sm:text-lg font-bold text-white truncate">
                ESC — {policy.shortTitle}
              </h3>
              <p className="font-mono text-[10px] text-[#CCFF00]">
                Version {policy.version} • Last Updated: {policy.lastUpdated}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-3.5 py-2 font-display text-[11px] font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-50 cursor-pointer"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close policy dialog"
              className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-[#1f2229] hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
          <div className="rounded-xl border border-[#232731] bg-[#14171d] px-4 py-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white">
              {policy.title}
            </p>
            <p className="text-xs text-[#9ca3af] mt-0.5">{policy.subtitle}</p>
          </div>

          <div className="space-y-3.5">
            {policy.sections.map((section) => (
              <section
                key={section.number}
                className="rounded-xl border border-[#20232c] bg-[#12141a] p-4 space-y-1.5"
              >
                <h4 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#CCFF00]/15 font-mono text-[11px] font-bold text-[#CCFF00]">
                    {section.number}
                  </span>
                  <span>{section.heading}</span>
                </h4>
                <div className="space-y-2 pl-7">
                  {section.paragraphs.map((para, idx) => (
                    <p key={idx} className="text-xs leading-relaxed text-zinc-300">
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#23262d] bg-[#0b0c0e] px-5 py-3.5">
          {onOpenFullPage ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullPage(policyType === 'terms' ? '/terms' : '/privacy');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#CCFF00] hover:underline cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Dedicated {policy.shortTitle} Page</span>
            </button>
          ) : (
            <span className="font-mono text-[11px] text-zinc-500">{policy.pdfFilename}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#2b2f38] bg-[#161920] px-4 py-2 text-xs font-semibold text-white hover:border-[#CCFF00] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

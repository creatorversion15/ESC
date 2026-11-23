import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { buildTermsDocument, buildPrivacyDocument } from '../data/policies';
import { downloadPolicyPdf } from '../utils/policyPdfGenerator';
import { apiRequest } from '../lib/apiClient';
import type { SiteSettings } from '../types';

interface LegalPolicyPageProps {
  type: 'terms' | 'privacy';
  navigate: (path: string) => void;
}

export const LegalPolicyPage: React.FC<LegalPolicyPageProps> = ({ type, navigate }) => {
  const [contactEmail, setContactEmail] = useState<string | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<SiteSettings>('/api/site-settings')
      .then((settings) => {
        if (active && settings?.contactEmail) {
          setContactEmail(settings.contactEmail);
        }
      })
      .catch(() => {
        // Fallback to default configured contact email
      });
    return () => {
      active = false;
    };
  }, []);

  const policy =
    type === 'terms'
      ? buildTermsDocument(contactEmail)
      : buildPrivacyDocument(contactEmail);

  const otherPath = type === 'terms' ? '/privacy' : '/terms';
  const otherLabel = type === 'terms' ? 'View Privacy Policy' : 'View Terms & Conditions';

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await downloadPolicyPdf(policy);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c0e] py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Top Back & Switch Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/apply')}
            className="inline-flex items-center gap-2 rounded-xl border border-[#252932] bg-[#12141a] px-3.5 py-2 text-xs font-medium text-zinc-300 hover:border-[#CCFF00]/50 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Fellowship Application</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(otherPath)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#252932] bg-[#12141a] px-3.5 py-2 text-xs font-mono text-[#CCFF00] hover:border-[#CCFF00] transition-colors cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{otherLabel}</span>
          </button>
        </div>

        {/* Branded Policy Header Card */}
        <div className="rounded-2xl border border-[#252932] bg-[#101216] overflow-hidden shadow-2xl">
          <div className="border-b border-[#39FF14]/40 bg-[#08090b] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#39FF14]/30 bg-[#39FF14]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#CCFF00]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Version {policy.version} • Updated {policy.lastUpdated}</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {policy.title}
              </h1>
              <p className="text-xs sm:text-sm text-[#9ca3af]">{policy.subtitle}</p>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#CCFF00] px-5 py-3 font-display text-xs font-bold uppercase tracking-wide text-black hover:bg-[#b8e600] shadow-lg shadow-[#CCFF00]/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>Download PDF</span>
              </button>
              <p className="mt-1.5 text-center sm:text-right font-mono text-[10px] text-zinc-500">
                {policy.pdfFilename}
              </p>
            </div>
          </div>

          {/* Numbered Policy Sections */}
          <div className="p-6 sm:p-8 space-y-5">
            {policy.sections.map((section) => (
              <section
                key={section.number}
                className="rounded-xl border border-[#1f222a] bg-[#13161c] p-5 space-y-2"
              >
                <h2 className="font-display text-base font-bold text-white flex items-center gap-2.5">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black border border-[#39FF14]/40 font-mono text-xs font-bold text-[#CCFF00]">
                    {section.number}
                  </span>
                  <span>
                    {section.number}. {section.heading}
                  </span>
                </h2>
                <div className="space-y-2.5 pl-8">
                  {section.paragraphs.map((para, idx) => (
                    <p key={idx} className="text-xs sm:text-sm leading-relaxed text-zinc-300">
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            ))}

            {/* Bottom Action Bar */}
            <div className="pt-4 border-t border-[#1e212a] flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="font-mono text-[11px] text-zinc-500">
                Engineering Startup Company (ESC) • Policy v{policy.version} • {policy.lastUpdated}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-xl border border-[#CCFF00]/40 bg-[#CCFF00]/10 px-4 py-2 text-xs font-display font-bold uppercase text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black transition-all cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download {policy.pdfFilename}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

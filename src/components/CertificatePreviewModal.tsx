import React, { useState } from 'react';
import {
  X,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import type { CertificateRecord, CertificateSettings } from '../types';
import { CertificateSheet, CertificatePrintPortal, triggerA4LandscapePrint } from './CertificateSheet';
import { downloadCertificatePdf } from '../utils/certificatePdf';
import { resolveCertificateRenderData } from '../utils/escLogic';

interface CertificatePreviewModalProps {
  certificate: Partial<CertificateRecord> | null;
  settings?: Partial<CertificateSettings> | null;
  isOpen: boolean;
  onClose: () => void;
  onDownloaded?: (certId: string, filename: string) => Promise<void> | void;
  onNavigateVerify?: (certId: string) => void;
}

export const CertificatePreviewModal: React.FC<CertificatePreviewModalProps> = ({
  certificate,
  settings,
  isOpen,
  onClose,
  onDownloaded,
  onNavigateVerify,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [printingActive, setPrintingActive] = useState(false);

  if (!isOpen || !certificate) return null;

  const resolved = resolveCertificateRenderData(
    certificate,
    settings,
    typeof window !== 'undefined' ? window.location.origin : 'https://esc.community'
  );

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      setFeedback(null);
      const { filename, byteSize } = await downloadCertificatePdf(certificate, settings);
      await onDownloaded?.(resolved.certId, filename);
      setFeedback({
        type: 'success',
        message: `Downloaded ${filename} (${Math.round(byteSize / 1024)} KB PDF verified).`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to generate or download PDF certificate.',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    setFeedback(null);
    setPrintingActive(true);
    window.setTimeout(() => {
      triggerA4LandscapePrint(() => setPrintingActive(false));
    }, 60);
  };

  return (
    <>
      <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
        <div className="relative w-full max-w-5xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-5 sm:p-6 shadow-2xl my-6 space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#23262d] pb-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-mono text-[11px] text-[#CCFF00] uppercase">
                <ShieldCheck className="h-4 w-4" /> Full-Size A4 Landscape Certificate Preview
              </div>
              <h3 className="font-display text-lg font-bold text-white">
                {resolved.studentName || 'Preview Certificate'} —{' '}
                <span className="font-mono text-sm text-[#CCFF00]">{resolved.certId}</span>
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-50 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                {downloading ? 'Building PDF...' : 'Download PDF'}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-xl border border-[#2f3542] bg-[#161922] px-4 py-2 text-xs font-mono font-semibold text-white hover:border-[#CCFF00] hover:text-[#CCFF00] cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Print Certificate
              </button>

              {onNavigateVerify && certificate.id && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateVerify(resolved.certId);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-[#2f3542] px-3 py-2 text-xs font-mono text-zinc-300 hover:text-white cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Verify URL
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close Preview"
                className="rounded-lg p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={`rounded-xl border px-4 py-2.5 text-xs flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'border-[#CCFF00]/40 bg-[#CCFF00]/10 text-[#CCFF00]'
                  : 'border-red-800 bg-red-950/40 text-red-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Live Certificate Sheet */}
          <div className="rounded-xl border border-[#232731] bg-[#08090c] p-2 sm:p-4">
            <CertificateSheet certificate={certificate} settings={settings} />
          </div>

          {/* Audit Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-mono text-zinc-400 border-t border-[#1e212a] pt-3">
            <div>
              <span className="block text-zinc-500 uppercase text-[10px]">Issuer</span>
              <span className="text-white font-semibold">{resolved.authorizedSigner}</span>
            </div>
            <div>
              <span className="block text-zinc-500 uppercase text-[10px]">Designation</span>
              <span className="text-zinc-200">{resolved.authorizedSignerTitle}</span>
            </div>
            <div>
              <span className="block text-zinc-500 uppercase text-[10px]">Template</span>
              <span className="text-[#CCFF00] uppercase">{resolved.templateStyle.replace('_', ' ')}</span>
            </div>
            <div>
              <span className="block text-zinc-500 uppercase text-[10px]">Issue Date</span>
              <span className="text-white">{resolved.issueDate}</span>
            </div>
          </div>
        </div>
      </div>

      {printingActive && <CertificatePrintPortal certificate={certificate} settings={settings} />}
    </>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Download,
  Printer,
  Eye,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CertificateRecord, CertificateSettings } from '../types';
import {
  DEFAULT_CERTIFICATE_SETTINGS,
  resolveCertificateRenderData,
} from '../utils/escLogic';
import { downloadCertificatePdf } from '../utils/certificatePdf';
import {
  CertificateSheet,
  CertificatePrintPortal,
  triggerA4LandscapePrint,
} from '../components/CertificateSheet';
import { CertificatePreviewModal } from '../components/CertificatePreviewModal';
import { DigitalMemberCardSection } from '../components/DigitalMemberCardSection';
import { OrderPhysicalCardSection } from '../components/OrderPhysicalCardSection';

interface VerifyCertificateProps {
  navigate: (path: string) => void;
}

export const VerifyCertificate: React.FC<VerifyCertificateProps> = ({ navigate }) => {
  const [certIdInput, setCertIdInput] = useState('');
  const [certificate, setCertificate] = useState<CertificateRecord | null>(null);
  const [certSettings, setCertSettings] = useState<CertificateSettings>(DEFAULT_CERTIFICATE_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [printingActive, setPrintingActive] = useState(false);
  const [memberIdFromQuery, setMemberIdFromQuery] = useState<string | null>(null);

  // Load Super Admin certificate defaults + check URL query params (?id=... and ?member=...)
  useEffect(() => {
    getDoc(doc(db, 'certificateSettings', 'default'))
      .then((snap) => {
        if (snap.exists()) {
          setCertSettings({
            ...DEFAULT_CERTIFICATE_SETTINGS,
            ...(snap.data() as Partial<CertificateSettings>),
          });
        }
      })
      .catch(() => {});

    const syncQueryParams = () => {
      let idFromQuery: string | null = null;
      let memberParam: string | null = null;

      if (window.location.search) {
        const sp = new URLSearchParams(window.location.search);
        idFromQuery = sp.get('id');
        memberParam = sp.get('member');
      }
      if (window.location.hash.includes('?')) {
        const queryString = window.location.hash.split('?')[1];
        const hp = new URLSearchParams(queryString);
        if (!idFromQuery) idFromQuery = hp.get('id');
        if (!memberParam) memberParam = hp.get('member');
      }
      if (idFromQuery) {
        setCertIdInput(idFromQuery);
        verifyCertificateById(idFromQuery);
      }
      if (memberParam) {
        setMemberIdFromQuery(memberParam.trim().toUpperCase());
      }
    };

    syncQueryParams();
    window.addEventListener('hashchange', syncQueryParams);
    return () => window.removeEventListener('hashchange', syncQueryParams);
  }, []);

  const verifyCertificateById = async (id: string) => {
    const cleanId = id.trim().toUpperCase();
    if (!cleanId) return;

    try {
      setLoading(true);
      setError(null);
      setActionFeedback(null);

      // Check by doc ID or certId field in Firestore
      const certRef = doc(db, 'certificates', cleanId);
      const snap = await getDoc(certRef);

      if (snap.exists()) {
        setCertificate({ id: snap.id, ...snap.data() } as CertificateRecord);
      } else {
        const q = query(collection(db, 'certificates'), where('certId', '==', cleanId));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          setCertificate({ id: qSnap.docs[0].id, ...qSnap.docs[0].data() } as CertificateRecord);
        } else {
          // Fall back to initial sample certificates
          const { INITIAL_CERTIFICATES } = await import('../lib/seedData');
          const found = INITIAL_CERTIFICATES.find((c) => c.certId.toUpperCase() === cleanId);
          if (found) {
            setCertificate({ id: found.certId, ...found });
          } else {
            setCertificate(null);
            setError(`No certificate found matching ID: ${cleanId}. Please check the identification code.`);
          }
        }
      }
    } catch (err) {
      console.error(err);
      const { INITIAL_CERTIFICATES } = await import('../lib/seedData');
      const found = INITIAL_CERTIFICATES.find((c) => c.certId.toUpperCase() === cleanId);
      if (found) {
        setCertificate({ id: found.certId, ...found });
      } else {
        setError('Error communicating with verification registry.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    verifyCertificateById(certIdInput);
  };

  const handleDownloadPdf = async () => {
    if (!certificate) return;
    try {
      setDownloadingPdf(true);
      setActionFeedback(null);
      const { filename, byteSize } = await downloadCertificatePdf(certificate, certSettings);
      setActionFeedback({
        type: 'success',
        message: `Certificate PDF verified and downloaded: ${filename} (${Math.round(byteSize / 1024)} KB).`,
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Failed to generate or download certificate PDF.',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    if (!certificate) return;
    setActionFeedback(null);
    setPrintingActive(true);
    window.setTimeout(() => {
      triggerA4LandscapePrint(() => setPrintingActive(false));
    }, 80);
  };

  const resolved = certificate
    ? resolveCertificateRenderData(
        certificate,
        certSettings,
        typeof window !== 'undefined' ? window.location.origin : 'https://esc.community'
      )
    : null;

  return (
    <div className="min-h-screen bg-[#0b0c0e] py-16 px-4 sm:px-6 lg:px-8">
      <div className="no-print mx-auto max-w-5xl space-y-10">
        {/* Header & 3-Section Quick Navigator */}
        <div id="verify-certificate" className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2b2f38] bg-[#14161c] px-3.5 py-1 text-xs font-mono text-[#CCFF00]">
            <ShieldCheck className="h-3.5 w-3.5" /> Section 1 · ESC Cryptographic Registry
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-black text-white">
            Certificate &amp; Credential Verification
          </h1>
          <p className="text-xs sm:text-sm text-[#9ca3af] max-w-xl mx-auto">
            Verify official ESC certificates, generate your ESC Digital Member Card, or order your physical ESC Member Card with pan-India home delivery.
          </p>

          <div
            data-testid="verify-page-sections-nav"
            className="flex flex-wrap items-center justify-center gap-2 pt-1"
          >
            <button
              type="button"
              onClick={() =>
                document.getElementById('verify-certificate')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl border border-[#2b303c] bg-[#14171f] px-3.5 py-2 font-mono text-[11px] font-semibold text-zinc-200 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors cursor-pointer"
            >
              1. Verify Certificate
            </button>
            <button
              type="button"
              onClick={() =>
                document.getElementById('digital-member-card')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl border border-[#2b303c] bg-[#14171f] px-3.5 py-2 font-mono text-[11px] font-semibold text-zinc-200 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors cursor-pointer"
            >
              2. ESC Digital Member Card
            </button>
            <button
              type="button"
              onClick={() =>
                document.getElementById('order-physical-card')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="rounded-xl border border-[#39FF14]/45 bg-[#0f1710] px-3.5 py-2 font-mono text-[11px] font-bold text-[#39FF14] hover:bg-[#39FF14] hover:text-black transition-colors cursor-pointer"
            >
              3. Order Physical Member Card – Home Delivery
            </button>
          </div>
        </div>

        {/* Verification Search Bar */}
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-6 max-w-2xl mx-auto space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8e919b]" />
              <input
                type="text"
                value={certIdInput}
                onChange={(e) => setCertIdInput(e.target.value)}
                placeholder="Enter Certificate ID (e.g. ESC-2026-HW01)"
                required
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none uppercase font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto rounded-xl bg-[#CCFF00] px-6 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-[#b8e600] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8e919b] pt-1">
            <span>Demo sample IDs to test:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCertIdInput('ESC-2026-HW01');
                  verifyCertificateById('ESC-2026-HW01');
                }}
                className="font-mono text-[#CCFF00] hover:underline cursor-pointer"
              >
                ESC-2026-HW01
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  setCertIdInput('ESC-2026-BD42');
                  verifyCertificateById('ESC-2026-BD42');
                }}
                className="font-mono text-[#CCFF00] hover:underline cursor-pointer"
              >
                ESC-2026-BD42
              </button>
            </div>
          </div>
        </div>

        {/* Verification Error */}
        {error && (
          <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-6 text-center text-xs text-red-200 max-w-xl mx-auto space-y-2">
            <AlertCircle className="h-6 w-6 text-red-400 mx-auto" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* Verification Result */}
        {certificate && resolved && (
          <div className="rounded-2xl border border-[#CCFF00]/40 bg-[#0d0f13] p-5 sm:p-8 shadow-2xl space-y-6 animate-in fade-in duration-200">
            {/* Top Status & Action Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#232731] pb-5">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    certificate.status === 'valid'
                      ? 'bg-[#CCFF00]/10 text-[#CCFF00]'
                      : 'bg-red-950/60 text-red-400'
                  }`}
                >
                  {certificate.status === 'valid' ? (
                    <CheckCircle2 className="h-7 w-7" />
                  ) : (
                    <XCircle className="h-7 w-7" />
                  )}
                </div>
                <div>
                  <span
                    className={`font-mono text-[10px] uppercase font-bold tracking-wider block ${
                      certificate.status === 'valid' ? 'text-[#CCFF00]' : 'text-red-400'
                    }`}
                  >
                    {certificate.status === 'valid'
                      ? 'CRYPTOGRAPHICALLY VERIFIED CREDENTIAL'
                      : 'REVOKED CREDENTIAL RECORD'}
                  </span>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                    {resolved.certificateTitle} — {resolved.studentName}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 font-mono text-xs font-semibold border ${
                    certificate.status === 'valid'
                      ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400'
                      : 'bg-red-950/60 border-red-800/60 text-red-400'
                  }`}
                >
                  STATUS: {certificate.status.toUpperCase()}
                </span>

                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#14161c] px-3.5 py-2 text-xs font-mono text-zinc-200 hover:border-[#CCFF00] hover:text-white cursor-pointer"
                >
                  <Eye className="h-4 w-4" /> Preview Certificate
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  data-testid="verify-download-pdf"
                  className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-50 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  data-testid="verify-print-cert"
                  className="flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#14161c] px-3.5 py-2 text-xs font-mono text-zinc-200 hover:border-[#CCFF00] hover:text-[#CCFF00] cursor-pointer"
                >
                  <Printer className="h-4 w-4" /> Print Certificate
                </button>
              </div>
            </div>

            {actionFeedback && (
              <div
                data-testid="verify-pdf-feedback"
                className={`rounded-xl border px-4 py-3 text-xs flex items-center gap-2 ${
                  actionFeedback.type === 'success'
                    ? 'border-[#CCFF00]/40 bg-[#CCFF00]/10 text-[#CCFF00]'
                    : 'border-red-800 bg-red-950/40 text-red-300'
                }`}
              >
                {actionFeedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{actionFeedback.message}</span>
              </div>
            )}

            {/* Official A4 Landscape Certificate Rendering */}
            <CertificateSheet certificate={certificate} settings={certSettings} />

            {/* Cryptographic Registry Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-[#20242e] bg-[#12151b] p-4 text-xs">
              <div>
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Certificate ID</span>
                <span className="font-mono font-bold text-white">{resolved.certId}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Verification Hash</span>
                <span className="font-mono font-bold text-[#CCFF00]">{resolved.verificationHash}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Authorized Signer</span>
                <span className="font-semibold text-white">{resolved.authorizedSigner}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase text-zinc-500 block">Issue Date</span>
                <span className="font-semibold text-white">{resolved.issueDate}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                ESC does not confer degree or governmental accreditation. This record verifies authenticated student engineering deliverables and competition milestones within the independent ESC ecosystem.
              </p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-[#CCFF00] shrink-0 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Return Home
              </button>
            </div>
          </div>
        )}

        {/* Section 2: ESC Digital Member Card & Live Member ID Verification */}
        <DigitalMemberCardSection initialMemberId={memberIdFromQuery} navigate={navigate} />

        {/* Section 3: Order Physical Member Card – Home Delivery */}
        <OrderPhysicalCardSection navigate={navigate} />
      </div>

      {/* Full-Size Preview Modal */}
      <CertificatePreviewModal
        certificate={certificate}
        settings={certSettings}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      {/* A4 Landscape Print Portal */}
      {printingActive && certificate && (
        <CertificatePrintPortal certificate={certificate} settings={certSettings} />
      )}
    </div>
  );
};

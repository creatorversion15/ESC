import React, { useState, useEffect } from 'react';
import {
  Award,
  Download,
  Printer,
  Eye,
  Plus,
  Settings,
  CheckCircle2,
  AlertCircle,
  Archive,
  Upload,
  Sparkles,
  Search,
  Users,
  CheckSquare,
  Square,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { doc, setDoc, updateDoc, collection } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { db } from '../../lib/firebase';
import type {
  CertificateRecord,
  CertificateSettings,
  CertificateTemplateStyle,
  UserProfile,
} from '../../types';
import {
  DEFAULT_CERTIFICATE_LOGO,
  DEFAULT_CERTIFICATE_SETTINGS,
  formatCertificateId,
  generateCertificateHash,
  resolveCertificateRenderData,
} from '../../utils/escLogic';
import {
  downloadCertificatePdf,
  downloadBulkCertificatesZip,
  processAndUploadCertificateAsset,
  buildCertificatePdfBlob,
} from '../../utils/certificatePdf';
import { CertificatePreviewModal } from '../CertificatePreviewModal';
import { CertificatePrintPortal, CertificateSheet, triggerA4LandscapePrint } from '../CertificateSheet';

interface CertificateManagementSectionProps {
  certificates: CertificateRecord[];
  setCertificates: React.Dispatch<React.SetStateAction<CertificateRecord[]>>;
  usersList: UserProfile[];
  certSettings: CertificateSettings;
  setCertSettings: React.Dispatch<React.SetStateAction<CertificateSettings>>;
  isSuperAdmin: boolean;
  adminEmail: string;
  onNotify: (type: 'success' | 'error', text: string) => void;
  onLogAdminAction: (action: string, targetType: string, targetId: string, details: string) => Promise<void>;
  onCreateNotification: (recipientId: string, title: string, message: string) => Promise<void>;
  onRequestRevoke: (cert: CertificateRecord) => void;
  onNavigateVerify: (certId: string) => void;
}

type CertSubTab = 'issued' | 'generator' | 'settings';

export const CertificateManagementSection: React.FC<CertificateManagementSectionProps> = ({
  certificates,
  setCertificates,
  usersList,
  certSettings,
  setCertSettings,
  isSuperAdmin,
  adminEmail,
  onNotify,
  onLogAdminAction,
  onCreateNotification,
  onRequestRevoke,
  onNavigateVerify,
}) => {
  const [subTab, setSubTab] = useState<CertSubTab>('issued');

  // --- Issued Certificates State & Bulk Selection ---
  const [certSearch, setCertSearch] = useState('');
  const [certFilter, setCertFilter] = useState<'all' | 'valid' | 'revoked' | 'downloaded' | 'pending_download'>('all');
  const [selectedCertIds, setSelectedCertIds] = useState<string[]>([]);
  const [busyCertId, setBusyCertId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // --- Preview & Print State ---
  const [previewCert, setPreviewCert] = useState<Partial<CertificateRecord> | null>(null);
  const [printTargetCert, setPrintTargetCert] = useState<Partial<CertificateRecord> | null>(null);

  // --- Generator State (Single + Multi-Participant Batch) ---
  const [genMode, setGenMode] = useState<'single' | 'bulk'>('single');
  const [singleUserId, setSingleUserId] = useState('');
  const [singleName, setSingleName] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [customCertId, setCustomCertId] = useState('');

  const [bulkUserSearch, setBulkUserSearch] = useState('');
  const [selectedBulkUserIds, setSelectedBulkUserIds] = useState<string[]>([]);
  const [manualBulkRows, setManualBulkRows] = useState('');

  const [certTitle, setCertTitle] = useState(certSettings.defaultCertificateTitle);
  const [competitionName, setCompetitionName] = useState(certSettings.defaultCompetitionName);
  const [achievement, setAchievement] = useState('1st Place — Engineering Innovation & Execution');
  const [issueDate, setIssueDate] = useState(
    certSettings.defaultIssueDate ||
      new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  );
  const [templateStyle, setTemplateStyle] = useState<CertificateTemplateStyle>(certSettings.backgroundTemplate);
  const [issuerName, setIssuerName] = useState(certSettings.issuerName);
  const [issuerDesignation, setIssuerDesignation] = useState(certSettings.issuerDesignation);
  const [organizationName, setOrganizationName] = useState(certSettings.organizationName);
  const [generating, setGenerating] = useState(false);

  // --- Settings Draft State ---
  const [settingsDraft, setSettingsDraft] = useState<CertificateSettings>(certSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<'logo' | 'signature' | null>(null);

  // Keep generator & settings draft synchronized when settings load/save
  useEffect(() => {
    setSettingsDraft(certSettings);
    setCertTitle(certSettings.defaultCertificateTitle || DEFAULT_CERTIFICATE_SETTINGS.defaultCertificateTitle);
    setCompetitionName(certSettings.defaultCompetitionName || DEFAULT_CERTIFICATE_SETTINGS.defaultCompetitionName);
    setTemplateStyle(certSettings.backgroundTemplate || 'charcoal_editorial');
    setIssuerName(certSettings.issuerName || DEFAULT_CERTIFICATE_SETTINGS.issuerName);
    setIssuerDesignation(certSettings.issuerDesignation || DEFAULT_CERTIFICATE_SETTINGS.issuerDesignation);
    setOrganizationName(certSettings.organizationName || DEFAULT_CERTIFICATE_SETTINGS.organizationName);
    if (certSettings.defaultIssueDate) {
      setIssueDate(certSettings.defaultIssueDate);
    }
  }, [certSettings]);

  const markCertificatesDownloaded = async (certIds: string[]) => {
    const now = new Date().toISOString();
    setCertificates((prev) =>
      prev.map((c) =>
        certIds.includes(c.certId)
          ? { ...c, downloadedAt: now, downloadCount: (c.downloadCount || 0) + 1 }
          : c
      )
    );

    await Promise.allSettled(
      certIds.map(async (cid) => {
        const existing = certificates.find((c) => c.certId === cid);
        await updateDoc(doc(db, 'certificates', cid), {
          downloadedAt: now,
          downloadCount: (existing?.downloadCount || 0) + 1,
        });
      })
    );
  };

  const handleDownloadSinglePdf = async (cert: CertificateRecord) => {
    try {
      setBusyCertId(cert.certId);
      const { filename } = await downloadCertificatePdf(cert, certSettings);
      await markCertificatesDownloaded([cert.certId]);
      await onLogAdminAction('CERTIFICATE_PDF_DOWNLOADED', 'Certificate', cert.certId, `Downloaded ${filename}`);
      onNotify('success', `Downloaded ${filename}`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to generate or download certificate PDF.');
    } finally {
      setBusyCertId(null);
    }
  };

  const handlePrintCertificate = (cert: Partial<CertificateRecord>) => {
    setPrintTargetCert(cert);
    window.setTimeout(() => {
      triggerA4LandscapePrint(() => setPrintTargetCert(null));
    }, 100);
  };

  const handleBulkZipDownload = async () => {
    const chosen = certificates.filter((c) => selectedCertIds.includes(c.certId));
    if (chosen.length === 0) {
      onNotify('error', 'Select at least one certificate first.');
      return;
    }

    try {
      setBulkBusy(true);
      setBulkProgress({ done: 0, total: chosen.length });
      const res = await downloadBulkCertificatesZip(chosen, certSettings, undefined, (done, total) => {
        setBulkProgress({ done, total });
      });
      await markCertificatesDownloaded(chosen.map((c) => c.certId));
      await onLogAdminAction(
        'CERTIFICATES_BULK_ZIP_DOWNLOADED',
        'Certificate',
        'bulk',
        `Downloaded ZIP (${res.zipFilename}) with ${res.count} certificates`
      );
      onNotify('success', `Bulk ZIP downloaded: ${res.zipFilename} (${res.count} PDFs).`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to generate bulk ZIP archive.');
    } finally {
      setBulkBusy(false);
      setBulkProgress(null);
    }
  };

  const handleBulkIndividualDownload = async () => {
    const chosen = certificates.filter((c) => selectedCertIds.includes(c.certId));
    if (chosen.length === 0) {
      onNotify('error', 'Select at least one certificate first.');
      return;
    }

    try {
      setBulkBusy(true);
      setBulkProgress({ done: 0, total: chosen.length });
      const succeededIds: string[] = [];
      for (let i = 0; i < chosen.length; i++) {
        const cert = chosen[i];
        await downloadCertificatePdf(cert, certSettings);
        succeededIds.push(cert.certId);
        setBulkProgress({ done: i + 1, total: chosen.length });
        // Slight delay between downloads so browser does not throttle multi-file prompts
        await new Promise((r) => window.setTimeout(r, 300));
      }
      await markCertificatesDownloaded(succeededIds);
      onNotify('success', `Downloaded ${succeededIds.length} individual PDF certificates.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Individual bulk download encountered an error.');
    } finally {
      setBulkBusy(false);
      setBulkProgress(null);
    }
  };

  // --- Build Draft Certificate for Preview Before Issuing ---
  const buildDraftCertificateObject = (
    name: string,
    email: string,
    uid: string,
    certIdOverride?: string,
    seq: number = 1
  ): CertificateRecord => {
    const existingIds = new Set(certificates.map((c) => c.certId));
    const certId =
      (certIdOverride || '').trim().toUpperCase() ||
      formatCertificateId(certSettings.certIdFormat, new Date().getFullYear(), existingIds, seq);

    const effDate =
      issueDate.trim() ||
      new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const studentUid = uid.trim() || `ESC-STU-${Math.floor(1000 + Math.random() * 9000)}`;
    const verificationHash = generateCertificateHash(certId, studentUid, effDate);
    const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://esc.community';

    const resolved = resolveCertificateRenderData(
      {
        certId,
        studentId: studentUid,
        studentName: name.trim(),
        studentEmail: email.trim(),
        certificateTitle: certTitle.trim(),
        competitionName: competitionName.trim(),
        achievement: achievement.trim(),
        activityName: `${competitionName.trim()} — ${achievement.trim()}`,
        organization: organizationName.trim(),
        issueDate: effDate,
        authorizedSigner: issuerName.trim(),
        authorizedSignerTitle: issuerDesignation.trim(),
        logoUrl: certSettings.logoUrl,
        signatureUrl: certSettings.signatureUrl,
        templateStyle,
        verificationHash,
        status: 'valid',
      },
      certSettings,
      originUrl
    );

    return {
      id: resolved.certId,
      certId: resolved.certId,
      studentId: resolved.studentId,
      studentName: resolved.studentName,
      studentEmail: resolved.studentEmail,
      certificateTitle: resolved.certificateTitle,
      competitionName: resolved.competitionName,
      achievement: resolved.achievement,
      activityName: resolved.activityName,
      organization: resolved.organization,
      issueDate: resolved.issueDate,
      authorizedSigner: resolved.authorizedSigner,
      authorizedSignerTitle: resolved.authorizedSignerTitle,
      logoUrl: resolved.logoUrl,
      signatureUrl: resolved.signatureUrl,
      templateStyle: resolved.templateStyle,
      verificationHash: resolved.verificationHash,
      verificationUrl: resolved.verificationUrl,
      status: 'valid',
      downloadCount: 0,
      createdAt: new Date().toISOString(),
    };
  };

  const handleSelectSingleUser = (uid: string) => {
    setSingleUserId(uid);
    const u = usersList.find((item) => item.userId === uid);
    if (u) {
      setSingleName(u.fullName);
      setSingleEmail(u.email);
    }
  };

  const parseBulkParticipants = (): { name: string; email: string; uid: string }[] => {
    const list: { name: string; email: string; uid: string }[] = [];
    for (const uid of selectedBulkUserIds) {
      const u = usersList.find((item) => item.userId === uid);
      if (u) {
        list.push({ name: u.fullName, email: u.email, uid: u.userId });
      }
    }
    const lines = manualBulkRows
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim());
      if (parts[0]) {
        list.push({
          name: parts[0],
          email: parts[1] || '',
          uid: `ESC-EXT-${Math.floor(1000 + Math.random() * 9000)}`,
        });
      }
    }
    return list;
  };

  const handlePreviewBeforeIssue = () => {
    if (genMode === 'single') {
      if (!singleName.trim()) {
        onNotify('error', 'Enter a participant full name before previewing.');
        return;
      }
      const draft = buildDraftCertificateObject(singleName, singleEmail, singleUserId, customCertId, 1);
      setPreviewCert(draft);
    } else {
      const participants = parseBulkParticipants();
      if (participants.length === 0) {
        onNotify('error', 'Select at least one registered user or add participant names first.');
        return;
      }
      const first = participants[0];
      const draft = buildDraftCertificateObject(first.name, first.email, first.uid, undefined, 1);
      setPreviewCert(draft);
    }
  };

  const handleIssueCertificates = async (action: 'save_only' | 'save_and_download') => {
    if (!issuerName.trim() || !issuerDesignation.trim()) {
      onNotify('error', 'Issuer name and designation cannot be blank.');
      return;
    }

    const targets =
      genMode === 'single'
        ? singleName.trim()
          ? [{ name: singleName.trim(), email: singleEmail.trim(), uid: singleUserId.trim() }]
          : []
        : parseBulkParticipants();

    if (targets.length === 0) {
      onNotify('error', 'Provide at least one participant full name.');
      return;
    }

    try {
      setGenerating(true);
      const createdRecords: CertificateRecord[] = [];
      const existingIds = new Set(certificates.map((c) => c.certId));

      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const draft = buildDraftCertificateObject(
          t.name,
          t.email,
          t.uid,
          genMode === 'single' ? customCertId : undefined,
          certificates.length + i + 1
        );

        // Ensure uniqueness within same batch
        while (existingIds.has(draft.certId)) {
          draft.certId = formatCertificateId(certSettings.certIdFormat, new Date().getFullYear(), existingIds, i + 2);
          draft.id = draft.certId;
          draft.verificationHash = generateCertificateHash(draft.certId, draft.studentId, draft.issueDate);
          const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://esc.community';
          draft.verificationUrl = `${originUrl}/#/verify?id=${encodeURIComponent(draft.certId)}`;
        }
        existingIds.add(draft.certId);

        // Mandatory PDF pre-check BEFORE marking issued if save_and_download requested
        if (action === 'save_and_download') {
          await buildCertificatePdfBlob(draft, certSettings);
        }

        await setDoc(doc(db, 'certificates', draft.certId), draft);
        createdRecords.push(draft);

        if (t.uid && !t.uid.startsWith('ESC-EXT-')) {
          await onCreateNotification(
            t.uid,
            'Official ESC Certificate Issued',
            `You have been awarded "${draft.certificateTitle}" (${draft.certId}) for ${draft.competitionName}.`
          );
        }
      }

      await onLogAdminAction(
        'CERTIFICATES_ISSUED',
        'Certificate',
        createdRecords.map((r) => r.certId).join(','),
        `Issued ${createdRecords.length} certificate(s): ${createdRecords.map((r) => r.studentName).join(', ')}`
      );

      if (action === 'save_and_download') {
        if (createdRecords.length === 1) {
          await downloadCertificatePdf(createdRecords[0], certSettings);
          createdRecords[0].downloadedAt = new Date().toISOString();
          createdRecords[0].downloadCount = 1;
          await updateDoc(doc(db, 'certificates', createdRecords[0].certId), {
            downloadedAt: createdRecords[0].downloadedAt,
            downloadCount: 1,
          });
        } else {
          await downloadBulkCertificatesZip(createdRecords, certSettings);
          const now = new Date().toISOString();
          for (const rec of createdRecords) {
            rec.downloadedAt = now;
            rec.downloadCount = 1;
            await updateDoc(doc(db, 'certificates', rec.certId), { downloadedAt: now, downloadCount: 1 });
          }
        }
      }

      setCertificates((prev) => [...createdRecords, ...prev]);
      confetti({
        particleCount: 65,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#CCFF00', '#ffffff'],
      });

      // Reset participant selection & jump back to Issued view with new IDs selected
      setSingleUserId('');
      setSingleName('');
      setSingleEmail('');
      setCustomCertId('');
      setSelectedBulkUserIds([]);
      setManualBulkRows('');
      setSelectedCertIds(createdRecords.map((c) => c.certId));
      setSubTab('issued');

      onNotify(
        'success',
        action === 'save_and_download'
          ? `Issued ${createdRecords.length} certificate(s) and verified PDF download.`
          : `Issued and saved ${createdRecords.length} certificate(s) to Firebase.`
      );
    } catch (err: any) {
      onNotify('error', err?.message || 'Certificate generation or PDF creation failed.');
    } finally {
      setGenerating(false);
    }
  };

  // --- Super Admin Asset Uploads & Settings Persistence ---
  const handleAssetFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingAsset(kind);
      const { url, storedInCloud } = await processAndUploadCertificateAsset(file, kind);
      setSettingsDraft((prev) => ({
        ...prev,
        [kind === 'logo' ? 'logoUrl' : 'signatureUrl']: url,
      }));
      onNotify(
        'success',
        `${kind === 'logo' ? 'ESC Logo' : 'Authorized Signature'} loaded (${storedInCloud ? 'Cloud Storage' : 'Embedded PNG'}). Click Save Certificate Settings to persist.`
      );
    } catch (err: any) {
      onNotify('error', err?.message || `Failed to process ${kind} image.`);
    } finally {
      setUploadingAsset(null);
      e.target.value = '';
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      onNotify('error', 'Only Super Admin can update global certificate settings.');
      return;
    }
    if (!settingsDraft.issuerName.trim() || !settingsDraft.issuerDesignation.trim()) {
      onNotify('error', 'Issuer name and designation are required.');
      return;
    }

    try {
      setSavingSettings(true);
      const payload: CertificateSettings = {
        ...settingsDraft,
        id: 'default',
        organizationName: settingsDraft.organizationName.trim() || DEFAULT_CERTIFICATE_SETTINGS.organizationName,
        issuerName: settingsDraft.issuerName.trim(),
        issuerDesignation: settingsDraft.issuerDesignation.trim(),
        logoUrl: settingsDraft.logoUrl.trim() || DEFAULT_CERTIFICATE_LOGO,
        signatureUrl: settingsDraft.signatureUrl.trim(),
        defaultCertificateTitle:
          settingsDraft.defaultCertificateTitle.trim() || DEFAULT_CERTIFICATE_SETTINGS.defaultCertificateTitle,
        defaultCompetitionName:
          settingsDraft.defaultCompetitionName.trim() || DEFAULT_CERTIFICATE_SETTINGS.defaultCompetitionName,
        defaultIssueDate: settingsDraft.defaultIssueDate.trim(),
        certIdFormat: settingsDraft.certIdFormat.trim() || 'ESC-{YYYY}-{XXXX}',
        updatedAt: new Date().toISOString(),
        updatedBy: adminEmail,
      };

      await setDoc(doc(db, 'certificateSettings', 'default'), payload, { merge: true });
      setCertSettings(payload);
      await onLogAdminAction(
        'CERTIFICATE_SETTINGS_UPDATED',
        'CertificateSettings',
        'default',
        `Updated default issuer (${payload.issuerName} • ${payload.issuerDesignation}) & template (${payload.backgroundTemplate})`
      );
      onNotify('success', 'Super Admin Certificate Settings saved to Firebase.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save certificate settings to Firebase.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Filtered issued certificates
  const filteredCertificates = certificates.filter((c) => {
    if (certFilter === 'valid' && c.status !== 'valid') return false;
    if (certFilter === 'revoked' && c.status !== 'revoked') return false;
    if (certFilter === 'downloaded' && !(c.downloadCount && c.downloadCount > 0)) return false;
    if (certFilter === 'pending_download' && c.downloadCount && c.downloadCount > 0) return false;
    if (certSearch.trim()) {
      const q = certSearch.toLowerCase();
      return (
        c.certId?.toLowerCase().includes(q) ||
        c.studentName?.toLowerCase().includes(q) ||
        c.studentEmail?.toLowerCase().includes(q) ||
        c.activityName?.toLowerCase().includes(q) ||
        c.competitionName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredBulkUsers = usersList.filter((u) => {
    if (!bulkUserSearch.trim()) return true;
    const q = bulkUserSearch.toLowerCase();
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.branch?.toLowerCase().includes(q)
    );
  });

  const allVisibleSelected =
    filteredCertificates.length > 0 &&
    filteredCertificates.every((c) => selectedCertIds.includes(c.certId));

  const toggleSelectCert = (certId: string) => {
    setSelectedCertIds((prev) =>
      prev.includes(certId) ? prev.filter((id) => id !== certId) : [...prev, certId]
    );
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(filteredCertificates.map((c) => c.certId));
      setSelectedCertIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const merged = new Set([...selectedCertIds, ...filteredCertificates.map((c) => c.certId)]);
      setSelectedCertIds(Array.from(merged));
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-[#232731] bg-[#111317] p-5">
        <div>
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-[#CCFF00]" />
            Authorized Digital Certificate Engine
          </h3>
          <p className="text-xs text-[#8e919b]">
            Generate A4 landscape PDFs, preview before issuing, print cleanly, configure Super Admin issuer branding, and export bulk ZIPs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('issued')}
            className={`rounded-xl px-3.5 py-2 font-mono text-xs font-semibold transition-all cursor-pointer ${
              subTab === 'issued'
                ? 'bg-[#CCFF00] text-black'
                : 'border border-[#2b2f38] bg-[#161820] text-zinc-300 hover:text-white'
            }`}
          >
            Registry & Bulk Export ({certificates.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('generator')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-mono text-xs font-semibold transition-all cursor-pointer ${
              subTab === 'generator'
                ? 'bg-[#CCFF00] text-black'
                : 'border border-[#2b2f38] bg-[#161820] text-zinc-300 hover:text-white'
            }`}
          >
            <Plus className="h-3.5 w-3.5" /> Generate / Batch Issue
          </button>
          <button
            type="button"
            onClick={() => setSubTab('settings')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-mono text-xs font-semibold transition-all cursor-pointer ${
              subTab === 'settings'
                ? 'bg-[#CCFF00] text-black'
                : 'border border-[#2b2f38] bg-[#161820] text-zinc-300 hover:text-white'
            }`}
          >
            <Settings className="h-3.5 w-3.5" /> Certificate Settings
          </button>
        </div>
      </div>

      {/* SUBTAB 1: ISSUED CERTIFICATES & BULK EXPORT */}
      {subTab === 'issued' && (
        <div className="space-y-5">
          {/* Search & Bulk Selection Controls */}
          <div className="rounded-2xl border border-[#232731] bg-[#111317] p-4 space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8e919b]" />
                <input
                  type="text"
                  value={certSearch}
                  onChange={(e) => setCertSearch(e.target.value)}
                  placeholder="Search by participant name, certificate ID, competition, or email..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-10 pr-4 py-2 text-xs text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <select
                value={certFilter}
                onChange={(e) => setCertFilter(e.target.value as any)}
                className="w-full sm:w-auto rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
              >
                <option value="all">All Certificates</option>
                <option value="valid">Valid Only</option>
                <option value="revoked">Revoked Only</option>
                <option value="downloaded">PDF Downloaded</option>
                <option value="pending_download">Not Downloaded Yet</option>
              </select>

              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-xs font-mono text-zinc-200 hover:border-[#CCFF00] cursor-pointer shrink-0"
              >
                {allVisibleSelected ? (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 text-[#CCFF00]" /> Unselect Visible
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5 text-zinc-400" /> Select All ({filteredCertificates.length})
                  </>
                )}
              </button>
            </div>

            {/* Bulk Download Bar */}
            {selectedCertIds.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#CCFF00]/40 bg-[#141912] px-4 py-3 text-xs">
                <div className="flex items-center gap-2 text-[#CCFF00] font-mono">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{selectedCertIds.length}</strong> certificate{selectedCertIds.length > 1 ? 's' : ''} selected
                    {bulkProgress ? ` • Generating ${bulkProgress.done}/${bulkProgress.total}...` : ''}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={handleBulkZipDownload}
                    className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-50 cursor-pointer"
                  >
                    <Archive className="h-4 w-4" />
                    {bulkBusy ? 'Packaging ZIP...' : `Download ZIP (${selectedCertIds.length})`}
                  </button>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={handleBulkIndividualDownload}
                    className="flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 font-mono text-xs text-white hover:border-[#CCFF00] disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Individual PDFs
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCertIds([])}
                    className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {filteredCertificates.length === 0 ? (
            <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-3">
              <Award className="h-8 w-8 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400">No certificates match your current filter.</p>
              <button
                type="button"
                onClick={() => setSubTab('generator')}
                className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black cursor-pointer"
              >
                Generate First Certificate
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCertificates.map((cert) => {
                const isSelected = selectedCertIds.includes(cert.certId);
                const isBusy = busyCertId === cert.certId;
                const resolved = resolveCertificateRenderData(cert, certSettings);

                return (
                  <div
                    key={cert.certId}
                    className={`rounded-2xl border bg-[#111317] p-5 flex flex-col justify-between space-y-4 transition-colors ${
                      isSelected ? 'border-[#CCFF00]/60 bg-[#141712]' : 'border-[#232731]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 text-xs font-mono">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectCert(cert.certId)}
                            className="h-4 w-4 accent-[#CCFF00] cursor-pointer"
                          />
                          <span className="text-[#CCFF00] font-bold">{cert.certId}</span>
                        </label>

                        <div className="flex items-center gap-1.5">
                          {(cert.downloadCount || 0) > 0 && (
                            <span
                              title={cert.downloadedAt ? `Last downloaded: ${new Date(cert.downloadedAt).toLocaleString()}` : ''}
                              className="rounded bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 text-[10px] text-emerald-300"
                            >
                              PDF ×{cert.downloadCount}
                            </span>
                          )}
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              cert.status === 'valid'
                                ? 'bg-[#CCFF00]/10 text-[#CCFF00]'
                                : 'bg-red-950/60 text-red-400'
                            }`}
                          >
                            {cert.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-display text-base font-bold text-white">{cert.studentName}</h4>
                        <p className="text-[11px] text-zinc-500 truncate">{cert.studentEmail || 'No email provided'}</p>
                        <p className="text-xs text-zinc-300 mt-1.5 font-medium line-clamp-1">
                          {resolved.competitionName}
                        </p>
                        <p className="text-[11px] text-zinc-400 line-clamp-1">{resolved.achievement}</p>
                      </div>

                      <div className="text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                        <span>Issuer: {resolved.authorizedSigner}</span>
                        <span>{resolved.issueDate}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="border-t border-[#1c1f26] pt-3 space-y-2.5">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewCert(cert)}
                          className="flex items-center justify-center gap-1 rounded-xl border border-[#2b2f38] bg-[#161922] px-2.5 py-1.5 text-[11px] font-mono text-white hover:border-[#CCFF00] hover:text-[#CCFF00] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDownloadSinglePdf(cert)}
                          className="flex items-center justify-center gap-1 rounded-xl bg-[#CCFF00] px-2.5 py-1.5 text-[11px] font-display font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-50 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" /> {isBusy ? '...' : 'PDF'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintCertificate(cert)}
                          className="flex items-center justify-center gap-1 rounded-xl border border-[#2b2f38] bg-[#161922] px-2.5 py-1.5 text-[11px] font-mono text-zinc-200 hover:border-[#CCFF00] hover:text-[#CCFF00] cursor-pointer"
                        >
                          <Printer className="h-3.5 w-3.5" /> Print
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <button
                          type="button"
                          onClick={() => onNavigateVerify(cert.certId)}
                          className="flex items-center gap-1 text-[#CCFF00] hover:underline font-mono cursor-pointer"
                        >
                          <ExternalLink className="h-3 w-3" /> Verify Portal
                        </button>

                        {cert.status === 'valid' ? (
                          <button
                            type="button"
                            onClick={() => onRequestRevoke(cert)}
                            className="text-red-400 hover:underline cursor-pointer"
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              await updateDoc(doc(db, 'certificates', cert.certId), { status: 'valid' });
                              await onLogAdminAction('CERTIFICATE_REINSTATED', 'Certificate', cert.certId, `Reinstated ${cert.certId}`);
                              setCertificates((prev) =>
                                prev.map((c) => (c.certId === cert.certId ? { ...c, status: 'valid' } : c))
                              );
                              onNotify('success', `Reinstated certificate ${cert.certId}.`);
                            }}
                            className="text-emerald-400 hover:underline cursor-pointer"
                          >
                            Reinstate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: SINGLE OR MULTI-PARTICIPANT GENERATOR WITH PREVIEW */}
      {subTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-5 text-xs">
            {/* Mode Switch */}
            <div className="flex items-center justify-between border-b border-[#1f2229] pb-4">
              <div>
                <h4 className="font-display text-base font-bold text-white">Generate Certificate(s)</h4>
                <p className="text-[11px] text-zinc-400">
                  Pre-filled with your Super Admin Certificate Settings. Preview before saving or download PDFs immediately.
                </p>
              </div>
              <div className="flex rounded-xl border border-[#2b2f38] bg-[#161820] p-1">
                <button
                  type="button"
                  onClick={() => setGenMode('single')}
                  className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold cursor-pointer ${
                    genMode === 'single' ? 'bg-[#CCFF00] text-black' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setGenMode('bulk')}
                  className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold cursor-pointer ${
                    genMode === 'bulk' ? 'bg-[#CCFF00] text-black' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Bulk Batch
                </button>
              </div>
            </div>

            {genMode === 'single' ? (
              <div className="space-y-4">
                {usersList.length > 0 && (
                  <div>
                    <label className="block font-semibold text-white mb-1">
                      Quick-Select Registered Participant
                    </label>
                    <select
                      value={singleUserId}
                      onChange={(e) => handleSelectSingleUser(e.target.value)}
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2.5 text-white focus:border-[#CCFF00] focus:outline-none"
                    >
                      <option value="">— Enter manually or choose registered user —</option>
                      {usersList.map((u) => (
                        <option key={u.userId} value={u.userId}>
                          {u.fullName} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-white mb-1">Participant Full Name *</label>
                    <input
                      type="text"
                      value={singleName}
                      onChange={(e) => setSingleName(e.target.value)}
                      placeholder="e.g. Viraj Bansod"
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-white mb-1">Participant Email</label>
                    <input
                      type="email"
                      value={singleEmail}
                      onChange={(e) => setSingleEmail(e.target.value)}
                      placeholder="participant@college.edu"
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-white mb-1">
                    Custom Certificate ID <span className="text-zinc-500 font-normal">(optional — auto-generates using format {certSettings.certIdFormat})</span>
                  </label>
                  <input
                    type="text"
                    value={customCertId}
                    onChange={(e) => setCustomCertId(e.target.value)}
                    placeholder={`Auto (${certSettings.certIdFormat})`}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 font-mono text-white uppercase focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-white flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-[#CCFF00]" />
                      Select Multiple Registered Participants ({selectedBulkUserIds.length} selected)
                    </label>
                    {selectedBulkUserIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedBulkUserIds([])}
                        className="text-[11px] font-mono text-[#CCFF00] hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={bulkUserSearch}
                    onChange={(e) => setBulkUserSearch(e.target.value)}
                    placeholder="Filter registered users..."
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white mb-2 focus:border-[#CCFF00] focus:outline-none"
                  />
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-[#232731] bg-[#0e1014] divide-y divide-[#1a1d25]">
                    {filteredBulkUsers.length === 0 ? (
                      <p className="p-3 text-center text-zinc-500">No matching registered users.</p>
                    ) : (
                      filteredBulkUsers.map((u) => {
                        const checked = selectedBulkUserIds.includes(u.userId);
                        return (
                          <label
                            key={u.userId}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-[#161922] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedBulkUserIds((prev) =>
                                  checked ? prev.filter((id) => id !== u.userId) : [...prev, u.userId]
                                )
                              }
                              className="h-4 w-4 accent-[#CCFF00]"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-white font-semibold block truncate">{u.fullName}</span>
                              <span className="text-[10px] text-zinc-400 font-mono truncate block">
                                {u.email} {u.branch ? `• ${u.branch}` : ''}
                              </span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-white mb-1">
                    Or Paste Additional Participants (One per line: Full Name, Email)
                  </label>
                  <textarea
                    rows={3}
                    value={manualBulkRows}
                    onChange={(e) => setManualBulkRows(e.target.value)}
                    placeholder={`Viraj Bansod, viraj@college.edu\nAnanya Kulkarni, ananya@college.edu\nRohan Deshmukh`}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 font-mono text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Shared Credential Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#1f2229]">
              <div>
                <label className="block font-semibold text-white mb-1">Certificate Title *</label>
                <input
                  type="text"
                  value={certTitle}
                  onChange={(e) => setCertTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Issue Date *</label>
                <input
                  type="text"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-white mb-1">Competition / Program Name *</label>
              <input
                type="text"
                value={competitionName}
                onChange={(e) => setCompetitionName(e.target.value)}
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-white mb-1">Achievement / Award *</label>
              <input
                type="text"
                value={achievement}
                onChange={(e) => setAchievement(e.target.value)}
                className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-white mb-1">Issuer Name *</label>
                <input
                  type="text"
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Issuer Designation *</label>
                <input
                  type="text"
                  value={issuerDesignation}
                  onChange={(e) => setIssuerDesignation(e.target.value)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Template Theme</label>
                <select
                  value={templateStyle}
                  onChange={(e) => setTemplateStyle(e.target.value as CertificateTemplateStyle)}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                >
                  <option value="charcoal_editorial">Charcoal Editorial</option>
                  <option value="obsidian_grid">Obsidian Tech Grid</option>
                  <option value="ivory_executive">Ivory Executive (Light)</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-[#1f2229]">
              <button
                type="button"
                onClick={handlePreviewBeforeIssue}
                className="flex items-center gap-1.5 rounded-xl border border-[#2f3542] bg-[#161922] px-4 py-2.5 font-mono text-xs font-semibold text-white hover:border-[#CCFF00] hover:text-[#CCFF00] cursor-pointer"
              >
                <Eye className="h-4 w-4" /> Preview Certificate
              </button>

              <button
                type="button"
                disabled={generating}
                onClick={() => handleIssueCertificates('save_only')}
                className="flex items-center gap-1.5 rounded-xl border border-[#CCFF00]/50 bg-[#CCFF00]/10 px-4 py-2.5 font-display text-xs font-bold uppercase text-[#CCFF00] hover:bg-[#CCFF00]/20 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                {generating ? 'Issuing...' : 'Generate Certificate'}
              </button>

              <button
                type="button"
                disabled={generating}
                onClick={() => handleIssueCertificates('save_and_download')}
                className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-50 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                {generating
                  ? 'Building PDF...'
                  : genMode === 'bulk'
                  ? 'Generate & Download ZIP'
                  : 'Generate & Download PDF'}
              </button>
            </div>
          </div>

          {/* Right Live Preview Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#CCFF00] uppercase font-bold">
                  Live A4 Landscape Preview
                </span>
                <button
                  type="button"
                  onClick={handlePreviewBeforeIssue}
                  className="text-xs font-mono text-zinc-400 hover:text-[#CCFF00] cursor-pointer"
                >
                  Expand Full-Size →
                </button>
              </div>

              <CertificateSheet
                certificate={buildDraftCertificateObject(
                  genMode === 'single'
                    ? singleName || 'Viraj Bansod'
                    : parseBulkParticipants()[0]?.name || 'Participant Preview',
                  genMode === 'single' ? singleEmail : parseBulkParticipants()[0]?.email || '',
                  genMode === 'single' ? singleUserId : parseBulkParticipants()[0]?.uid || 'preview_uid',
                  customCertId || 'ESC-2026-PREVIEW',
                  1
                )}
                settings={certSettings}
              />

              <div className="rounded-xl border border-[#1f2229] bg-[#151820] p-3.5 text-[11px] font-mono text-zinc-400 space-y-1">
                <div className="flex justify-between">
                  <span>Configured Logo:</span>
                  <span className="text-emerald-400">{certSettings.logoUrl ? 'Ready' : 'Default ESC'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Authorized Signature:</span>
                  <span className={certSettings.signatureUrl ? 'text-emerald-400' : 'text-amber-300'}>
                    {certSettings.signatureUrl ? 'Image Embedded' : 'Vector Script Fallback'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>PDF Format:</span>
                  <span className="text-white">A4 Landscape (297 × 210 mm)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: SUPER ADMIN CERTIFICATE SETTINGS */}
      {subTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveSettings}
            className="lg:col-span-7 rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-5 text-xs"
          >
            <div className="border-b border-[#1f2229] pb-4 flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00] block">
                  Super Admin Global Branding
                </span>
                <h4 className="font-display text-base font-bold text-white">
                  Default Issuer, Logo, Signature & Template Settings
                </h4>
              </div>
              {!isSuperAdmin && (
                <span className="rounded bg-amber-950/60 border border-amber-800 px-2.5 py-1 text-[10px] font-mono text-amber-300">
                  Read-Only (Super Admin Only)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-white mb-1">Issuer Full Name *</label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={settingsDraft.issuerName}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, issuerName: e.target.value })}
                  required
                  placeholder="e.g. Viraj Bansod"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white disabled:opacity-60 focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Issuer Designation *</label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={settingsDraft.issuerDesignation}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, issuerDesignation: e.target.value })}
                  required
                  placeholder="e.g. Founder, Engineering Startup Company"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white disabled:opacity-60 focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-white mb-1">Organization Name *</label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={settingsDraft.organizationName}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, organizationName: e.target.value })}
                  required
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white disabled:opacity-60 focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Certificate Background / Template</label>
                <select
                  disabled={!isSuperAdmin}
                  value={settingsDraft.backgroundTemplate}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      backgroundTemplate: e.target.value as CertificateTemplateStyle,
                    })
                  }
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2.5 text-white disabled:opacity-60 focus:border-[#CCFF00] focus:outline-none"
                >
                  <option value="charcoal_editorial">Charcoal Editorial (Signature Dark)</option>
                  <option value="obsidian_grid">Obsidian Tech Grid (Deep Black)</option>
                  <option value="ivory_executive">Ivory Executive (Print Light)</option>
                </select>
              </div>
            </div>

            {/* ESC Logo Upload / URL */}
            <div className="rounded-xl border border-[#232731] bg-[#14171d] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-white">ESC Logo Image</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!isSuperAdmin}
                    onClick={() => setSettingsDraft({ ...settingsDraft, logoUrl: DEFAULT_CERTIFICATE_LOGO })}
                    className="text-[11px] font-mono text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Use Official ESC Logo
                  </button>
                  <label className="flex items-center gap-1.5 rounded-lg border border-[#2b2f38] bg-[#1c202a] px-3 py-1.5 font-mono text-[11px] text-[#CCFF00] hover:border-[#CCFF00] cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingAsset === 'logo' ? 'Processing...' : 'Upload Logo'}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={!isSuperAdmin || uploadingAsset === 'logo'}
                      onChange={(e) => handleAssetFileUpload(e, 'logo')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <input
                type="text"
                disabled={!isSuperAdmin}
                value={settingsDraft.logoUrl}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, logoUrl: e.target.value })}
                placeholder="/assets/aistudio/IMG_20261112_135951_2ec3259f.png"
                className="w-full rounded-xl border border-[#2b2f38] bg-[#0e1014] px-3 py-2 font-mono text-[11px] text-zinc-300 focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            {/* Authorized Signature Upload / URL */}
            <div className="rounded-xl border border-[#232731] bg-[#14171d] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-white">Authorized Signature Image</label>
                <div className="flex items-center gap-2">
                  {settingsDraft.signatureUrl && (
                    <button
                      type="button"
                      disabled={!isSuperAdmin}
                      onClick={() => setSettingsDraft({ ...settingsDraft, signatureUrl: '' })}
                      className="text-[11px] font-mono text-red-400 hover:underline cursor-pointer"
                    >
                      Clear Image
                    </button>
                  )}
                  <label className="flex items-center gap-1.5 rounded-lg border border-[#2b2f38] bg-[#1c202a] px-3 py-1.5 font-mono text-[11px] text-[#CCFF00] hover:border-[#CCFF00] cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingAsset === 'signature' ? 'Processing...' : 'Upload Signature'}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={!isSuperAdmin || uploadingAsset === 'signature'}
                      onChange={(e) => handleAssetFileUpload(e, 'signature')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <input
                type="text"
                disabled={!isSuperAdmin}
                value={settingsDraft.signatureUrl}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, signatureUrl: e.target.value })}
                placeholder="Upload a PNG signature or paste HTTPS / data URL (optional typographic fallback if blank)"
                className="w-full rounded-xl border border-[#2b2f38] bg-[#0e1014] px-3 py-2 font-mono text-[11px] text-zinc-300 focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            {/* Defaults: Title, Competition, Date, ID Format */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-white mb-1">Default Certificate Title</label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={settingsDraft.defaultCertificateTitle}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, defaultCertificateTitle: e.target.value })}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white disabled:opacity-60 focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">Default Competition / Event Name</label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={settingsDraft.defaultCompetitionName}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, defaultCompetitionName: e.target.value })}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white disabled:opacity-60 focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">
                  Default Issue Date <span className="text-zinc-500 font-normal">(blank = auto today)</span>
                </label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={settingsDraft.defaultIssueDate}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, defaultIssueDate: e.target.value })}
                  placeholder="e.g. November 14, 2026"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white disabled:opacity-60 focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-white mb-1">
                  Certificate ID Format <span className="text-zinc-500 font-normal">({'{YYYY}'}, {'{XXXX}'}, {'{SEQ}'})</span>
                </label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={settingsDraft.certIdFormat}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, certIdFormat: e.target.value })}
                  placeholder="ESC-{YYYY}-{XXXX}"
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 font-mono text-white disabled:opacity-60 focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
            </div>

            {isSuperAdmin && (
              <div className="flex justify-end gap-3 pt-3 border-t border-[#1f2229]">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-4 w-4 ${savingSettings ? 'animate-spin' : ''}`} />
                  {savingSettings ? 'Saving to Firebase...' : 'Save Certificate Settings'}
                </button>
              </div>
            )}
          </form>

          {/* Settings Live Template Preview */}
          <div className="lg:col-span-5 rounded-2xl border border-[#232731] bg-[#111317] p-5 space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#CCFF00] uppercase font-bold">
                Template Settings Preview
              </span>
              <button
                type="button"
                onClick={() =>
                  setPreviewCert({
                    certId: formatCertificateId(settingsDraft.certIdFormat, new Date().getFullYear()),
                    studentId: 'PREVIEW-01',
                    studentName: 'Viraj Bansod',
                    certificateTitle: settingsDraft.defaultCertificateTitle,
                    competitionName: settingsDraft.defaultCompetitionName,
                    achievement: '1st Place — Autonomous Hardware Track',
                    organization: settingsDraft.organizationName,
                    authorizedSigner: settingsDraft.issuerName,
                    authorizedSignerTitle: settingsDraft.issuerDesignation,
                    logoUrl: settingsDraft.logoUrl,
                    signatureUrl: settingsDraft.signatureUrl,
                    templateStyle: settingsDraft.backgroundTemplate,
                    issueDate:
                      settingsDraft.defaultIssueDate ||
                      new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                    status: 'valid',
                  })
                }
                className="text-xs font-mono text-zinc-300 hover:text-[#CCFF00] cursor-pointer"
              >
                Full-Size Preview →
              </button>
            </div>

            <CertificateSheet
              certificate={{
                certId: formatCertificateId(settingsDraft.certIdFormat, new Date().getFullYear()),
                studentId: 'PREVIEW-01',
                studentName: 'Viraj Bansod',
                certificateTitle: settingsDraft.defaultCertificateTitle,
                competitionName: settingsDraft.defaultCompetitionName,
                achievement: '1st Place — Autonomous Hardware Track',
                organization: settingsDraft.organizationName,
                authorizedSigner: settingsDraft.issuerName,
                authorizedSignerTitle: settingsDraft.issuerDesignation,
                logoUrl: settingsDraft.logoUrl,
                signatureUrl: settingsDraft.signatureUrl,
                templateStyle: settingsDraft.backgroundTemplate,
                issueDate:
                  settingsDraft.defaultIssueDate ||
                  new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                status: 'valid',
              }}
              settings={settingsDraft}
            />
          </div>
        </div>
      )}

      {/* Full-Size Preview Modal */}
      <CertificatePreviewModal
        certificate={previewCert}
        settings={subTab === 'settings' ? settingsDraft : certSettings}
        isOpen={Boolean(previewCert)}
        onClose={() => setPreviewCert(null)}
        onDownloaded={(certId) => markCertificatesDownloaded([certId])}
        onNavigateVerify={onNavigateVerify}
      />

      {/* A4 Landscape Print Portal */}
      {printTargetCert && <CertificatePrintPortal certificate={printTargetCert} settings={certSettings} />}
    </div>
  );
};

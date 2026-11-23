import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Eye,
  Upload,
  Users,
  Download,
  Sparkles,
  CheckCircle2,
  X,
  Lock,
  Globe,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { collection, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { syncToSqlApi } from '../../lib/apiClient';
import {
  computeOpportunityMetrics,
  exportToCSV,
  isOpportunityPubliclyVisible,
  validateOpportunityForm,
} from '../../utils/escLogic';
import { processAndUploadPosterImage } from '../../utils/mediaUpload';
import type {
  OpportunityApplication,
  OpportunityCategory,
  OpportunityItem,
  OpportunityStatus,
} from '../../types';

interface OpportunityManagementSectionProps {
  opportunities: OpportunityItem[];
  setOpportunities: React.Dispatch<React.SetStateAction<OpportunityItem[]>>;
  applications: OpportunityApplication[];
  setApplications: React.Dispatch<React.SetStateAction<OpportunityApplication[]>>;
  isSuperAdmin: boolean;
  adminEmail: string;
  onNotify: (type: 'success' | 'error', text: string) => void;
  onLogAdminAction: (action: string, targetType: string, targetId: string, details: string) => Promise<void>;
  onRequestDelete: (opp: OpportunityItem, onDeleted: () => Promise<void>) => void;
}

const CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  grant: 'Prototyping Grant',
  internship: 'Engineering Internship',
  fellowship: 'Founder Fellowship',
  lab_access: 'Lab & Equipment Access',
  mentorship: 'Mentor Office Hours',
  ip_legal: 'IP & Patent Support',
  other: 'Other Opportunity',
};

const STATUS_BADGE: Record<OpportunityStatus, string> = {
  draft: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  live: 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/40',
  closed: 'bg-amber-950/60 text-amber-300 border-amber-700/50',
  archived: 'bg-zinc-900 text-zinc-500 border-zinc-800',
};

export const OpportunityManagementSection: React.FC<OpportunityManagementSectionProps> = ({
  opportunities,
  setOpportunities,
  applications,
  setApplications,
  isSuperAdmin,
  adminEmail,
  onNotify,
  onLogAdminAction,
  onRequestDelete,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<OpportunityItem | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);

  // Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<OpportunityCategory>('grant');
  const [organization, setOrganization] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [description, setDescription] = useState('');
  const [allocationOrStipend, setAllocationOrStipend] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [locationOrMode, setLocationOrMode] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [applyInstructions, setApplyInstructions] = useState('');
  const [externalApplyUrl, setExternalApplyUrl] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [statusDraft, setStatusDraft] = useState<OpportunityStatus>('live');

  const [previewOpp, setPreviewOpp] = useState<OpportunityItem | null>(null);
  const [inspectOpp, setInspectOpp] = useState<OpportunityItem | null>(null);

  const metrics = useMemo(
    () => computeOpportunityMetrics(opportunities, applications),
    [opportunities, applications]
  );

  const filteredOpps = useMemo(() => {
    return opportunities.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          o.title.toLowerCase().includes(q) ||
          o.organization.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [opportunities, statusFilter, search]);

  const openEditor = (item?: OpportunityItem) => {
    setFormErrors({});
    if (item) {
      setEditing(item);
      setTitle(item.title || '');
      setCategory(item.category || 'grant');
      setOrganization(item.organization || '');
      setPosterUrl(item.posterUrl || '');
      setDescription(item.description || '');
      setAllocationOrStipend(item.allocationOrStipend || '');
      setEligibility(item.eligibility || '');
      setSkillsText((item.requiredSkills || []).join(', '));
      setLocationOrMode(item.locationOrMode || '');
      setApplicationDeadline(item.applicationDeadline || '');
      setApplyInstructions(item.applyInstructions || '');
      setExternalApplyUrl(item.externalApplyUrl || '');
      setContactInfo(item.contactInfo || '');
      setStatusDraft(item.status || 'draft');
    } else {
      setEditing(null);
      setTitle('');
      setCategory('grant');
      setOrganization('Engineering Startup Company (ESC)');
      setPosterUrl('');
      setDescription('');
      setAllocationOrStipend('');
      setEligibility('Active ESC members & verified student builders');
      setSkillsText('');
      setLocationOrMode('Remote / Partner Maker Labs');
      setApplicationDeadline('');
      setApplyInstructions('Submit your statement of purpose, technical portfolio, and project scope.');
      setExternalApplyUrl('');
      setContactInfo(adminEmail || 'soviraj50@gmail.com');
      setStatusDraft('live');
    }
    setEditorOpen(true);
  };

  const buildPayload = (mode: 'draft' | 'publish'): Omit<OpportunityItem, 'id'> => {
    const now = new Date().toISOString();
    const isPublish = mode === 'publish';
    const nextStatus: OpportunityStatus = isPublish
      ? statusDraft === 'draft' || statusDraft === 'archived'
        ? 'live'
        : statusDraft
      : 'draft';

    return {
      title: title.trim(),
      category,
      organization: organization.trim(),
      posterUrl: posterUrl.trim(),
      description: description.trim(),
      allocationOrStipend: allocationOrStipend.trim(),
      eligibility: eligibility.trim(),
      requiredSkills: skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      locationOrMode: locationOrMode.trim(),
      applicationDeadline: applicationDeadline.trim(),
      applyInstructions: applyInstructions.trim(),
      externalApplyUrl: externalApplyUrl.trim(),
      contactInfo: contactInfo.trim(),
      status: nextStatus,
      isPublished: isPublish,
      applicationsCount: editing?.applicationsCount ?? 0,
      createdBy: editing?.createdBy || adminEmail,
      createdAt: editing?.createdAt || now,
      updatedAt: now,
    };
  };

  const handleSave = async (mode: 'draft' | 'publish') => {
    if (!isSuperAdmin) {
      onNotify('error', 'Only the verified Super Admin can manage opportunities.');
      return;
    }

    const payload = buildPayload(mode);
    const check = validateOpportunityForm(payload, mode === 'publish');
    if (!check.isValid) {
      setFormErrors(check.errors);
      onNotify('error', 'Please fill out the required fields.');
      return;
    }

    try {
      setSaving(true);
      setFormErrors({});
      if (editing?.id) {
        await updateDoc(doc(db, 'opportunities', editing.id), payload);
        await syncToSqlApi(`/api/opportunities/${encodeURIComponent(editing.id)}`, 'PUT', payload);
        setOpportunities((prev) =>
          prev.map((o) => (o.id === editing.id ? { ...o, ...payload, id: editing.id } : o))
        );
        await onLogAdminAction(
          mode === 'publish' ? 'OPPORTUNITY_PUBLISHED' : 'OPPORTUNITY_SAVED',
          'Opportunity',
          editing.id,
          `${mode === 'publish' ? 'Published' : 'Saved draft'} opportunity "${payload.title}"`
        );
        onNotify(
          'success',
          mode === 'publish'
            ? `Opportunity "${payload.title}" is now live.`
            : `Opportunity "${payload.title}" saved as draft.`
        );
      } else {
        const ref = doc(collection(db, 'opportunities'));
        const item: OpportunityItem = { id: ref.id, ...payload };
        await setDoc(ref, item);
        await syncToSqlApi('/api/opportunities', 'POST', item);
        setOpportunities((prev) => [item, ...prev]);
        await onLogAdminAction(
          mode === 'publish' ? 'OPPORTUNITY_CREATED_LIVE' : 'OPPORTUNITY_CREATED_DRAFT',
          'Opportunity',
          ref.id,
          `Created opportunity "${payload.title}"`
        );
        onNotify(
          'success',
          mode === 'publish'
            ? `Opportunity "${payload.title}" created and published live.`
            : `Opportunity "${payload.title}" saved as draft.`
        );
      }
      setEditorOpen(false);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save opportunity.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatus = async (opp: OpportunityItem, nextStatus: OpportunityStatus) => {
    if (!isSuperAdmin || !opp.id) return;
    const isPublished = nextStatus === 'live' || nextStatus === 'closed';
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'opportunities', opp.id), {
        status: nextStatus,
        isPublished,
        updatedAt: now,
      });
      await syncToSqlApi(`/api/opportunities/${encodeURIComponent(opp.id)}`, 'PUT', {
        ...opp,
        status: nextStatus,
        isPublished,
      });
      setOpportunities((prev) =>
        prev.map((o) =>
          o.id === opp.id ? { ...o, status: nextStatus, isPublished, updatedAt: now } : o
        )
      );
      await onLogAdminAction(
        `OPPORTUNITY_STATUS_${nextStatus.toUpperCase()}`,
        'Opportunity',
        opp.id,
        `Updated "${opp.title}" status to ${nextStatus}`
      );
      onNotify('success', `Opportunity "${opp.title}" updated to ${nextStatus}.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update status.');
    }
  };

  const handlePosterFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingPoster(true);
      const { url } = await processAndUploadPosterImage(file, 'opportunities');
      setPosterUrl(url);
      onNotify('success', 'Opportunity banner image ready.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Could not process banner image.');
    } finally {
      setUploadingPoster(false);
      e.target.value = '';
    }
  };

  const oppApps = useMemo(
    () => (inspectOpp ? applications.filter((a) => a.opportunityId === inspectOpp.id) : []),
    [inspectOpp, applications]
  );

  const exportOppAppsCSV = (opp: OpportunityItem) => {
    const list = applications.filter((a) => a.opportunityId === opp.id);
    const csv = exportToCSV(list, [
      { key: 'userName', label: 'Applicant Name' },
      { key: 'userEmail', label: 'Email' },
      { key: 'college', label: 'College' },
      { key: 'branch', label: 'Branch' },
      { key: 'portfolioUrl', label: 'Portfolio URL' },
      { key: 'statement', label: 'Statement' },
      { key: 'status', label: 'Application Status' },
      { key: 'appliedAt', label: 'Applied At' },
    ]);
    if (!csv) {
      onNotify('error', 'No applications to export.');
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esc_opportunity_applications_${opp.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-amber-800/40 bg-[#141210] p-10 text-center space-y-3">
        <Lock className="h-8 w-8 text-amber-400 mx-auto" />
        <h3 className="font-display text-lg font-bold text-white">Super Admin Exclusive Section</h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Opportunity creation, publishing, editing, and deletion are restricted exclusively to the verified Super Admin account (<span className="text-[#CCFF00]">soviraj50@gmail.com</span>).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00] block">
            Super Admin Grants & Fellowships Engine
          </span>
          <h3 className="font-display text-xl font-bold text-white">Opportunity Management</h3>
          <p className="text-xs text-[#8e919b]">
            Manage real grants, internships, fellowships, lab access, and mentorship programs. Zero placeholder entries appear publicly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openEditor()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#CCFF00] px-4 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] transition-colors cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" /> Create Opportunity
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Opportunities', value: metrics.total, accent: 'text-white' },
          { label: 'Live Now', value: metrics.live, accent: 'text-[#CCFF00]' },
          { label: 'Drafts / Hidden', value: metrics.drafts, accent: 'text-zinc-300' },
          { label: 'Total Applications', value: metrics.totalApplications, accent: 'text-sky-400' },
          { label: 'Shortlisted / Approved', value: metrics.shortlistedOrApproved, accent: 'text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-[#232731] bg-[#111317] p-4">
            <span className="font-mono text-[10px] uppercase text-zinc-500 block">{s.label}</span>
            <p className={`font-display text-2xl font-black mt-1 ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search opportunities by title or organization..."
            className="w-full rounded-xl border border-[#2b2f38] bg-[#14161c] pl-10 pr-4 py-2.5 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[#2b2f38] bg-[#14161c] px-4 py-2.5 text-xs font-mono text-white focus:border-[#CCFF00] focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="live">Live</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* List */}
      {filteredOpps.length === 0 ? (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-3">
          <Sparkles className="h-9 w-9 text-zinc-600 mx-auto" />
          <h4 className="font-display text-base font-bold text-white">No Opportunities Published</h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            {opportunities.length === 0
              ? 'The Opportunities directory is completely clean with no demo listings. Click "Create Opportunity" to publish a real grant, lab, internship, or mentorship track.'
              : 'No opportunities match your filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredOpps.map((opp) => {
            const appCount = applications.filter((a) => a.opportunityId === opp.id).length;
            const visible = isOpportunityPubliclyVisible(opp);
            return (
              <div
                key={opp.id}
                className="rounded-2xl border border-[#232731] bg-[#111317] overflow-hidden flex flex-col justify-between"
              >
                {opp.posterUrl && (
                  <div className="h-32 w-full overflow-hidden border-b border-[#1f2229] bg-black">
                    <img src={opp.posterUrl} alt={opp.title} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-6 space-y-4 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="rounded bg-[#1a1d24] border border-[#2b2f38] px-2.5 py-0.5 text-[#CCFF00]">
                      {CATEGORY_LABELS[opp.category] || opp.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 uppercase font-semibold ${
                          STATUS_BADGE[opp.status] || STATUS_BADGE.draft
                        }`}
                      >
                        {opp.status}
                      </span>
                      {visible ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <Globe className="h-3 w-3" /> Public
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-zinc-500">
                          <EyeOff className="h-3 w-3" /> Hidden
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-display text-lg font-bold text-white">{opp.title}</h4>
                    <p className="text-[11px] font-mono text-zinc-400 mt-0.5">{opp.organization}</p>
                    <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{opp.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400 bg-[#151820] rounded-xl p-3 border border-[#222631]">
                    <span>Value: {opp.allocationOrStipend || '—'}</span>
                    <span>Deadline: {opp.applicationDeadline || '—'}</span>
                    <span>Mode: {opp.locationOrMode || '—'}</span>
                    <span>
                      Applications: <strong className="text-[#CCFF00]">{appCount}</strong>
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#1f2229] bg-[#0e1014] px-6 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Change status for ${opp.title}`}
                      value={opp.status}
                      onChange={(e) => handleQuickStatus(opp, e.target.value as OpportunityStatus)}
                      className="rounded-lg border border-[#2b2f38] bg-[#161922] px-2.5 py-1 text-[11px] font-mono text-zinc-200 focus:border-[#CCFF00] focus:outline-none cursor-pointer"
                    >
                      <option value="draft">Draft</option>
                      <option value="live">Live</option>
                      <option value="closed">Closed</option>
                      <option value="archived">Archived</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setInspectOpp(opp)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] bg-[#161922] px-2.5 py-1 text-[11px] font-mono text-sky-300 hover:border-sky-400 cursor-pointer"
                    >
                      <Users className="h-3 w-3" /> Applications ({appCount})
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewOpp(opp)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white hover:border-[#CCFF00] cursor-pointer"
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditor(opp)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2b2f38] px-2.5 py-1 text-[11px] text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete opportunity ${opp.title}`}
                      onClick={() =>
                        onRequestDelete(opp, async () => {
                          await deleteDoc(doc(db, 'opportunities', opp.id!));
                          await syncToSqlApi(`/api/opportunities/${encodeURIComponent(opp.id!)}`, 'DELETE');
                          setOpportunities((prev) => prev.filter((item) => item.id !== opp.id));
                          await onLogAdminAction('OPPORTUNITY_DELETED', 'Opportunity', opp.id!, `Deleted "${opp.title}"`);
                          onNotify('success', `Deleted opportunity "${opp.title}".`);
                        })
                      }
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">Super Admin Opportunity Studio</span>
                <h3 className="font-display text-lg font-bold text-white">
                  {editing ? 'Edit Opportunity' : 'Create New Opportunity'}
                </h3>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} className="text-zinc-400 hover:text-white p-1 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Opportunity Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Hardware Prototyping Micro-Grant"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                  {formErrors.title && <p className="text-red-400 text-[11px] mt-1">{formErrors.title}</p>}
                </div>

                <div>
                  <label className="block font-semibold text-white mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as OpportunityCategory)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Host / Organization *</label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                  {formErrors.organization && <p className="text-red-400 text-[11px] mt-1">{formErrors.organization}</p>}
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Grant Allocation / Stipend / Perks</label>
                  <input
                    type="text"
                    value={allocationOrStipend}
                    onChange={(e) => setAllocationOrStipend(e.target.value)}
                    placeholder="e.g. Up to ₹50,000 zero-equity reimbursement"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Full Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
                {formErrors.description && <p className="text-red-400 text-[11px] mt-1">{formErrors.description}</p>}
              </div>

              {/* Banner Upload */}
              <div className="rounded-xl border border-[#232731] bg-[#14161c] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-semibold text-white">Banner / Visual (optional)</label>
                  <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e222b] border border-[#2e333f] px-3 py-1.5 text-[11px] font-mono text-[#CCFF00] hover:border-[#CCFF00] cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingPoster ? 'Processing...' : 'Upload Banner'}
                    <input type="file" accept="image/*" onChange={handlePosterFile} className="hidden" />
                  </label>
                </div>
                <input
                  type="text"
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  placeholder="Or paste banner image URL..."
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Location / Mode</label>
                  <input
                    type="text"
                    value={locationOrMode}
                    onChange={(e) => setLocationOrMode(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Application Deadline *</label>
                  <input
                    type="date"
                    value={applicationDeadline}
                    onChange={(e) => setApplicationDeadline(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                  {formErrors.applicationDeadline && (
                    <p className="text-red-400 text-[11px] mt-1">{formErrors.applicationDeadline}</p>
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Status When Published</label>
                  <select
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value as OpportunityStatus)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  >
                    <option value="live">Live (Accepting Applications)</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">Eligibility Criteria *</label>
                  <input
                    type="text"
                    value={eligibility}
                    onChange={(e) => setEligibility(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                  {formErrors.eligibility && <p className="text-red-400 text-[11px] mt-1">{formErrors.eligibility}</p>}
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Required Skills (comma-separated)</label>
                  <input
                    type="text"
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                    placeholder="Embedded C, CAD, Deep Learning"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Application Instructions</label>
                <textarea
                  value={applyInstructions}
                  onChange={(e) => setApplyInstructions(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-white mb-1">External Apply URL (optional)</label>
                  <input
                    type="url"
                    value={externalApplyUrl}
                    onChange={(e) => setExternalApplyUrl(e.target.value)}
                    placeholder="Leave blank to use built-in ESC application modal"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">Contact Email / Handle</label>
                  <input
                    type="text"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#23262d] pt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPreviewOpp({ id: editing?.id || 'preview', ...buildPayload('publish') })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#14161c] px-4 py-2 text-xs font-mono text-zinc-200 hover:border-[#CCFF00] cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('draft')}
                  className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-4 py-2 text-xs font-semibold text-white hover:border-zinc-400 cursor-pointer disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('publish')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Publish Live'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#CCFF00]/40 bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#23262d] pb-3">
              <span className="font-mono text-xs text-[#CCFF00] uppercase font-bold">Public Opportunity Preview</span>
              <button type="button" onClick={() => setPreviewOpp(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            {previewOpp.posterUrl && (
              <img src={previewOpp.posterUrl} alt={previewOpp.title} className="w-full h-44 object-cover rounded-xl border border-[#232731]" />
            )}
            <div className="space-y-3">
              <span className="inline-block rounded bg-[#CCFF00]/15 px-2.5 py-0.5 font-mono text-[11px] uppercase text-[#CCFF00]">
                {CATEGORY_LABELS[previewOpp.category] || previewOpp.category}
              </span>
              <h3 className="font-display text-2xl font-bold text-white">{previewOpp.title || 'Untitled Opportunity'}</h3>
              <p className="text-xs font-mono text-zinc-400">{previewOpp.organization}</p>
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{previewOpp.description}</p>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#232731] bg-[#14161c] p-4 text-xs">
                <div>
                  <span className="font-mono text-[10px] text-zinc-500 uppercase block">Value / Stipend</span>
                  <span className="text-[#CCFF00] font-semibold">{previewOpp.allocationOrStipend || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-zinc-500 uppercase block">Application Deadline</span>
                  <span className="text-white">{previewOpp.applicationDeadline || 'Open'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW APPLICATIONS DRAWER */}
      {inspectOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23262d] pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-[#CCFF00]">Opportunity Applications</span>
                <h3 className="font-display text-lg font-bold text-white">{inspectOpp.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportOppAppsCSV(inspectOpp)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#2b2f38] bg-[#14161c] px-3 py-1.5 text-xs font-mono text-[#CCFF00] hover:border-[#CCFF00] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
                <button type="button" onClick={() => setInspectOpp(null)} className="text-zinc-400 hover:text-white p-1 cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {oppApps.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500">No applications received for this opportunity yet.</div>
            ) : (
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                {oppApps.map((app) => (
                  <div key={app.id} className="rounded-xl border border-[#232731] bg-[#14161c] p-4 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{app.userName}</p>
                        <p className="text-[11px] text-zinc-400">
                          {app.userEmail} {app.college ? `• ${app.college}` : ''} {app.branch ? `(${app.branch})` : ''}
                        </p>
                      </div>
                      <select
                        aria-label={`Application status for ${app.userName}`}
                        value={app.status}
                        onChange={async (e) => {
                          const nextStatus = e.target.value as OpportunityApplication['status'];
                          if (!app.id) return;
                          await updateDoc(doc(db, 'opportunityApplications', app.id), { status: nextStatus });
                          setApplications((prev) =>
                            prev.map((item) => (item.id === app.id ? { ...item, status: nextStatus } : item))
                          );
                          await onLogAdminAction(
                            'OPPORTUNITY_APP_STATUS',
                            'OpportunityApplication',
                            app.id,
                            `Updated ${app.userName}'s application status to ${nextStatus}`
                          );
                        }}
                        className="rounded-lg border border-[#2b2f38] bg-[#161922] px-2.5 py-1 font-mono text-[11px] text-white"
                      >
                        <option value="submitted">Submitted</option>
                        <option value="under_review">Under Review</option>
                        <option value="shortlisted">Shortlisted</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <p className="text-zinc-300">{app.statement}</p>
                    {app.portfolioUrl && (
                      <a
                        href={app.portfolioUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-[#CCFF00] hover:underline"
                      >
                        Portfolio / Link <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

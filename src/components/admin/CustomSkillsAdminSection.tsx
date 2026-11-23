import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Edit3,
  GitMerge,
  Trash2,
  Search,
  RefreshCw,
  Tag,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { ALL_PREDEFINED_SKILLS } from '../../data/skillsCatalog';
import type { CustomSkillRecord } from '../../types';

interface CustomSkillsAdminSectionProps {
  onNotify: (type: 'success' | 'error', text: string) => void;
}

export const CustomSkillsAdminSection: React.FC<CustomSkillsAdminSectionProps> = ({ onNotify }) => {
  const [skills, setSkills] = useState<CustomSkillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Rename / Merge Inline Modal State
  const [editingSkill, setEditingSkill] = useState<CustomSkillRecord | null>(null);
  const [editMode, setEditMode] = useState<'rename' | 'merge' | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameType, setRenameType] = useState<'technical' | 'non_technical'>('technical');
  const [mergeTarget, setMergeTarget] = useState('');

  const loadSkills = async () => {
    try {
      setLoading(true);
      const rows = await apiRequest<CustomSkillRecord[]>('/api/admin/skills/custom', {
        requireAuth: true,
      });
      setSkills(Array.isArray(rows) ? rows : []);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to load custom skills.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const handleModerate = async (
    skill: CustomSkillRecord,
    action: 'approve' | 'reject' | 'rename' | 'merge',
    extra?: { newName?: string; skillType?: 'technical' | 'non_technical'; mergeTargetName?: string }
  ) => {
    try {
      setBusyId(skill.id);
      const updated = await apiRequest<CustomSkillRecord>(`/api/admin/skills/custom/${skill.id}`, {
        method: 'PATCH',
        requireAuth: true,
        body: {
          action,
          ...extra,
        },
      });
      setSkills((prev) => prev.map((s) => (s.id === skill.id ? updated : s)));
      setEditingSkill(null);
      setEditMode(null);
      onNotify(
        'success',
        action === 'approve'
          ? `Approved custom skill "${updated.name}" for global ESC search.`
          : action === 'reject'
            ? `Rejected custom skill "${updated.name}".`
            : action === 'rename'
              ? `Renamed skill to "${updated.name}" and updated member profiles.`
              : `Merged "${skill.name}" into "${extra?.mergeTargetName}" across member profiles.`
      );
    } catch (err: any) {
      onNotify('error', err?.message || 'Moderation action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (skill: CustomSkillRecord) => {
    try {
      setBusyId(skill.id);
      await apiRequest(`/api/admin/skills/custom/${skill.id}`, {
        method: 'DELETE',
        requireAuth: true,
      });
      setSkills((prev) => prev.filter((s) => s.id !== skill.id));
      onNotify('success', `Removed custom skill "${skill.name}".`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to delete custom skill.');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = skills.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q) ||
        (s.submittedByName || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = skills.filter((s) => s.status === 'pending').length;
  const approvedCount = skills.filter((s) => s.status === 'approved').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#232731] bg-[#121419] p-4">
        <div>
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#CCFF00]" />
            Custom Skills Moderation Queue
          </h3>
          <p className="text-xs text-zinc-400">
            Review student-added custom skills. Approve to make globally searchable, rename for consistency, merge duplicates, or remove inappropriate entries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-2.5 py-1 font-mono text-[11px] text-amber-300">
            Pending: {pendingCount}
          </span>
          <span className="rounded-lg border border-[#CCFF00]/30 bg-[#CCFF00]/10 px-2.5 py-1 font-mono text-[11px] text-[#CCFF00]">
            Approved: {approvedCount}
          </span>
          <button
            type="button"
            onClick={loadSkills}
            className="rounded-xl border border-[#2b2f38] bg-[#17191e] p-2 text-zinc-300 hover:text-white cursor-pointer"
            title="Refresh custom skills"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search custom skill name, category, or student..."
            className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-10 pr-4 py-2 text-xs text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-auto rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
        >
          <option value="all">All Statuses ({skills.length})</option>
          <option value="pending">Pending Review ({pendingCount})</option>
          <option value="approved">Approved ({approvedCount})</option>
          <option value="merged">Merged</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-8 text-center text-xs font-mono text-zinc-500">
          Loading custom skills...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-2">
          <Tag className="h-8 w-8 text-zinc-600 mx-auto" />
          <p className="text-xs text-zinc-400">
            No custom skills found matching this filter. Student-submitted custom skills will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1f2229] bg-[#161820] text-zinc-400 font-mono text-[11px] uppercase">
              <tr>
                <th className="px-4 py-3">Skill Name</th>
                <th className="px-4 py-3">Type &amp; Category</th>
                <th className="px-4 py-3">Submitted By</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Moderation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c1f26]">
              {filtered.map((skill) => {
                const isBusy = busyId === skill.id;
                return (
                  <tr key={skill.id} className="hover:bg-[#14161d] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white">{skill.name}</div>
                      {skill.mergedInto && (
                        <div className="font-mono text-[10px] text-purple-300">
                          Merged into: {skill.mergedInto}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase mr-1.5 ${
                          skill.skillType === 'technical'
                            ? 'bg-[#CCFF00]/10 text-[#CCFF00]'
                            : 'bg-sky-500/10 text-sky-300'
                        }`}
                      >
                        {skill.skillType === 'technical' ? 'Technical' : 'Non-Tech'}
                      </span>
                      <span className="text-zinc-400">{skill.category}</span>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-300">
                      {skill.submittedByName || 'Student'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-300">{skill.usageCount}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase border ${
                          skill.status === 'approved'
                            ? 'border-[#CCFF00]/40 bg-[#CCFF00]/10 text-[#CCFF00]'
                            : skill.status === 'rejected'
                              ? 'border-red-800 bg-red-950/40 text-red-400'
                              : skill.status === 'merged'
                                ? 'border-purple-700 bg-purple-950/40 text-purple-300'
                                : 'border-amber-700 bg-amber-950/40 text-amber-300'
                        }`}
                      >
                        {skill.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {skill.status !== 'approved' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleModerate(skill, 'approve')}
                            title="Approve Skill"
                            className="rounded-lg border border-[#CCFF00]/40 bg-[#CCFF00]/10 p-1.5 text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setEditingSkill(skill);
                            setEditMode('rename');
                            setRenameValue(skill.name);
                            setRenameType(skill.skillType);
                          }}
                          title="Rename Skill"
                          className="rounded-lg border border-[#2b2f38] bg-[#17191e] p-1.5 text-zinc-300 hover:border-[#CCFF00] hover:text-[#CCFF00] cursor-pointer disabled:opacity-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setEditingSkill(skill);
                            setEditMode('merge');
                            setMergeTarget('');
                          }}
                          title="Merge into Existing Skill"
                          className="rounded-lg border border-purple-700/50 bg-purple-950/30 p-1.5 text-purple-300 hover:bg-purple-800 cursor-pointer disabled:opacity-50"
                        >
                          <GitMerge className="h-3.5 w-3.5" />
                        </button>
                        {skill.status !== 'rejected' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleModerate(skill, 'reject')}
                            title="Reject Skill"
                            className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-1.5 text-amber-300 hover:bg-amber-900 cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDelete(skill)}
                          title="Delete Custom Skill"
                          className="rounded-lg border border-red-900/50 bg-red-950/30 p-1.5 text-red-400 hover:bg-red-900 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rename / Merge Modal */}
      {editingSkill && editMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 space-y-4 shadow-2xl">
            <h4 className="font-display text-base font-bold text-white">
              {editMode === 'rename'
                ? `Rename Custom Skill: "${editingSkill.name}"`
                : `Merge "${editingSkill.name}" into Existing Skill`}
            </h4>

            {editMode === 'rename' ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Standardized Skill Name</label>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Skill Group</label>
                  <select
                    value={renameType}
                    onChange={(e) =>
                      setRenameType(e.target.value === 'non_technical' ? 'non_technical' : 'technical')
                    }
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  >
                    <option value="technical">Technical / Engineering</option>
                    <option value="non_technical">Non-Technical / Creative &amp; Business</option>
                  </select>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Renaming automatically approves this skill and updates all member profiles and applications referencing the old label.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Target Skill Name</label>
                  <input
                    type="text"
                    list="esc-predefined-skills-datalist"
                    value={mergeTarget}
                    onChange={(e) => setMergeTarget(e.target.value)}
                    placeholder="Select or type canonical skill (e.g. SolidWorks)"
                    className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2 text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                  <datalist id="esc-predefined-skills-datalist">
                    {ALL_PREDEFINED_SKILLS.map((s) => (
                      <option key={s.normalized} value={s.name} />
                    ))}
                  </datalist>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Merging marks &ldquo;{editingSkill.name}&rdquo; as merged and replaces it with the target skill across all student profiles and applications.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#23262d]">
              <button
                type="button"
                onClick={() => {
                  setEditingSkill(null);
                  setEditMode(null);
                }}
                className="rounded-xl border border-[#2b2f38] px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === editingSkill.id}
                onClick={() => {
                  if (editMode === 'rename') {
                    handleModerate(editingSkill, 'rename', {
                      newName: renameValue,
                      skillType: renameType,
                    });
                  } else {
                    handleModerate(editingSkill, 'merge', { mergeTargetName: mergeTarget });
                  }
                }}
                className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] cursor-pointer disabled:opacity-50"
              >
                {editMode === 'rename' ? 'Save & Approve' : 'Confirm Merge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

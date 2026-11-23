import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  X,
  Check,
  AlertTriangle,
  Sparkles,
  Cpu,
  Briefcase,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  TECHNICAL_SKILL_CATEGORIES,
  NON_TECHNICAL_SKILL_CATEGORIES,
  type SkillKind,
} from '../data/skillsCatalog';
import {
  buildCombinedSkillPool,
  cleanSkillDisplayName,
  findDuplicateOrSimilarSkills,
  normalizeSkillName,
  searchSkillsCatalog,
  type SearchableSkillOption,
} from '../utils/escLogic';
import { apiRequest } from '../lib/apiClient';

interface CustomSkillApiRow {
  id: string;
  name: string;
  skillType: 'technical' | 'non_technical';
  category?: string;
  status?: string;
}

interface SkillSelectorProps {
  technicalSkills: string[];
  nonTechnicalSkills: string[];
  customSkills: string[];
  onChange: (next: {
    technicalSkills: string[];
    nonTechnicalSkills: string[];
    customSkills: string[];
  }) => void;
  isAuthenticated?: boolean;
  errorMessage?: string;
  compact?: boolean;
}

export function SkillSelector({
  technicalSkills,
  nonTechnicalSkills,
  customSkills,
  onChange,
  isAuthenticated = false,
  errorMessage,
  compact = false,
}: SkillSelectorProps) {
  const [query, setQuery] = useState('');
  const [customSkillType, setCustomSkillType] = useState<SkillKind>('technical');
  const [activeGroup, setActiveGroup] = useState<'technical' | 'non_technical'>('technical');
  const [activeCategoryId, setActiveCategoryId] = useState<string>(TECHNICAL_SKILL_CATEGORIES[0].id);
  const [browseOpen, setBrowseOpen] = useState<boolean>(!compact);
  const [approvedCustomSkills, setApprovedCustomSkills] = useState<CustomSkillApiRow[]>([]);
  const [addingCustom, setAddingCustom] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'info' | 'warn'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    const loadApprovedCustomSkills = async () => {
      try {
        const rows = await apiRequest<CustomSkillApiRow[]>('/api/skills/custom', {
          requireAuth: isAuthenticated,
        });
        if (active && Array.isArray(rows)) {
          setApprovedCustomSkills(rows);
        }
      } catch {
        // Non-blocking fallback to predefined catalog
      }
    };
    loadApprovedCustomSkills();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const pool = useMemo(() => {
    return buildCombinedSkillPool(
      approvedCustomSkills.map((c) => ({
        name: c.name,
        skillType: c.skillType === 'non_technical' ? 'non_technical' : 'technical',
        category: c.category,
      }))
    );
  }, [approvedCustomSkills]);

  const allSelectedNormalized = useMemo(() => {
    const set = new Set<string>();
    [...technicalSkills, ...nonTechnicalSkills, ...customSkills].forEach((s) => {
      const n = normalizeSkillName(s);
      if (n) set.add(n);
    });
    return set;
  }, [technicalSkills, nonTechnicalSkills, customSkills]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return searchSkillsCatalog(query, pool, {
      limit: 12,
      excludeSelected: [...technicalSkills, ...nonTechnicalSkills, ...customSkills],
    });
  }, [query, pool, technicalSkills, nonTechnicalSkills, customSkills]);

  const duplicateAnalysis = useMemo(() => {
    if (!query.trim()) return { exactMatch: null, similarMatches: [] };
    return findDuplicateOrSimilarSkills(query, pool);
  }, [query, pool]);

  const addSkillToState = (skillName: string, kind: SkillKind, isCustom: boolean) => {
    const clean = cleanSkillDisplayName(skillName);
    const norm = normalizeSkillName(clean);
    if (!clean || !norm) return;

    if (allSelectedNormalized.has(norm)) {
      setFeedbackMsg({ type: 'warn', text: `"${clean}" is already selected.` });
      return;
    }

    const nextTech = [...technicalSkills];
    const nextNonTech = [...nonTechnicalSkills];
    const nextCustom = [...customSkills];

    if (kind === 'technical') {
      nextTech.push(clean);
    } else {
      nextNonTech.push(clean);
    }
    if (isCustom && !nextCustom.some((s) => normalizeSkillName(s) === norm)) {
      nextCustom.push(clean);
    }

    onChange({
      technicalSkills: nextTech,
      nonTechnicalSkills: nextNonTech,
      customSkills: nextCustom,
    });
    setFeedbackMsg(null);
  };

  const removeSkillFromState = (skillName: string) => {
    const norm = normalizeSkillName(skillName);
    onChange({
      technicalSkills: technicalSkills.filter((s) => normalizeSkillName(s) !== norm),
      nonTechnicalSkills: nonTechnicalSkills.filter((s) => normalizeSkillName(s) !== norm),
      customSkills: customSkills.filter((s) => normalizeSkillName(s) !== norm),
    });
  };

  const toggleCatalogSkill = (skillName: string, kind: SkillKind) => {
    const norm = normalizeSkillName(skillName);
    if (allSelectedNormalized.has(norm)) {
      removeSkillFromState(skillName);
    } else {
      addSkillToState(skillName, kind, false);
    }
  };

  const handleSelectSuggestion = (option: SearchableSkillOption) => {
    addSkillToState(option.name, option.kind, Boolean(option.isCustom));
    setQuery('');
  };

  const handleAddCustomSkill = async () => {
    const clean = cleanSkillDisplayName(query);
    if (clean.length < 2) {
      setFeedbackMsg({ type: 'warn', text: 'Enter at least 2 characters to add a custom skill.' });
      return;
    }

    // Prevent exact duplicates with existing catalog
    if (duplicateAnalysis.exactMatch) {
      handleSelectSuggestion(duplicateAnalysis.exactMatch);
      setFeedbackMsg({
        type: 'info',
        text: `Selected existing skill "${duplicateAnalysis.exactMatch.name}" from the ESC catalog.`,
      });
      return;
    }

    if (allSelectedNormalized.has(normalizeSkillName(clean))) {
      setFeedbackMsg({ type: 'warn', text: `"${clean}" is already in your selected skills.` });
      return;
    }

    try {
      setAddingCustom(true);
      if (isAuthenticated) {
        const res = await apiRequest<{ skill?: CustomSkillApiRow; predefined?: boolean }>(
          '/api/skills/custom',
          {
            method: 'POST',
            requireAuth: true,
            body: {
              name: clean,
              skillType: customSkillType,
              category:
                customSkillType === 'non_technical'
                  ? 'Custom Non-Technical'
                  : 'Other Engineering Skills',
            },
          }
        );

        const resolvedName = res?.skill?.name || clean;
        const resolvedKind: SkillKind =
          res?.skill?.skillType === 'non_technical' ? 'non_technical' : customSkillType;
        const isCustom = !res?.predefined;

        if (res?.skill && isCustom) {
          setApprovedCustomSkills((prev) => {
            if (prev.some((p) => normalizeSkillName(p.name) === normalizeSkillName(resolvedName))) {
              return prev;
            }
            return [res.skill!, ...prev];
          });
        }
        addSkillToState(resolvedName, resolvedKind, isCustom);
      } else {
        addSkillToState(clean, customSkillType, true);
      }

      setQuery('');
      setFeedbackMsg({
        type: 'info',
        text: `Added custom skill "${clean}" (${customSkillType === 'technical' ? 'Technical' : 'Non-Technical'}).`,
      });
    } catch {
      // Still allow local selection so student flow is never blocked
      addSkillToState(clean, customSkillType, true);
      setQuery('');
    } finally {
      setAddingCustom(false);
    }
  };

  const categoriesForActiveGroup =
    activeGroup === 'technical' ? TECHNICAL_SKILL_CATEGORIES : NON_TECHNICAL_SKILL_CATEGORIES;

  const currentCategory =
    categoriesForActiveGroup.find((c) => c.id === activeCategoryId) || categoriesForActiveGroup[0];

  const switchGroup = (group: 'technical' | 'non_technical') => {
    setActiveGroup(group);
    const list = group === 'technical' ? TECHNICAL_SKILL_CATEGORIES : NON_TECHNICAL_SKILL_CATEGORIES;
    setActiveCategoryId(list[0].id);
  };

  const customNormSet = useMemo(
    () => new Set(customSkills.map(normalizeSkillName)),
    [customSkills]
  );

  const trimmedQuery = query.trim();
  const canAddCustom =
    trimmedQuery.length >= 2 &&
    !duplicateAnalysis.exactMatch &&
    !allSelectedNormalized.has(normalizeSkillName(trimmedQuery));

  return (
    <div className="space-y-4">
      {/* Search or Add Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold">
            Search or Add Skills (All Engineering Branches &amp; Non-Technical)
          </label>
          <span className="font-mono text-[11px] text-[#CCFF00]">
            {technicalSkills.length} Tech • {nonTechnicalSkills.length} Non-Tech
          </span>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (feedbackMsg) setFeedbackMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (duplicateAnalysis.exactMatch) {
                  handleSelectSuggestion(duplicateAnalysis.exactMatch);
                } else if (searchResults.length > 0 && trimmedQuery.length < 2) {
                  handleSelectSuggestion(searchResults[0]);
                } else if (canAddCustom) {
                  handleAddCustomSkill();
                } else if (searchResults.length > 0) {
                  handleSelectSuggestion(searchResults[0]);
                }
              }
            }}
            placeholder="Search or add a skill..."
            aria-label="Search or add a skill"
            className="w-full rounded-xl border border-[#2b2f38] bg-[#161920] pl-10 pr-10 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#CCFF00] focus:outline-none transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear skill search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Live Search Suggestions & Custom Skill Add Panel */}
        {trimmedQuery.length > 0 && (
          <div className="rounded-xl border border-[#2b2f38] bg-[#12141a] p-3 space-y-3 shadow-xl">
            {searchResults.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  Matching Skills ({searchResults.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {searchResults.map((opt) => (
                    <button
                      key={`${opt.kind}-${opt.normalized}`}
                      type="button"
                      onClick={() => handleSelectSuggestion(opt)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#2d323e] bg-[#181b22] px-2.5 py-1.5 text-xs text-zinc-200 hover:border-[#CCFF00] hover:text-[#CCFF00] transition-colors cursor-pointer"
                    >
                      <Plus className="h-3 w-3 text-[#CCFF00]" />
                      <span>{opt.name}</span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {opt.kind === 'technical' ? 'Tech' : 'Non-Tech'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Exact Duplicate Notice */}
            {duplicateAnalysis.exactMatch && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#CCFF00]/30 bg-[#CCFF00]/5 px-3 py-2 text-xs">
                <span className="text-zinc-200">
                  <strong className="text-[#CCFF00]">{duplicateAnalysis.exactMatch.name}</strong> already exists in{' '}
                  <span className="text-zinc-400">{duplicateAnalysis.exactMatch.categoryLabel}</span>.
                </span>
                {!allSelectedNormalized.has(duplicateAnalysis.exactMatch.normalized) ? (
                  <button
                    type="button"
                    onClick={() => handleSelectSuggestion(duplicateAnalysis.exactMatch!)}
                    className="rounded-md bg-[#CCFF00] px-2.5 py-1 font-mono text-[11px] font-bold text-black hover:bg-[#b8e600] cursor-pointer"
                  >
                    Select Skill
                  </button>
                ) : (
                  <span className="font-mono text-[11px] text-[#CCFF00]">Already Selected</span>
                )}
              </div>
            )}

            {/* Similar Existing Skills Notice */}
            {!duplicateAnalysis.exactMatch && duplicateAnalysis.similarMatches.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Similar existing skills found — pick one to avoid duplicates, or add custom below:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {duplicateAnalysis.similarMatches.map((sim) => {
                    const alreadyPicked = allSelectedNormalized.has(sim.normalized);
                    return (
                      <button
                        key={`sim-${sim.normalized}`}
                        type="button"
                        disabled={alreadyPicked}
                        onClick={() => handleSelectSuggestion(sim)}
                        className={`rounded-md border px-2 py-1 text-[11px] font-mono transition-colors ${
                          alreadyPicked
                            ? 'border-zinc-700 bg-zinc-900 text-zinc-500 cursor-default'
                            : 'border-amber-500/40 bg-amber-950/40 text-amber-200 hover:border-[#CCFF00] hover:text-[#CCFF00] cursor-pointer'
                        }`}
                      >
                        {alreadyPicked ? `✓ ${sim.name}` : `+ ${sim.name}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add Custom Skill Action */}
            {canAddCustom && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-[#22252e]">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                  <Sparkles className="h-3.5 w-3.5 text-[#CCFF00] shrink-0" />
                  <span>
                    Add <strong className="text-white">&ldquo;{cleanSkillDisplayName(query)}&rdquo;</strong> as:
                  </span>
                  <div className="inline-flex rounded-lg border border-[#2b2f38] bg-[#161920] p-0.5">
                    <button
                      type="button"
                      onClick={() => setCustomSkillType('technical')}
                      className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase cursor-pointer transition-colors ${
                        customSkillType === 'technical'
                          ? 'bg-[#CCFF00] text-black font-bold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Technical
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomSkillType('non_technical')}
                      className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase cursor-pointer transition-colors ${
                        customSkillType === 'non_technical'
                          ? 'bg-[#CCFF00] text-black font-bold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Non-Technical
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={addingCustom}
                  onClick={handleAddCustomSkill}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#CCFF00] px-3.5 py-2 font-mono text-xs font-bold text-black hover:bg-[#b8e600] disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {addingCustom ? 'Adding...' : 'Add Custom Skill'}
                </button>
              </div>
            )}
          </div>
        )}

        {feedbackMsg && (
          <p
            className={`text-xs ${
              feedbackMsg.type === 'warn' ? 'text-amber-400' : 'text-[#CCFF00]'
            }`}
          >
            {feedbackMsg.text}
          </p>
        )}

        {errorMessage && (
          <p className="text-xs text-red-400 font-medium">{errorMessage}</p>
        )}
      </div>

      {/* Selected Skills Tags */}
      <div className="rounded-xl border border-[#252932] bg-[#111317] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            Selected Skills ({technicalSkills.length + nonTechnicalSkills.length})
          </span>
          {technicalSkills.length + nonTechnicalSkills.length === 0 && (
            <span className="text-[11px] text-zinc-500">None selected yet</span>
          )}
        </div>

        {technicalSkills.length > 0 && (
          <div className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#CCFF00]">
              Technical &amp; Engineering ({technicalSkills.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {technicalSkills.map((skill) => {
                const isCustom = customNormSet.has(normalizeSkillName(skill));
                return (
                  <span
                    key={`sel-tech-${skill}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#CCFF00]/40 bg-[#CCFF00]/10 px-2.5 py-1 text-xs font-medium text-[#CCFF00]"
                  >
                    <span>{skill}</span>
                    {isCustom && (
                      <span className="rounded bg-[#CCFF00]/20 px-1 py-0.2 font-mono text-[9px] uppercase text-white">
                        Custom
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeSkillFromState(skill)}
                      aria-label={`Remove ${skill}`}
                      className="text-[#CCFF00]/80 hover:text-white cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {nonTechnicalSkills.length > 0 && (
          <div className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-sky-400">
              Non-Technical, Creative &amp; Entrepreneurial ({nonTechnicalSkills.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {nonTechnicalSkills.map((skill) => {
                const isCustom = customNormSet.has(normalizeSkillName(skill));
                return (
                  <span
                    key={`sel-nontech-${skill}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-200"
                  >
                    <span>{skill}</span>
                    {isCustom && (
                      <span className="rounded bg-sky-400/20 px-1 py-0.2 font-mono text-[9px] uppercase text-white">
                        Custom
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeSkillFromState(skill)}
                      aria-label={`Remove ${skill}`}
                      className="text-sky-300 hover:text-white cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Categorized Skills Browser */}
      <div className="rounded-xl border border-[#252932] bg-[#111317] overflow-hidden">
        <button
          type="button"
          onClick={() => setBrowseOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#161920] transition-colors cursor-pointer"
        >
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-300 font-semibold">
            Browse Skill Categories by Branch &amp; Discipline
          </span>
          {browseOpen ? (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          )}
        </button>

        {browseOpen && (
          <div className="border-t border-[#222630] p-3.5 space-y-3.5">
            {/* Primary Switch: Technical vs Non-Technical */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => switchGroup('technical')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-mono font-semibold transition-all cursor-pointer ${
                  activeGroup === 'technical'
                    ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00]'
                    : 'border-[#252932] bg-[#161920] text-zinc-400 hover:text-white'
                }`}
              >
                <Cpu className="h-3.5 w-3.5" />
                <span>Technical ({TECHNICAL_SKILL_CATEGORIES.length} Branches)</span>
              </button>
              <button
                type="button"
                onClick={() => switchGroup('non_technical')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-mono font-semibold transition-all cursor-pointer ${
                  activeGroup === 'non_technical'
                    ? 'border-sky-400 bg-sky-500/10 text-sky-300'
                    : 'border-[#252932] bg-[#161920] text-zinc-400 hover:text-white'
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                <span>Non-Technical ({NON_TECHNICAL_SKILL_CATEGORIES.length} Domains)</span>
              </button>
            </div>

            {/* Branch / Domain Selector Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {categoriesForActiveGroup.map((cat) => {
                const isActive = cat.id === currentCategory.id;
                const selectedInCat = cat.skills.filter((s) =>
                  allSelectedNormalized.has(normalizeSkillName(s))
                ).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-all cursor-pointer ${
                      isActive
                        ? activeGroup === 'technical'
                          ? 'border-[#CCFF00] bg-[#CCFF00] text-black font-bold'
                          : 'border-sky-400 bg-sky-400 text-black font-bold'
                        : 'border-[#2b2f38] bg-[#161920] text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    {cat.shortLabel}
                    {selectedInCat > 0 ? ` (${selectedInCat})` : ''}
                  </button>
                );
              })}
            </div>

            {/* Skills in Active Category */}
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-white">{currentCategory.label}</p>
              <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
                {currentCategory.skills.map((skill) => {
                  const selected = allSelectedNormalized.has(normalizeSkillName(skill));
                  return (
                    <button
                      key={`${currentCategory.id}-${skill}`}
                      type="button"
                      onClick={() => toggleCatalogSkill(skill, currentCategory.kind)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                        selected
                          ? currentCategory.kind === 'technical'
                            ? 'border-[#CCFF00] bg-[#CCFF00]/15 text-[#CCFF00]'
                            : 'border-sky-400 bg-sky-500/15 text-sky-200'
                          : 'border-[#2b2f38] bg-[#161920] text-zinc-300 hover:border-zinc-500 hover:text-white'
                      }`}
                    >
                      {selected ? <Check className="h-3 w-3 shrink-0" /> : <Plus className="h-3 w-3 opacity-60 shrink-0" />}
                      <span>{skill}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

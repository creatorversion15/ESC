import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  Clock,
  CreditCard,
  FileText,
  FolderGit2,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  Target,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  ADMIN_CATEGORIES,
  filterAdminModules,
  type AdminCategoryId,
  type AdminModuleCardModel,
  type AdminModuleDef,
  type AdminTab,
} from '../../utils/adminModules';

export const ADMIN_MODULE_ICONS: Record<AdminModuleDef['iconKey'], React.ElementType> = {
  overview: Activity,
  users: Users,
  applications: FileText,
  teams: Rocket,
  tasks: ListChecks,
  activities: Clock,
  ideas: Lightbulb,
  problem_exchange: Target,
  challenges: Trophy,
  projects: FolderGit2,
  skills: Tag,
  events: Calendar,
  opportunities: Briefcase,
  support: LifeBuoy,
  certificates: Award,
  card_orders: CreditCard,
  notifications: Bell,
  analytics_reports: BarChart3,
  settings: Settings,
  logs: ShieldCheck,
};

interface AdminModulesHubProps {
  cards: AdminModuleCardModel[];
  loadingData: boolean;
  isSuperAdmin: boolean;
  onSelectModule: (tab: AdminTab) => void;
}

export const AdminModulesHub: React.FC<AdminModulesHubProps> = ({
  cards,
  loadingData,
  isSuperAdmin,
  onSelectModule,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | AdminCategoryId>('all');

  const totalPendingItems = useMemo(
    () =>
      cards
        .filter((c) => c.id !== 'overview')
        .reduce((sum, c) => sum + (c.pendingCount || 0), 0),
    [cards]
  );

  const filteredCards = useMemo(
    () => filterAdminModules(cards, searchQuery, selectedCategory),
    [cards, searchQuery, selectedCategory]
  );

  const groupedCategories = useMemo(() => {
    return ADMIN_CATEGORIES.map((category) => ({
      category,
      items: filteredCards.filter((card) => card.category === category.id),
    })).filter((group) => group.items.length > 0);
  }, [filteredCards]);

  return (
    <div className="space-y-8" data-testid="admin-modules-hub">
      {/* Toolbar: Module Search + Category Filter Controls */}
      <div className="rounded-2xl border border-[#222630] bg-[#101217] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight">
              All Admin Modules
            </h2>
            <p className="text-xs text-[#9ca3af] flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono tabular-nums text-zinc-200">{cards.length} modules</span>
              <span aria-hidden="true">·</span>
              <span>{ADMIN_CATEGORIES.length} operational categories</span>
              {totalPendingItems > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-[#39FF14]">
                    {totalPendingItems} pending actions requiring review
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="relative w-full md:w-80 shrink-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search admin modules..."
              aria-label="Search admin modules"
              className="w-full rounded-xl border border-[#262b36] bg-[#0b0d12] pl-10 pr-9 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-[#39FF14] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear module search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Buttons (wraps cleanly — zero horizontal scroll hiding) */}
        <div
          className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#1c2029]"
          role="group"
          aria-label="Filter modules by category"
        >
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#39FF14] text-black font-semibold'
                : 'bg-[#161922] text-zinc-300 border border-[#262b36] hover:border-[#39FF14]/50 hover:text-white'
            }`}
          >
            All Categories ({cards.length})
          </button>
          {ADMIN_CATEGORIES.map((cat) => {
            const count = cards.filter((c) => c.category === cat.id).length;
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#39FF14] text-black font-semibold'
                    : 'bg-[#161922] text-zinc-300 border border-[#262b36] hover:border-[#39FF14]/50 hover:text-white'
                }`}
              >
                {cat.code}. {cat.title} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Categorized 3-Column Card Grid */}
      {groupedCategories.length === 0 ? (
        <div className="rounded-2xl border border-[#222630] bg-[#101217] p-12 text-center space-y-3">
          <p className="text-sm font-medium text-white">No admin modules match &ldquo;{searchQuery}&rdquo;</p>
          <p className="text-xs text-zinc-400">Try clearing your search or switching back to All Categories.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2 text-xs font-semibold text-black hover:bg-[#32e010] cursor-pointer"
          >
            Reset Module Filter
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {groupedCategories.map(({ category, items }) => (
            <section
              key={category.id}
              aria-labelledby={`admin-cat-${category.id}`}
              className="space-y-4"
              data-testid={`admin-category-${category.id}`}
            >
              {/* Category Header */}
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-2 lg:gap-6 pb-2 border-b border-[#1c2029]">
                <div className="space-y-0.5 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#39FF14] whitespace-nowrap">
                    <span>Section {category.code}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-zinc-400 tabular-nums">{items.length} modules</span>
                  </div>
                  <h3
                    id={`admin-cat-${category.id}`}
                    className="font-display text-lg font-bold text-white tracking-tight"
                  >
                    {category.title}
                  </h3>
                </div>
                <p className="text-xs text-[#8e919b] max-w-xl">{category.subtitle}</p>
              </div>

              {/* 3 Columns Desktop / 2 Columns Tablet / 1 Column Mobile — Uniform Height Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
                {items.map((mod) => {
                  const Icon = ADMIN_MODULE_ICONS[mod.iconKey];
                  const hasPending = mod.pendingCount > 0 && Boolean(mod.pendingLabel);

                  return (
                    <button
                      key={mod.id}
                      type="button"
                      data-testid={`admin-module-card-${mod.id}`}
                      onClick={() => onSelectModule(mod.id)}
                      className="group h-full min-h-[212px] w-full text-left rounded-2xl border border-[#222630] bg-[#101217] p-5 flex flex-col justify-between gap-5 transition-all duration-150 hover:border-[#39FF14]/70 hover:bg-[#14171f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14] cursor-pointer"
                    >
                      <div className="space-y-4">
                        {/* Card Top Row: Icon + Pending Notification Indicator */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#282d38] bg-[#161922] text-[#39FF14] transition-colors group-hover:border-[#39FF14]/50 group-hover:bg-[#39FF14]/10">
                            <Icon className="h-5 w-5" />
                          </div>

                          {hasPending ? (
                            <span
                              className="inline-flex items-center rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-amber-300 whitespace-nowrap shrink-0"
                              title={mod.pendingLabel}
                            >
                              {mod.pendingLabel}
                            </span>
                          ) : mod.superAdminOnlyNote ? (
                            <span className="font-mono text-[11px] text-zinc-500 whitespace-nowrap shrink-0">
                              {isSuperAdmin ? 'Full Control' : 'Read Only'}
                            </span>
                          ) : null}
                        </div>

                        {/* Title & Short Description */}
                        <div className="space-y-1.5">
                          <h4 className="font-display text-base font-bold text-white leading-snug group-hover:text-[#39FF14] transition-colors">
                            {mod.name}
                          </h4>
                          <p className="text-xs text-[#9ca3af] leading-relaxed line-clamp-2">
                            {mod.description}
                          </p>
                        </div>
                      </div>

                      {/* Card Footer: Live DB Count + View/Manage Action */}
                      <div className="pt-3.5 border-t border-[#1c2029] flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-display text-xl font-extrabold tabular-nums text-white leading-none">
                            {loadingData && mod.metricValue === '—' ? '...' : mod.metricValue}
                          </div>
                          <div className="mt-1 text-[11px] text-zinc-500 truncate">
                            {mod.metricLabel}
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a303d] bg-[#161922] px-3 py-1.5 font-mono text-[11px] font-semibold text-zinc-200 transition-colors group-hover:border-[#39FF14] group-hover:bg-[#39FF14] group-hover:text-black whitespace-nowrap shrink-0">
                          Manage
                          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { LayoutGrid, X } from 'lucide-react';
import {
  ADMIN_CATEGORIES,
  type AdminModuleCardModel,
  type AdminTab,
} from '../../utils/adminModules';
import { ADMIN_MODULE_ICONS } from './AdminModulesHub';

interface AdminSidebarNavProps {
  cards: AdminModuleCardModel[];
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const SidebarNavContent: React.FC<{
  cards: AdminModuleCardModel[];
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
}> = ({ cards, activeTab, onSelectTab }) => {
  return (
    <nav aria-label="Admin Control Center Modules" className="space-y-5">
      {/* Primary Hub Entry */}
      <button
        type="button"
        data-testid="admin-nav-hub"
        onClick={() => onSelectTab('hub')}
        className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
          activeTab === 'hub'
            ? 'bg-[#39FF14] text-black'
            : 'border border-[#222630] bg-[#14171f] text-white hover:border-[#39FF14]/60'
        }`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <LayoutGrid className="h-4 w-4 shrink-0" />
          <span className="truncate">All Modules Dashboard</span>
        </span>
        <span
          className={`font-mono text-[10px] tabular-nums shrink-0 ${
            activeTab === 'hub' ? 'text-black/80' : 'text-zinc-400'
          }`}
        >
          {cards.length}
        </span>
      </button>

      {/* Categorized Navigation Groups */}
      {ADMIN_CATEGORIES.map((category) => {
        const categoryModules = cards.filter((c) => c.category === category.id);
        return (
          <div key={category.id} className="space-y-1.5">
            <div className="px-2.5 text-[11px] font-mono font-semibold text-zinc-500 flex items-center justify-between">
              <span>
                {category.code}. {category.title}
              </span>
              <span className="tabular-nums text-[10px]">{categoryModules.length}</span>
            </div>

            <div className="space-y-0.5">
              {categoryModules.map((mod) => {
                const Icon = ADMIN_MODULE_ICONS[mod.iconKey];
                const isActive = activeTab === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    data-testid={`admin-nav-${mod.id}`}
                    onClick={() => onSelectTab(mod.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#39FF14]/15 text-[#39FF14] font-semibold border border-[#39FF14]/40'
                        : 'text-zinc-300 border border-transparent hover:bg-[#161922] hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isActive ? 'text-[#39FF14]' : 'text-zinc-400'
                        }`}
                      />
                      <span className="truncate">{mod.shortName}</span>
                    </span>

                    {mod.pendingCount > 0 ? (
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums shrink-0 ${
                          isActive
                            ? 'bg-[#39FF14] text-black'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {mod.pendingCount}
                      </span>
                    ) : mod.metricValue !== '—' &&
                      mod.metricValue !== '3 CSV' &&
                      mod.metricValue !== 'Open' &&
                      mod.metricValue !== 'Closed' ? (
                      <span className="font-mono text-[10px] tabular-nums text-zinc-500 shrink-0">
                        {mod.metricValue}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
};

export const AdminSidebarNav: React.FC<AdminSidebarNavProps> = ({
  cards,
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
}) => {
  const handleSelect = (tab: AdminTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Desktop Persistent Categorized Sidebar */}
      <aside
        aria-label="Admin Module Sidebar"
        className="hidden lg:block w-64 xl:w-[272px] shrink-0"
      >
        <div className="sticky top-24 rounded-2xl border border-[#222630] bg-[#101217] p-4 max-h-[calc(100vh-7rem)] overflow-y-auto">
          <SidebarNavContent
            cards={cards}
            activeTab={activeTab}
            onSelectTab={onSelectTab}
          />
        </div>
      </aside>

      {/* Mobile & Tablet Slide-Over Navigation Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[110] lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Admin Modules Navigation"
        >
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 flex h-full w-80 max-w-[85vw] flex-col border-r border-[#222630] bg-[#0d0f14] p-4 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1f2229] pb-3 mb-4">
              <div>
                <h2 className="font-display text-sm font-bold text-white">Admin Modules</h2>
                <p className="text-[11px] text-zinc-400">All {cards.length} control center sections</p>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close admin module navigation"
                className="rounded-lg border border-[#262b36] bg-[#14171f] p-2 text-zinc-300 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <SidebarNavContent
              cards={cards}
              activeTab={activeTab}
              onSelectTab={handleSelect}
            />
          </div>
        </div>
      )}
    </>
  );
};

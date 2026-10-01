import React from 'react';
import {
  CalendarIcon,
  ChartIcon,
  GearIcon,
  DatabaseIcon,
  SunIcon,
  MoonIcon,
  LaptopIcon
} from '../common/Icons.js';
import { SyncStatusBadge } from '../sync/SyncStatusBadge.js';
import { useTheme } from '../../theme/ThemeContext.js';
import type { UiSyncState } from '../../sync/state.js';

export type NavTab = 'daily' | 'analytics' | 'manage' | 'data';

export interface AppLayoutProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  syncState?: UiSyncState | string;
  pendingSyncCount?: number;
  onSyncClick?: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onTabChange,
  syncState = 'Tersinkron',
  pendingSyncCount = 0,
  onSyncClick,
  children
}) => {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const navItems = [
    { id: 'daily' as NavTab, label: 'Hari Ini', icon: CalendarIcon },
    { id: 'analytics' as NavTab, label: 'Analitik', icon: ChartIcon },
    { id: 'manage' as NavTab, label: 'Kelola', icon: GearIcon },
    { id: 'data' as NavTab, label: 'Data', icon: DatabaseIcon }
  ];

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const ThemeIcon =
    theme === 'system' ? LaptopIcon : resolvedTheme === 'dark' ? MoonIcon : SunIcon;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50">
      {/* =========================================================================
          Desktop Left Sidebar (>= 768px, 260px width)
          ========================================================================= */}
      <aside
        className="hidden md:flex flex-col w-[260px] flex-shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700/60 p-5 justify-between min-h-screen sticky top-0"
        aria-label="Navigasi Utama"
      >
        <div className="flex flex-col gap-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              V
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-base tracking-tight leading-tight text-slate-900 dark:text-white">
                VibeHabit
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Serene Focus Tracker
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5" role="navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all text-left ${
                    isActive
                      ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 font-semibold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/40 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${
                      isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Desktop Footer (Sync Status & Theme Switcher) */}
        <div className="flex flex-col gap-3 pt-4 border-t border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Sinkronisasi:
            </span>
            <SyncStatusBadge
              state={syncState}
              pendingCount={pendingSyncCount}
              onClick={onSyncClick}
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Tema:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                {theme}
              </span>
            </span>
            <button
              type="button"
              onClick={cycleTheme}
              aria-label={`Ubah tema (saat ini: ${theme})`}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <ThemeIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          Mobile Top Bar (< 768px, 56px height)
          ========================================================================= */}
      <header className="md:hidden sticky top-0 z-30 h-14 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/60 px-4 flex items-center justify-between pt-safe">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-sm">
            V
          </div>
          <span className="font-semibold text-base tracking-tight text-slate-900 dark:text-white">
            VibeHabit
          </span>
        </div>

        <div className="flex items-center gap-2">
          <SyncStatusBadge
            state={syncState}
            pendingCount={pendingSyncCount}
            onClick={onSyncClick}
          />
          <button
            type="button"
            onClick={cycleTheme}
            aria-label={`Ganti tema tampilan (${theme})`}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <ThemeIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* =========================================================================
          Main Content Canvas (max-w-[1040px])
          ========================================================================= */}
      <main className="flex-1 min-w-0 flex flex-col items-center px-4 md:px-8 py-5 md:py-8 pb-24 md:pb-8">
        <div className="w-full max-w-[1040px] flex flex-col">{children}</div>
      </main>

      {/* =========================================================================
          Mobile Bottom Navigation Bar (< 768px, 64px height)
          ========================================================================= */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-800/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-700/80 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
        aria-label="Navigasi Bawah"
      >
        <div className="h-16 grid grid-cols-4 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                  isActive
                    ? 'text-teal-600 dark:text-teal-400 font-semibold'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className="text-[11px] leading-tight tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

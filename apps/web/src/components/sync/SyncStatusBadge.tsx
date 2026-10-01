import React from 'react';
import type { UiSyncState } from '../../sync/state.js';

export interface SyncStatusBadgeProps {
  state?: UiSyncState | string;
  pendingCount?: number;
  className?: string;
  onClick?: () => void;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  state = 'Tersinkron',
  pendingCount = 0,
  className = '',
  onClick
}) => {
  let badgeClasses = 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/40';
  let dotClasses = 'bg-teal-600 dark:bg-teal-400';
  let label = 'Tersinkron';
  let isPulsing = false;

  const stateStr = String(state);

  if (stateStr === 'Tersinkron' || stateStr === 'synced') {
    badgeClasses = 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/40';
    dotClasses = 'bg-teal-600 dark:bg-teal-400';
    label = 'Tersinkron';
  } else if (stateStr === 'syncing' || stateStr === 'Menyinkronkan...') {
    badgeClasses = 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/40';
    dotClasses = 'bg-teal-600 dark:bg-teal-400';
    label = 'Menyinkronkan...';
    isPulsing = true;
  } else if (stateStr.startsWith('Menunggu sinkron') || stateStr === 'pending') {
    badgeClasses = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40';
    dotClasses = 'bg-amber-600 dark:bg-amber-400';
    label = stateStr.startsWith('Menunggu') ? stateStr : `Menunggu (${pendingCount})`;
  } else if (stateStr === 'offline' || stateStr === 'Offline') {
    badgeClasses = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    dotClasses = 'bg-slate-500 dark:bg-slate-400';
    label = 'Offline';
  } else if (stateStr.includes('tidak terjangkau') || stateStr === 'unreachable') {
    badgeClasses = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40';
    dotClasses = 'bg-rose-600 dark:bg-rose-400';
    label = 'Server tidak terjangkau (Tailscale aktif?)';
  } else if (stateStr.includes('tidak akurat') || stateStr === 'clock_skew') {
    badgeClasses = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40';
    dotClasses = 'bg-rose-600 dark:bg-rose-400';
    label = 'Jam perangkat tidak akurat (>5 menit)';
  } else {
    label = stateStr;
  }

  return (
    <div
      role="status"
      aria-label={`Status sinkronisasi: ${label}`}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors select-none ${badgeClasses} ${className} ${
        onClick ? 'cursor-pointer hover:opacity-90 active:scale-95' : ''
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClasses} ${
          isPulsing ? 'animate-ping' : ''
        }`}
      />
      <span className="truncate tabular-nums">{label}</span>
    </div>
  );
};

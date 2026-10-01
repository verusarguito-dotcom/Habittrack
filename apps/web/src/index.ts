import type { Habit } from '@vibehabit/shared';

// Web application entry point (scaffolding for Milestone 1)
export const APP_NAME = 'VibeHabit';
export type { Habit };

export * from './db/index.js';
export * from './sync/index.js';
export * from './theme/index.js';
export * from './utils/device.js';
export * from './utils/categories.js';
export * from './components/common/Icons.js';
export * from './components/sync/SyncStatusBadge.js';
export * from './components/layout/AppLayout.js';
export * from './components/daily/DateStrip.js';
export * from './components/daily/ProgressRing.js';
export * from './components/daily/HabitChecklistCard.js';
export * from './components/daily/HabitQuantitativeCard.js';
export * from './components/habits/HabitCard.js';
export * from './components/habits/HabitFormModal.js';
export * from './components/habits/DeleteConfirmationModal.js';
export * from './pages/DailyCheckIn.js';
export * from './pages/HabitManagement.js';
export * from './pages/AnalyticsDashboard.js';
export * from './pages/DataManagement.js';
export * from './utils/exportImport.js';
export * from './components/analytics/TimeRangeFilter.js';
export * from './components/analytics/MetricSummaryCards.js';
export * from './components/analytics/ConsistencyChart.js';
export * from './components/analytics/CalendarHeatmap.js';
export * from './components/analytics/CategorySummaryCards.js';
export * from './components/analytics/HabitPerformanceTable.js';
export * from './components/data/ImportPreviewModal.js';
export * from './components/data/BackupWarnings.js';
export * from './components/data/DeviceTokenForm.js';
export * from './components/pwa/ReloadPrompt.js';
export * from './pwa/index.js';
export * from './App.js';



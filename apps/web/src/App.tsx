import React, { useState, useMemo, useEffect } from 'react';
import type { VibeHabitDatabase } from './db/database.js';
import { createDatabase } from './db/database.js';
import { ThemeProvider } from './theme/ThemeContext.js';
import { AppLayout, type NavTab } from './components/layout/AppLayout.js';
import { DailyCheckIn } from './pages/DailyCheckIn.js';
import { HabitManagement } from './pages/HabitManagement.js';
import { AnalyticsDashboard } from './pages/AnalyticsDashboard.js';
import { DataManagement } from './pages/DataManagement.js';
import { getOrCreateDeviceId } from './utils/device.js';
import { observeOutboxCount } from './db/hooks.js';

export interface AppProps {
  db?: VibeHabitDatabase;
  deviceId?: string;
  initialTab?: NavTab;
  onTriggerSync?: () => Promise<void>;
}

export const App: React.FC<AppProps> = ({
  db: propDb,
  deviceId: propDeviceId,
  initialTab = 'daily',
  onTriggerSync
}) => {
  const db = useMemo(() => propDb || createDatabase(), [propDb]);
  const deviceId = useMemo(() => propDeviceId || getOrCreateDeviceId(), [propDeviceId]);
  const [currentTab, setCurrentTab] = useState<NavTab>(initialTab);
  const [outboxCount, setOutboxCount] = useState<number>(0);

  useEffect(() => {
    const sub = observeOutboxCount(db).subscribe({
      next: (count) => setOutboxCount(count),
      error: (err) => console.warn('Failed to observe outbox count in App:', err)
    });
    return () => sub.unsubscribe();
  }, [db]);

  const syncState = outboxCount > 0 ? `Menunggu (${outboxCount})` : 'Tersinkron';

  return (
    <ThemeProvider db={db}>
      <AppLayout
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        syncState={syncState}
        pendingSyncCount={outboxCount}
        onSyncClick={onTriggerSync}
      >
        {currentTab === 'daily' && <DailyCheckIn db={db} deviceId={deviceId} />}
        {currentTab === 'manage' && <HabitManagement db={db} deviceId={deviceId} />}
        {currentTab === 'analytics' && <AnalyticsDashboard db={db} deviceId={deviceId} />}
        {currentTab === 'data' && (
          <DataManagement db={db} deviceId={deviceId} onTriggerSync={onTriggerSync} />
        )}
      </AppLayout>
    </ThemeProvider>
  );
};

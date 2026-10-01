import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { AppTheme, Setting } from '@vibehabit/shared';
import type { VibeHabitDatabase } from '../db/database.js';
import { getSetting, saveSetting } from '../db/operations.js';
import { getOrCreateDeviceId, generateUuid } from '../utils/device.js';

interface ThemeContextType {
  theme: AppTheme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: AppTheme) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export interface ThemeProviderProps {
  children: React.ReactNode;
  db?: VibeHabitDatabase;
  initialTheme?: AppTheme;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  db,
  initialTheme
}) => {
  const [theme, setThemeState] = useState<AppTheme>(initialTheme || 'system');
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Load saved theme from Dexie IndexedDB
  useEffect(() => {
    if (!db) return;
    let isMounted = true;
    getSetting(db)
      .then((setting) => {
        if (isMounted && setting?.theme) {
          setThemeState(setting.theme);
        }
      })
      .catch((err) => {
        console.warn('Failed to load theme from IndexedDB:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [db]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
    return undefined;
  }, []);

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (theme === 'system') {
      return systemDark ? 'dark' : 'light';
    }
    return theme;
  }, [theme, systemDark]);

  // Apply .dark class to root document element
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  const setTheme = async (newTheme: AppTheme) => {
    setThemeState(newTheme);
    if (!db) return;
    try {
      const existing = await getSetting(db);
      const deviceId = getOrCreateDeviceId();
      const updatedSetting: Setting = {
        id: existing?.id || generateUuid(),
        jam_mulai_hari: existing?.jam_mulai_hari || '04:00',
        theme: newTheme,
        device_token_hash: existing?.device_token_hash || null,
        updated_at: new Date().toISOString(),
        deleted_at: null,
        device_id: existing?.device_id || deviceId,
        server_seq: existing?.server_seq || null
      };
      await saveSetting(db, updatedSetting, deviceId);
    } catch (err) {
      console.warn('Failed to persist theme to IndexedDB:', err);
    }
  };

  const toggleTheme = async () => {
    const next: AppTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    await setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

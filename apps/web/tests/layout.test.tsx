import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppLayout } from '../src/components/layout/AppLayout.js';
import { SyncStatusBadge } from '../src/components/sync/SyncStatusBadge.js';
import { ThemeProvider } from '../src/theme/ThemeContext.js';
import { App } from '../src/App.js';
import { createDatabase } from '../src/db/database.js';

describe('Layout Shell & Sync Status Badge (T011)', () => {
  describe('SyncStatusBadge', () => {
    it('renders Tersinkron status with teal badge', () => {
      const html = renderToStaticMarkup(
        <SyncStatusBadge state="Tersinkron" />
      );
      expect(html).toContain('Tersinkron');
      expect(html).toContain('bg-teal-50');
      expect(html).toContain('role="status"');
    });

    it('renders Menunggu status with pending count and amber badge', () => {
      const html = renderToStaticMarkup(
        <SyncStatusBadge state="Menunggu sinkron (3)" pendingCount={3} />
      );
      expect(html).toContain('Menunggu sinkron (3)');
      expect(html).toContain('bg-amber-50');
    });

    it('renders Server tidak terjangkau status with rose badge', () => {
      const html = renderToStaticMarkup(
        <SyncStatusBadge state="Server tidak terjangkau (Tailscale aktif?)" />
      );
      expect(html).toContain('Server tidak terjangkau (Tailscale aktif?)');
      expect(html).toContain('bg-rose-50');
    });

    it('renders Jam perangkat tidak akurat status with rose badge', () => {
      const html = renderToStaticMarkup(
        <SyncStatusBadge state="Jam perangkat tidak akurat (>5 menit)" />
      );
      expect(html).toContain('Jam perangkat tidak akurat');
      expect(html).toContain('&gt;5 menit');
      expect(html).toContain('bg-rose-50');
    });

    it('renders Offline status with slate badge', () => {
      const html = renderToStaticMarkup(
        <SyncStatusBadge state="offline" />
      );
      expect(html).toContain('Offline');
      expect(html).toContain('bg-slate-100');
    });
  });

  describe('AppLayout Shell', () => {
    it('renders navigation tabs on both desktop sidebar and mobile bottom nav', () => {
      const html = renderToStaticMarkup(
        <ThemeProvider initialTheme="light">
          <AppLayout currentTab="daily" onTabChange={vi.fn()} syncState="Tersinkron">
            <div data-testid="page-content">Konten Halaman</div>
          </AppLayout>
        </ThemeProvider>
      );

      // Branding
      expect(html).toContain('VibeHabit');
      expect(html).toContain('Serene Focus Tracker');

      // 4 Navigation tabs
      expect(html).toContain('Hari Ini');
      expect(html).toContain('Analitik');
      expect(html).toContain('Kelola');
      expect(html).toContain('Data');

      // Content child
      expect(html).toContain('Konten Halaman');

      // Sync status badge in layout
      expect(html).toContain('Tersinkron');
    });

    it('highlights active navigation tab with aria-current="page"', () => {
      const html = renderToStaticMarkup(
        <ThemeProvider initialTheme="light">
          <AppLayout currentTab="manage" onTabChange={vi.fn()} syncState="Tersinkron">
            <div>Kelola Content</div>
          </AppLayout>
        </ThemeProvider>
      );

      expect(html).toContain('aria-current="page"');
    });

    it('renders AnalyticsDashboard in App when initialTab is analytics', () => {
      const testDb = createDatabase(`test_app_analytics_${Date.now()}`);

      const html = renderToStaticMarkup(
        <App db={testDb} deviceId="test-dev" initialTab="analytics" />
      );

      expect(html).toContain('Dashboard Konsistensi');
      expect(html).toContain('Rasio Keberhasilan');
    });

    it('renders DataManagement in App when initialTab is data', () => {
      const testDb = createDatabase(`test_app_data_${Date.now()}`);

      const html = renderToStaticMarkup(
        <App db={testDb} deviceId="test-dev" initialTab="data" />
      );

      expect(html).toContain('Data &amp; Pengaturan');
      expect(html).toContain('Kedaulatan &amp; Backup Data Mandiri');
    });
  });
});

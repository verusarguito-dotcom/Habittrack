import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  pwaManifest,
  pwaWorkboxConfig,
  pwaOptions,
  createPwaPlugin
} from '../vite.config.js';
import { ReloadPrompt } from '../src/components/pwa/ReloadPrompt.js';
import {
  registerServiceWorker,
  activateWaitingServiceWorker
} from '../src/pwa/registerServiceWorker.js';

describe('T016: PWA Offline Shell & Service Worker', () => {
  describe('Web App Manifest Configuration', () => {
    it('defines authoritative manifest matching PRD §8.4 and ARCHITECTURE §2', () => {
      expect(pwaManifest.name).toBe('VibeHabit');
      expect(pwaManifest.short_name).toBe('VibeHabit');
      expect(pwaManifest.theme_color).toBe('#0D9488');
      expect(pwaManifest.background_color).toBe('#0F172A');
      expect(pwaManifest.display).toBe('standalone');
      expect(pwaManifest.orientation).toBe('portrait-primary');
      expect(pwaManifest.start_url).toBe('/');
      expect(pwaManifest.scope).toBe('/');
    });

    it('includes complete icon suite with 192x192, 512x512, and maskable icons', () => {
      expect(pwaManifest.icons.length).toBeGreaterThanOrEqual(3);

      const icon192 = pwaManifest.icons.find(
        (i) => i.sizes === '192x192' && i.type === 'image/png'
      );
      expect(icon192).toBeDefined();
      expect(icon192?.src).toBe('/icons/icon-192x192.png');

      const icon512 = pwaManifest.icons.find(
        (i) => i.sizes === '512x512' && i.purpose !== 'maskable'
      );
      expect(icon512).toBeDefined();
      expect(icon512?.src).toBe('/icons/icon-512x512.png');

      const iconMaskable = pwaManifest.icons.find(
        (i) => i.purpose === 'maskable'
      );
      expect(iconMaskable).toBeDefined();
      expect(iconMaskable?.src).toBe('/icons/icon-512x512-maskable.png');
    });

    it('verifies manifest.webmanifest exists on disk with valid JSON', () => {
      const manifestPath = path.resolve('apps/web/public/manifest.webmanifest');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const content = fs.readFileSync(manifestPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe('VibeHabit');
      expect(parsed.short_name).toBe('VibeHabit');
      expect(parsed.theme_color).toBe('#0D9488');
      expect(parsed.background_color).toBe('#0F172A');
      expect(parsed.display).toBe('standalone');
      expect(parsed.orientation).toBe('portrait-primary');
    });
  });

  describe('Workbox Offline App Shell Configuration', () => {
    it('configures glob patterns for 100% offline App Shell precaching', () => {
      expect(pwaWorkboxConfig.globPatterns).toBeDefined();
      expect(pwaWorkboxConfig.globPatterns[0]).toContain('js');
      expect(pwaWorkboxConfig.globPatterns[0]).toContain('css');
      expect(pwaWorkboxConfig.globPatterns[0]).toContain('html');
      expect(pwaWorkboxConfig.globPatterns[0]).toContain('svg');
    });

    it('configures runtime caching for Google Fonts with CacheFirst strategy', () => {
      const fontRule = pwaWorkboxConfig.runtimeCaching.find(
        (r) => r.options.cacheName === 'google-fonts-cache'
      );
      expect(fontRule).toBeDefined();
      expect(fontRule?.handler).toBe('CacheFirst');
      expect(fontRule?.options.expiration?.maxAgeSeconds).toBe(60 * 60 * 24 * 365);
    });

    it('configures runtime caching for static assets with StaleWhileRevalidate strategy', () => {
      const assetRule = pwaWorkboxConfig.runtimeCaching.find(
        (r) => r.options.cacheName === 'static-assets-cache'
      );
      expect(assetRule).toBeDefined();
      expect(assetRule?.handler).toBe('StaleWhileRevalidate');
      expect(assetRule?.options.expiration?.maxAgeSeconds).toBe(60 * 60 * 24 * 30);
    });

    it('sets registerType to prompt per ARCHITECTURE §2 specification', () => {
      expect(pwaOptions.registerType).toBe('prompt');
      expect(pwaOptions.includeAssets).toContain('favicon.ico');
    });

    it('creates Vite PWA plugin without error', () => {
      const plugin = createPwaPlugin(pwaOptions);
      expect(plugin.name).toBe('vite-plugin-pwa');
    });
  });

  describe('Static Assets & Service Worker Files on Disk', () => {
    it('verifies presence of all required icon files and App Shell index.html', () => {
      const publicDir = path.resolve('apps/web/public');
      expect(fs.existsSync(path.join(publicDir, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(publicDir, 'sw.js'))).toBe(true);
      expect(fs.existsSync(path.join(publicDir, 'icons/icon.svg'))).toBe(true);
      expect(fs.existsSync(path.join(publicDir, 'icons/icon-192x192.png'))).toBe(true);
      expect(fs.existsSync(path.join(publicDir, 'icons/icon-512x512.png'))).toBe(true);
      expect(fs.existsSync(path.join(publicDir, 'icons/icon-512x512-maskable.png'))).toBe(true);
      expect(fs.existsSync(path.join(publicDir, 'favicon.ico'))).toBe(true);
    });

    it('verifies sw.js implements precaching, navigation fallback, and excludes API routes', () => {
      const swContent = fs.readFileSync(path.resolve('apps/web/public/sw.js'), 'utf-8');
      expect(swContent).toContain("addEventListener('install'");
      expect(swContent).toContain("addEventListener('activate'");
      expect(swContent).toContain("addEventListener('fetch'");
      expect(swContent).toContain("addEventListener('message'");
      expect(swContent).toContain("SKIP_WAITING");
      expect(swContent).toContain("/api/");
      expect(swContent).toContain("vibehabit-shell-v1");
    });
  });

  describe('ReloadPrompt Component Behavior', () => {
    it('returns empty string when neither needRefresh nor offlineReady is active', () => {
      const html = renderToStaticMarkup(
        React.createElement(ReloadPrompt, { needRefresh: false, offlineReady: false })
      );
      expect(html).toBe('');
    });

    it('renders reload notification prompt when needRefresh is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(ReloadPrompt, { needRefresh: true })
      );
      expect(html).toContain('Pembaruan Tersedia');
      expect(html).toContain('Versi baru VibeHabit siap digunakan');
      expect(html).toContain('Muat Ulang');
      expect(html).toContain('Nanti');
    });

    it('renders offline ready banner when offlineReady is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(ReloadPrompt, { needRefresh: false, offlineReady: true })
      );
      expect(html).toContain('Aplikasi Siap Digunakan Offline');
      expect(html).toContain('Tutup');
    });

    it('accepts onReload and onDismiss callback props cleanly', () => {
      const onReload = vi.fn();
      const onDismiss = vi.fn();
      const html = renderToStaticMarkup(
        React.createElement(ReloadPrompt, { needRefresh: true, onReload, onDismiss })
      );
      expect(html).toContain('Muat Ulang');
      expect(html).toContain('Nanti');
    });
  });

  describe('Service Worker Registration Utility', () => {
    it('safely handles environments without serviceWorker support', async () => {
      // In Node.js environment, window/serviceWorker is not present
      const result = await registerServiceWorker('/sw.js');
      expect(result).toBeUndefined();
    });

    it('triggers postMessage SKIP_WAITING when activating waiting worker', () => {
      const postMessage = vi.fn();
      const mockReg = {
        waiting: { postMessage }
      } as unknown as ServiceWorkerRegistration;

      activateWaitingServiceWorker(mockReg);
      expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    });

    it('invokes onNeedRefresh with registration when waiting worker exists', async () => {
      const onNeedRefresh = vi.fn();
      const mockRegistration = {
        waiting: { postMessage: vi.fn() },
        addEventListener: vi.fn()
      };

      const originalWindowDesc = Object.getOwnPropertyDescriptor(globalThis, 'window');
      const originalNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

      Object.defineProperty(globalThis, 'window', {
        value: {},
        configurable: true,
        writable: true
      });
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          serviceWorker: {
            register: vi.fn().mockResolvedValue(mockRegistration)
          }
        },
        configurable: true,
        writable: true
      });

      try {
        const reg = await registerServiceWorker('/sw.js', { onNeedRefresh });
        expect(reg).toBe(mockRegistration);
        expect(onNeedRefresh).toHaveBeenCalledWith(mockRegistration);
      } finally {
        if (originalWindowDesc) {
          Object.defineProperty(globalThis, 'window', originalWindowDesc);
        } else {
          delete (globalThis as Record<string, unknown>).window;
        }
        if (originalNavDesc) {
          Object.defineProperty(globalThis, 'navigator', originalNavDesc);
        } else {
          delete (globalThis as Record<string, unknown>).navigator;
        }
      }
    });
  });

  describe('PWA Build Pipeline (scripts/build.js)', () => {
    it('verifies build script populates apps/web/dist with complete PWA shell', () => {
      const distDir = path.resolve('apps/web/dist');
      expect(fs.existsSync(distDir)).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'manifest.webmanifest'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'sw.js'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'favicon.ico'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'icons/icon-192x192.png'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'icons/icon-512x512.png'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'icons/icon-512x512-maskable.png'))).toBe(true);
    });
  });
});

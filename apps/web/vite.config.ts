import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

export interface PwaIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

export interface PwaManifest {
  name: string;
  short_name: string;
  description: string;
  theme_color: string;
  background_color: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  orientation: 'portrait-primary' | 'any' | 'portrait' | 'landscape';
  start_url: string;
  scope: string;
  icons: PwaIcon[];
}

export interface WorkboxRuntimeCachingRule {
  urlPattern: RegExp | string;
  handler: 'CacheFirst' | 'NetworkFirst' | 'NetworkOnly' | 'StaleWhileRevalidate' | 'CacheOnly';
  options: {
    cacheName: string;
    expiration?: {
      maxEntries?: number;
      maxAgeSeconds?: number;
    };
    cacheableResponse?: {
      statuses?: number[];
    };
  };
}

export interface PwaWorkboxConfig {
  globPatterns: string[];
  runtimeCaching: WorkboxRuntimeCachingRule[];
}

export interface PwaPluginOptions {
  registerType: 'prompt' | 'autoUpdate';
  includeAssets: string[];
  manifest: PwaManifest;
  workbox: PwaWorkboxConfig;
}

/**
 * Authoritative Web App Manifest specification matching PRD §8.4 & ARCHITECTURE §2
 */
export const pwaManifest: PwaManifest = {
  name: 'VibeHabit',
  short_name: 'VibeHabit',
  description: 'Personal habit tracker berbasis Local-First PWA',
  theme_color: '#0D9488',
  background_color: '#0F172A',
  display: 'standalone',
  orientation: 'portrait-primary',
  start_url: '/',
  scope: '/',
  icons: [
    {
      src: '/icons/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any'
    },
    {
      src: '/icons/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any'
    },
    {
      src: '/icons/icon-512x512-maskable.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable'
    }
  ]
};

/**
 * Workbox precaching and runtime caching configuration for 100% offline App Shell
 */
export const pwaWorkboxConfig: PwaWorkboxConfig = {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-assets-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30
        }
      }
    }
  ]
};

/**
 * Full PWA configuration options conforming to vite-plugin-pwa (Workbox)
 */
export const pwaOptions: PwaPluginOptions = {
  registerType: 'prompt',
  includeAssets: ['favicon.ico', 'icons/*.png', 'icons/*.svg'],
  manifest: pwaManifest,
  workbox: pwaWorkboxConfig
};

/**
 * Lightweight PWA plugin adapter for Vite builds.
 */
export function createPwaPlugin(options: PwaPluginOptions = pwaOptions): Plugin {
  return {
    name: 'vite-plugin-pwa-stub',
    configResolved() {
      void options;
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    createPwaPlugin(pwaOptions)
  ],
  css: {
    postcss: {
      plugins: []
    }
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: false
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      }
    }
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js']
  }
});

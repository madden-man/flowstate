/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// The manifest and the first theme-color need literal colours (light.ts updates the meta from --page
// at runtime). They are read from tokens.css so the
// one file stays the only place a colour is written (DESIGN.md rule 1).
const tokens = readFileSync(new URL('./src/ui/tokens.css', import.meta.url), 'utf8');
const token = (block: RegExp, name: string): string => {
  const m = tokens.match(block);
  const v = m && m[0].match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{3,8})`));
  if (!v) throw new Error(`tokens.css: --${name} not found`);
  return v[1];
};
const DAY = /:root, \[data-light="day"\] \{[\s\S]*?\n\}/;
const dayPage = token(DAY, 'page');

const themeMeta = (): Plugin => ({
  name: 'flowstate-theme-meta',
  transformIndexHtml: html => html.replace('%THEME_DAY%', dayPage),
});

export default defineConfig({
  plugins: [
    preact(),
    themeMeta(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FlowState',
        short_name: 'FlowState',
        description: 'Who to Be, How to Flow.',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        background_color: dayPage,
        theme_color: dayPage,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Every built file is precached: the app must open in airplane mode (PLAN.md section 2).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,ico,txt}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { target: 'es2022', sourcemap: false },
  preview: { port: 4173, strictPort: true },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
});

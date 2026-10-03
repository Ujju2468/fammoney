import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
const version = JSON.parse(readFileSync('./package.json', 'utf8')).version
export default defineConfig({ define: { __APP_VERSION__: JSON.stringify(version) }, plugins: [react(), VitePWA({ registerType: 'prompt', includeAssets: ['icon-192.png'],
  manifest: { name: 'FamMoney', short_name: 'FamMoney', start_url: '/', display: 'standalone', background_color: '#0a0a0a', theme_color: '#0a0a0a',
    icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] } })] })

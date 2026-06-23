import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['app-icon.svg'],
            manifest: {
                name: 'Level B Study',
                short_name: 'Level B',
                description: 'Offline practice for Taiwan Web Design Level B written exam.',
                theme_color: '#111713',
                background_color: '#f3f1eb',
                display: 'standalone',
                start_url: '/',
                icons: [
                    {
                        src: '/app-icon.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,json,jpg}'],
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            },
        }),
    ],
});

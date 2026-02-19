import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IoT Report - Monitoring Mesin Jahit',
    short_name: 'IoT Report',
    description: 'Aplikasi monitoring perangkat IoT mesin jahit',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#1e293b',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

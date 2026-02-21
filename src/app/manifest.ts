import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Artesã Aconchegante',
    short_name: 'Aconchegante',
    description: 'Sua loja de tapetes e crochê personalizados e feitos à mão.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f7f2', // HSL 84 48% 95%
    theme_color: '#1b6238',      // HSL 142 69% 34%
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
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
        purpose: 'any',
      },
    ],
  };
}

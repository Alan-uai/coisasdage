import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Nav } from '@/components/nav';
import { Logo } from '@/components/logo';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata: Metadata = {
  title: 'Artesã Aconchegante',
  description: 'Sua loja de tapetes e crochê personalizados.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Literata:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-background font-body antialiased">
        <TooltipProvider>
          <div className="relative flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container flex h-16 items-center">
                <Link href="/" aria-label="Página inicial">
                  <Logo className="h-6 w-6" />
                </Link>
                <div className="flex flex-1 items-center justify-end">
                  <Nav />
                </div>
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}

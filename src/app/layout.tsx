import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Nav } from '@/components/nav';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';

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
      <body className="font-body antialiased">
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <Button variant="ghost" className="h-auto justify-start p-0 text-lg font-bold font-headline" asChild>
                <Link href="/">
                    <Logo className="mr-2 size-6" />
                    Artesã Aconchegante
                </Link>
              </Button>
            </SidebarHeader>
            <SidebarContent>
              <Nav />
            </SidebarContent>
          </Sidebar>
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-16 md:hidden">
              <SidebarTrigger className="md:hidden"/>
              <Button variant="ghost" className="h-auto justify-start p-0 text-base font-bold font-headline" asChild>
                 <Link href="/">
                    <Logo className="mr-2 size-5" />
                    Artesã Aconchegante
                </Link>
              </Button>
            </header>
            {children}
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}

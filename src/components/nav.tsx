'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  ShoppingBag, 
  User, 
  LogIn, 
  LogOut, 
  Menu, 
  Instagram, 
  Facebook, 
  Twitter,
  Mail,
  Phone,
  MapPin,
  MapIcon,
  Package,
  Sparkles
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useUser, useAuth } from '@/firebase';
import { initiateSignOut } from '@/firebase/non-blocking-login';
import { Skeleton } from './ui/skeleton';
import { useState } from 'react';

const menuLinks = [
  { href: '/', label: 'Todos os Produtos' },
  { href: '/orders', label: 'Meus Pedidos' },
  { href: '/faq', label: 'Dúvidas Frequentes' },
  { href: '/ml-auth', label: 'Configurações ML' },
];

export function Nav() {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    if (auth) initiateSignOut(auth);
  };

  return (
    <div className="flex w-full items-center justify-between">
      {/* Logo Section */}
      <Link href="/" className="flex items-center gap-2 group">
        <div className="bg-primary p-1.5 rounded-lg text-primary-foreground group-hover:scale-110 transition-transform">
          <Sparkles className="size-5" />
        </div>
        <span className="text-xl font-bold font-headline text-primary tracking-tight">Crochetique</span>
      </Link>

      <div className="flex items-center gap-2">
        {/* Cart Icon */}
        <Button asChild variant="ghost" size="icon" className="relative">
          <Link href="/cart">
            <ShoppingBag className="size-5 text-primary" />
          </Link>
        </Button>

        {/* User Profile / Login */}
        {isUserLoading ? (
          <Skeleton className="size-9 rounded-full" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative size-9 rounded-full p-0">
                <Avatar className="size-9">
                  <AvatarImage src={user.photoURL || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {user.displayName?.charAt(0) || <User />}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/orders"><Package className="mr-2 size-4" /> Meus Pedidos</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/addresses"><MapIcon className="mr-2 size-4" /> Meus Endereços</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 size-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild variant="ghost" size="icon">
            <Link href="/login"><LogIn className="size-5 text-primary" /></Link>
          </Button>
        )}

        {/* Hamburger Menu - Image Inspired */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="size-6 text-primary" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md bg-primary p-0 border-none">
            <div className="flex flex-col h-full text-primary-foreground p-8">
              {/* Social Icons */}
              <div className="flex gap-6 mb-12">
                <Instagram className="size-6 cursor-pointer hover:opacity-80" />
                <Facebook className="size-6 cursor-pointer hover:opacity-80" />
                <Twitter className="size-6 cursor-pointer hover:opacity-80" />
              </div>

              {/* Navigation Links */}
              <div className="flex flex-col gap-6 text-2xl font-bold font-headline mb-auto">
                <p className="text-xs uppercase tracking-widest opacity-60 mb-2">Explorar</p>
                {menuLinks.map((link) => (
                  <Link 
                    key={link.href} 
                    href={link.href} 
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "transition-colors hover:text-white/80",
                      pathname === link.href && "underline underline-offset-8"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Contact Info */}
              <div className="space-y-6 mt-12 border-t border-white/20 pt-8">
                <p className="text-xs uppercase tracking-widest opacity-60 mb-2">Contato</p>
                <div className="flex items-center gap-3">
                  <Mail className="size-5 text-accent" />
                  <span className="text-sm">ola@crochetique.com.br</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="size-5 text-accent" />
                  <span className="text-sm">+55 (11) 99999-9999</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="size-5 text-accent" />
                  <span className="text-sm">Feito à mão no interior de SP</span>
                </div>
              </div>

              {/* Footer inside menu */}
              <div className="mt-12 text-[10px] opacity-40">
                © 2024 Crochetique. Todos os direitos reservados.
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
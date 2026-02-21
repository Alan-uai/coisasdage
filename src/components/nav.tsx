'use client';

import Link from 'next/navigation';
import { usePathname } from 'next/navigation';
import NextLink from 'next/link';
import { 
  ShoppingBag, 
  User, 
  LogIn, 
  LogOut, 
  Home,
  Package,
  MapIcon,
  ShieldCheck
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from '@/components/ui/button';
import { useUser, useAuth } from '@/firebase';
import { initiateSignOut } from '@/firebase/non-blocking-login';
import { Skeleton } from './ui/skeleton';
import { useMemo } from 'react';

const ADMIN_EMAILS = ['aymatsu00@gmail.com', 'hashiramanakamoto0@gmail.com'];

export function Nav() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();

  const handleLogout = () => {
    if (auth) initiateSignOut(auth);
  };

  const isAdmin = useMemo(() => {
    return user?.email && ADMIN_EMAILS.includes(user.email);
  }, [user]);

  return (
    <div className="flex w-full items-center justify-between px-4 sm:px-6">
      {/* Navigation Icons Section */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" title="Início">
          <NextLink href="/">
            <Home className="size-5 text-primary" />
          </NextLink>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {/* Cart Icon */}
        <Button asChild variant="ghost" size="icon" className="relative" title="Carrinho">
          <NextLink href="/cart">
            <ShoppingBag className="size-5 text-primary" />
          </NextLink>
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
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <NextLink href="/admin"><ShieldCheck className="mr-2 size-4" /> Painel da Artesã</NextLink>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <NextLink href="/orders"><Package className="mr-2 size-4" /> Meus Pedidos</NextLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NextLink href="/settings/addresses"><MapIcon className="mr-2 size-4" /> Meus Endereços</NextLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 size-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild variant="ghost" size="icon" title="Entrar">
            <NextLink href="/login"><LogIn className="size-5 text-primary" /></NextLink>
          </Button>
        )}
      </div>
    </div>
  );
}

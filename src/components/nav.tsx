'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutGrid, Package, ShoppingBag, HelpCircle, User, LogIn, LogOut } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { useUser, useAuth } from '@/firebase';
import { initiateSignOut } from '@/firebase/non-blocking-login';
import { Button } from '@/components/ui/button';
import { Skeleton } from './ui/skeleton';

const mainLinks = [
  { href: '/', label: 'Catálogo', icon: LayoutGrid },
  { href: '/orders', label: 'Meus Pedidos', icon: Package },
  { href: '/cart', label: 'Carrinho', icon: ShoppingBag },
  { href: '/faq', label: 'Dúvidas', icon: HelpCircle },
];

function UserNav() {
    const { user, isUserLoading } = useUser();
    const auth = useAuth();

    const handleLogout = () => {
        if (auth) {
            initiateSignOut(auth);
        }
    };
    
    if (isUserLoading) {
        return <Skeleton className="h-10 w-10 rounded-full" />;
    }

    if (!user) {
        return (
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button asChild variant="ghost" size="icon">
                            <Link href="/login" aria-label="Login">
                                <LogIn className="h-5 w-5" />
                            </Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Login</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }

    return (
        <DropdownMenu>
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                             <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'Avatar do usuário'} />
                                    <AvatarFallback>
                                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User />}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Meu Perfil</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 items-center justify-around">
      {mainLinks.map((link) => (
        <TooltipProvider key={link.href} delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={link.href}
                className={cn(
                  buttonVariants({ 
                    variant: pathname === link.href ? "secondary" : "ghost", 
                    size: "icon" 
                  }),
                )}
                aria-label={link.label}
              >
                <link.icon className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>{link.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
      <UserNav />
    </nav>
  );
}

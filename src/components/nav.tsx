'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutGrid, Package, Palette, ShoppingBag, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

const links = [
  { href: '/', label: 'Catálogo', icon: LayoutGrid },
  { href: '/orders', label: 'Meus Pedidos', icon: Package },
  { href: '/design', label: 'Design IA', icon: Palette },
  { href: '/cart', label: 'Carrinho', icon: ShoppingBag },
  { href: '/faq', label: 'Dúvidas', icon: HelpCircle },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 items-center justify-around">
      {links.map((link) => (
        <Tooltip key={link.href} delayDuration={0}>
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
      ))}
    </nav>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { LayoutGrid, Package, Palette, ShoppingBag } from 'lucide-react';

const links = [
  { href: '/', label: 'Catálogo', icon: LayoutGrid },
  { href: '/orders', label: 'Meus Pedidos', icon: Package },
  { href: '/design', label: 'Design IA', icon: Palette },
  { href: '/cart', label: 'Carrinho', icon: ShoppingBag },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {links.map((link) => (
        <SidebarMenuItem key={link.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === link.href}
            className="w-full"
          >
            <Link href={link.href}>
              <link.icon className="size-4" />
              <span>{link.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

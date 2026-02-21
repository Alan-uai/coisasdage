'use client';

import { useUser, useFirestore } from '@/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminOrders } from './admin-orders';
import { AdminRequests } from './admin-requests';
import { ShieldCheck, Package, ClipboardList } from 'lucide-react';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

const ADMIN_EMAILS = ['aymatsu00@gmail.com', 'hashiramanakamoto0@gmail.com'];

export default function AdminDashboardPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const isAdmin = useMemo(() => {
    return user?.email && ADMIN_EMAILS.includes(user.email);
  }, [user]);

  if (isUserLoading) return <div className="p-8 animate-pulse">Carregando painel...</div>;

  // Em produção, você pode descomentar esta linha para restringir o acesso
  // if (!isAdmin) { router.push('/'); return null; }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-headline flex items-center gap-3">
            <ShieldCheck className="size-10 text-primary" /> Painel da Artesã
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie seus pedidos e solicitações sob demanda.</p>
        </div>
      </header>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="orders" className="gap-2">
            <Package className="size-4" /> Pedidos Pagos
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <ClipboardList className="size-4" /> Sob Demanda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6">
          <AdminOrders />
        </TabsContent>
        <TabsContent value="requests" className="mt-6">
          <AdminRequests />
        </TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, ClipboardList, ShoppingBag, Loader2 } from 'lucide-react';
import { AdminRequests } from './admin-requests';
import { AdminOrders } from './admin-orders';

const ADMIN_EMAILS = ['aymatsu00@gmail.com', 'hashiramanakamoto0@gmail.com'];

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const isAdmin = useMemo(() => {
    return user?.email && ADMIN_EMAILS.includes(user.email);
  }, [user]);

  useEffect(() => {
    if (!isUserLoading) {
      if (!user || !isAdmin) {
        router.push('/');
      }
    }
  }, [user, isAdmin, isUserLoading, router]);

  if (isUserLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-8 text-primary" />
            <h1 className="text-4xl font-bold font-headline">Painel da Artesã</h1>
          </div>
          <p className="text-muted-foreground">Gerencie suas encomendas e solicitações exclusivas.</p>
        </div>
      </header>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 max-w-md">
          <TabsTrigger value="requests" className="gap-2">
            <ClipboardList className="size-4" /> Solicitações
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingBag className="size-4" /> Pedidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações Sob Demanda</CardTitle>
              <CardDescription>Analise a viabilidade e defina o preço final para peças personalizadas.</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminRequests />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Confirmados</CardTitle>
              <CardDescription>Atualize o status de produção e envie os códigos de rastreio.</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminOrders />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);

  const isAdmin = useMemo(() => {
    return user?.email && ADMIN_EMAILS.includes(user.email);
  }, [user]);

  useEffect(() => {
    if (!isUserLoading) {
      if (!user || !isAdmin) {
        router.push('/');
      } else {
        // Garantir que o token de autenticação foi propagado antes de montar as queries
        const timer = setTimeout(() => setIsVerifiedAdmin(true), 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [user, isAdmin, isUserLoading, router]);

  if (isUserLoading || (isAdmin && !isVerifiedAdmin)) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Autenticando acesso de artesã...</p>
        </div>
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
              {isVerifiedAdmin && <AdminRequests />}
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
              {isVerifiedAdmin && <AdminOrders />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

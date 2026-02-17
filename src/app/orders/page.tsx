'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, Timestamp } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Truck, PackageSearch, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Order } from '@/lib/types';

const statusMap = {
  Processing: { text: 'Processando', value: 25, variant: 'secondary' },
  Crafting: { text: 'Em Produção', value: 50, variant: 'default' },
  Shipped: { text: 'Enviado', value: 75, variant: 'default' },
  Delivered: { text: 'Entregue', value: 100, variant: 'outline' },
} as const;


function OrderCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <Skeleton className="h-[100px] w-[150px] rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
        <Separator className="my-4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-2 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrdersPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(
    () => (user && firestore ? collection(firestore, 'users', user.uid, 'orders') : null),
    [user, firestore]
  );

  const { data: orders, isLoading: isOrdersLoading } = useCollection<Order>(ordersQuery);

  if (isUserLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight font-headline">Meus Pedidos</h1>
          <p className="text-muted-foreground mt-2">Acompanhe o progresso de suas encomendas.</p>
        </header>
        <OrderCardSkeleton />
        <OrderCardSkeleton />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-center p-4">
        <LogIn className="size-16 text-muted-foreground" />
        <h1 className="text-4xl font-bold tracking-tight font-headline mt-6">Faça Login para Ver Seus Pedidos</h1>
        <p className="text-muted-foreground mt-2">Você precisa estar conectado para visualizar seu histórico de pedidos.</p>
        <Button asChild className="mt-6">
          <Link href="/login">Fazer Login</Link>
        </Button>
      </div>
    )
  }

  if (!isOrdersLoading && (!orders || orders.length === 0)) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-center p-4">
        <PackageSearch className="size-16 text-muted-foreground" />
        <h1 className="text-4xl font-bold tracking-tight font-headline mt-6">Nenhum Pedido Encontrado</h1>
        <p className="text-muted-foreground mt-2">Parece que você ainda não fez nenhum pedido.</p>
        <Button asChild className="mt-6">
          <Link href="/">Explorar Catálogo</Link>
        </Button>
      </div>
    )
  }
  
  const sortedOrders = useMemo(() => {
    return orders?.sort((a, b) => b.orderDate.toMillis() - a.orderDate.toMillis()) || [];
  }, [orders]);


  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight font-headline">Meus Pedidos</h1>
        <p className="text-muted-foreground mt-2">Acompanhe o progresso de suas encomendas.</p>
      </header>
      <main className="flex-1 space-y-6">
        {isOrdersLoading ? (
            <>
                <OrderCardSkeleton />
                <OrderCardSkeleton />
            </>
        ) : (
          sortedOrders.map((order) => {
            const statusInfo = statusMap[order.status];
            return (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div>
                      <CardTitle className="font-headline text-xl">Pedido #{order.id.substring(0,6)}</CardTitle>
                      <CardDescription>
                        Realizado em {order.orderDate.toDate().toLocaleDateString('pt-BR')}
                      </CardDescription>
                    </div>
                    {statusInfo && <Badge variant={statusInfo.variant}>{statusInfo.text}</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {order.items?.map(item => (
                       <div key={item.productId} className="flex flex-col sm:flex-row gap-4">
                         <Link href={`/products/${item.productId}`} className="block flex-shrink-0">
                           <Image
                             src={item.imageUrl}
                             alt={item.productName}
                             width={150}
                             height={100}
                             className="rounded-md object-cover aspect-[3/2]"
                           />
                         </Link>
                         <div className="flex-1">
                           <Link href={`/products/${item.productId}`} className="font-semibold hover:underline">{item.productName}</Link>
                           <p className="text-sm text-muted-foreground">Quantidade: {item.quantity}</p>
                           <p className="text-sm font-semibold">R$ {(item.unitPriceAtOrder * item.quantity).toFixed(2).replace('.', ',')}</p>
                         </div>
                       </div>
                    ))}
                  </div>

                  <Separator className="my-4" />
                   <p className="text-right font-bold text-lg mb-4">Total: R$ {order.totalAmount.toFixed(2).replace('.', ',')}</p>
                  
                  {order.trackingNumber && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-primary">
                            <Truck className="size-4" />
                            <span className="font-medium">Rastreamento:</span>
                            <a href="#" className="font-mono hover:underline">{order.trackingNumber}</a>
                        </div>
                    )}

                  {statusInfo && (
                    <>
                      <Separator className="my-4" />
                      <div>
                        <Label htmlFor={`progress-${order.id}`} className="mb-2 block text-sm font-medium">Progresso do Pedido</Label>
                        <Progress id={`progress-${order.id}`} value={statusInfo.value} className="h-2" />
                        <div className="hidden sm:flex justify-between text-xs text-muted-foreground mt-1">
                          <span>Processando</span>
                          <span>Em Produção</span>
                          <span>Enviado</span>
                          <span>Entregue</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}

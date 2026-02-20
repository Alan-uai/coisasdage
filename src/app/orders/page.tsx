
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ShoppingBag, 
  ChevronRight, 
  Truck, 
  Hammer,
  ClipboardList
} from 'lucide-react';
import type { Order, CustomRequest } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function MyOrdersPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // Busca pedidos confirmados (pagos ou em processamento)
  const ordersQuery = useMemoFirebase(
    () => (user && firestore ? query(
      collection(firestore, 'users', user.uid, 'orders'),
      orderBy('createdAt', 'desc'),
      limit(20)
    ) : null),
    [user, firestore]
  );
  const { data: orders, isLoading: isOrdersLoading } = useCollection<Order>(ordersQuery);

  // Busca solicitações sob demanda (em análise pela artesã)
  const requestsQuery = useMemoFirebase(
    () => (user && firestore ? query(
      collection(firestore, 'custom_requests'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    ) : null),
    [user, firestore]
  );
  const { data: requests, isLoading: isRequestsLoading } = useCollection<CustomRequest>(requestsQuery);

  if (isUserLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <Package className="size-16 text-muted-foreground mb-4" />
        <h1 className="text-3xl font-bold font-headline">Acesse seus Pedidos</h1>
        <p className="text-muted-foreground mt-2">Faça login para acompanhar suas encomendas artesanais.</p>
        <Button asChild className="mt-6">
          <Link href="/login">Fazer Login</Link>
        </Button>
      </div>
    );
  }

  const getOrderStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'Processing':
        return <Badge variant="secondary"><Clock className="size-3 mr-1" /> Processando</Badge>;
      case 'Crafting':
        return <Badge variant="default" className="bg-amber-500 hover:bg-amber-600"><Hammer className="size-3 mr-1" /> Em Produção</Badge>;
      case 'Shipped':
        return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600"><Truck className="size-3 mr-1" /> Enviado</Badge>;
      case 'Delivered':
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="size-3 mr-1" /> Entregue</Badge>;
      case 'Cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRequestStatusBadge = (status: CustomRequest['status']) => {
    switch (status) {
      case 'Pending':
        return <Badge variant="secondary"><Clock className="size-3 mr-1" /> Em Análise</Badge>;
      case 'Approved':
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="size-3 mr-1" /> Aprovado</Badge>;
      case 'Contested':
        return <Badge variant="destructive"><AlertCircle className="size-3 mr-1" /> Revisão Necessária</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
      <header>
        <h1 className="text-4xl font-bold tracking-tight font-headline">Minhas Encomendas</h1>
        <p className="text-muted-foreground mt-2">Acompanhe o status das suas peças feitas à mão.</p>
      </header>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingBag className="size-4" /> Pedidos
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <ClipboardList className="size-4" /> Sob Demanda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          {isOrdersLoading ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
          ) : !orders || orders.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/20">
              <ShoppingBag className="size-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Você ainda não tem pedidos finalizados.</p>
              <Button asChild variant="link" className="mt-2"><Link href="/">Explorar Catálogo</Link></Button>
            </div>
          ) : (
            orders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    <div className="p-6 flex-1 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Pedido #{order.id.slice(-6).toUpperCase()}</p>
                          <h3 className="text-lg font-bold">
                            {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                          </h3>
                        </div>
                        {getOrderStatusBadge(order.status)}
                      </div>
                      
                      <div className="flex -space-x-2 overflow-hidden">
                        {order.items.slice(0, 4).map((item, idx) => (
                          <div key={idx} className="relative size-12 rounded-full border-2 border-background bg-muted overflow-hidden">
                            <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                          </div>
                        ))}
                        {order.items.length > 4 && (
                          <div className="size-12 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-bold">
                            +{order.items.length - 4}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-end">
                        <div className="text-sm text-muted-foreground">
                          Realizado em {order.createdAt?.toDate().toLocaleDateString('pt-BR')}
                        </div>
                        <div className="text-xl font-bold text-primary">
                          R$ {order.totalAmount.toFixed(2).replace('.', ',')}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {isRequestsLoading ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
          ) : !requests || requests.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/20">
              <ClipboardList className="size-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhuma solicitação sob demanda no momento.</p>
            </div>
          ) : (
            requests.map((request) => (
              <Card key={request.id} className="border-primary/10">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-headline">Solicitação de Orçamento</CardTitle>
                    {getRequestStatusBadge(request.status)}
                  </div>
                  <CardDescription>
                    Enviada em {request.createdAt?.toDate().toLocaleDateString('pt-BR')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {request.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm">
                        <div className="size-10 relative rounded bg-muted overflow-hidden">
                          <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">{item.selectedColor} | {item.selectedSize}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t">
                    <div className="text-xl font-bold text-primary">
                      R$ {request.finalPrice.toFixed(2).replace('.', ',')}
                    </div>
                    {request.status === 'Approved' && (
                      <Button asChild size="sm">
                        <Link href="/checkout">
                          Pagar agora <ChevronRight className="size-4 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </div>
                  
                  {request.adminNotes && (
                    <div className="bg-muted p-3 rounded-md text-sm italic">
                      <span className="font-bold not-italic">Nota da Artesã:</span> {request.adminNotes}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

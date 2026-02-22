
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  ShoppingBag, 
  Truck, 
  PackageCheck,
  ClipboardList,
  MessageCircle,
  Sparkles,
  Ticket
} from 'lucide-react';
import type { Order, CustomRequest } from '@/lib/types';
import { useState, useEffect } from 'react';
import { getMLShipmentTracking } from '@/lib/mercado-livre';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";

export default function MyOrdersPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [trackingInfo, setTrackingInfo] = useState<Record<string, any>>({});

  const ordersQuery = useMemoFirebase(
    () => (user && firestore ? query(
      collection(firestore, 'users', user.uid, 'orders'),
      orderBy('createdAt', 'desc'),
      limit(20)
    ) : null),
    [user, firestore]
  );
  const { data: orders, isLoading: isOrdersLoading } = useCollection<Order>(ordersQuery);

  const requestsQuery = useMemoFirebase(
    () => (user && firestore ? query(
      collection(firestore, 'users', user.uid, 'custom_requests'),
      orderBy('createdAt', 'desc'),
      limit(20)
    ) : null),
    [user, firestore]
  );
  const { data: requests, isLoading: isRequestsLoading } = useCollection<CustomRequest>(requestsQuery);

  useEffect(() => {
    if (orders) {
      orders.forEach(order => {
        if (order.merchantOrderId && (order.status === 'Shipped' || order.status === 'LABEL_GENERATED')) {
           getMLShipmentTracking(order.merchantOrderId).then(res => {
             if (res.success) {
               setTrackingInfo(prev => ({ ...prev, [order.id]: res }));
             }
           });
        }
      });
    }
  }, [orders]);

  if (isUserLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <Package className="size-16 text-muted-foreground mb-4" />
        <h1 className="text-3xl font-bold font-headline">Acesse seus Pedidos</h1>
        <Button asChild className="mt-6"><Link href="/login">Fazer Login</Link></Button>
      </div>
    );
  }

  const getStatusBadge = (status: Order['status'] | CustomRequest['status']) => {
    switch (status) {
      // Order Statuses
      case 'Processing': return <Badge variant="secondary"><Clock className="size-3 mr-1" /> Processando Pagamento</Badge>;
      case 'IN_PRODUCTION': return <Badge variant="default" className="bg-amber-500"><Package className="size-3 mr-1" /> Preparando Envio</Badge>;
      case 'READY': return <Badge variant="default" className="bg-cyan-500"><PackageCheck className="size-3 mr-1" /> Pronto para Envio</Badge>;
      case 'LABEL_GENERATED': return <Badge variant="default" className="bg-purple-500"><Ticket className="size-3 mr-1" /> Etiqueta Gerada</Badge>;
      case 'Shipped': return <Badge variant="default" className="bg-blue-500"><Truck className="size-3 mr-1" /> Enviado</Badge>;
      case 'Delivered': return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="size-3 mr-1" /> Entregue</Badge>;
      case 'Cancelled': return <Badge variant="destructive">Cancelado</Badge>;
      
      // CustomRequest Statuses
      case 'Approved': return <Badge variant="default" className="bg-emerald-500"><Sparkles className="size-3 mr-1" /> Orçamento Aprovado</Badge>;
      case 'Pending': return <Badge variant="outline"><MessageCircle className="size-3 mr-1" /> Em Negociação</Badge>;
      
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
      <header>
        <h1 className="text-4xl font-bold font-headline">Minhas Encomendas</h1>
        <p className="text-muted-foreground mt-2">Acompanhe o status das suas peças exclusivas.</p>
      </header>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="orders" className="gap-2"><ShoppingBag className="size-4" /> Pronta Entrega</TabsTrigger>
          <TabsTrigger value="requests" className="gap-2"><ClipboardList className="size-4" /> Sob Demanda</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          {isOrdersLoading ? <Skeleton className="h-32 w-full" /> : !orders || orders.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/20">
              <ShoppingBag className="size-12 mx-auto text-muted-foreground mb-4" />
              <p>Você ainda não tem pedidos finalizados.</p>
            </div>
          ) : (
            orders.map((order) => (
              <Card key={order.id} className="border-primary/10 overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold">Pedido #{order.id.slice(-6).toUpperCase()}</p>
                      <h3 className="text-lg font-bold">{order.items[0].productName} {order.items.length > 1 ? `(+${order.items.length - 1})` : ''}</h3>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="flex gap-2">
                    {order.items.map((item, i) => (
                      <div key={i} className="size-12 relative rounded-full border bg-muted overflow-hidden">
                        <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-end border-t pt-4">
                    <p className="text-xs text-muted-foreground">{order.createdAt?.toDate().toLocaleDateString('pt-BR')}</p>
                    <p className="text-xl font-bold text-primary">R$ {order.totalAmount.toFixed(2).replace('.', ',')}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {isRequestsLoading ? <Skeleton className="h-32 w-full" /> : !requests || requests.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/20">
              <ClipboardList className="size-12 mx-auto text-muted-foreground mb-4" />
              <p>Nenhuma solicitação sob demanda encontrada.</p>
            </div>
          ) : (
            requests.map((req) => (
              <Card key={req.id} className="border-accent/20 bg-accent/5">
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-muted-foreground font-bold">SOLICITAÇÃO #{req.id.slice(-6).toUpperCase()}</p>
                      <h3 className="text-lg font-bold">{req.items[0].productName}</h3>
                    </div>
                    {getStatusBadge(req.status)}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="size-16 relative rounded-md overflow-hidden border">
                      <Image src={req.items[0].imageUrl} alt={req.items[0].productName} fill className="object-cover" />
                    </div>
                    <div className="text-sm">
                      <p><strong>Tamanho:</strong> {req.items[0].selectedSize}</p>
                      <p><strong>Cor:</strong> {req.items[0].selectedColor}</p>
                    </div>
                  </div>
                  {req.status === 'Approved' && (
                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 space-y-1">
                      <p className="text-sm font-bold text-emerald-800">ORÇAMENTO APROVADO</p>
                      <p className="text-sm text-emerald-700">Prazo de confecção: {req.productionDays || 7} dias.</p>
                      <p className="text-xs text-emerald-600 pt-1">O pagamento será combinado diretamente pelo WhatsApp.</p>
                    </div>
                  )}
                  {req.status === 'Pending' && (
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`https://wa.me/${WHATSAPP_NUMBER}`}>Falar com a Gê no WhatsApp</Link>
                    </Button>
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

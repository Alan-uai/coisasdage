
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, doc, Timestamp } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
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
  Ticket,
  ArrowRight,
  Pencil
} from 'lucide-react';
import type { Order, CustomRequest } from '@/lib/types';
import { useState, useEffect } from 'react';
import { getMLShipmentTracking } from '@/lib/mercado-livre';
import { EditAddressDialog } from '@/components/edit-address-dialog';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";

function Countdown({ expiryTimestamp }: { expiryTimestamp: Timestamp }) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    const expiryTime = expiryTimestamp.toDate().getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = expiryTime - now;

      if (distance < 0) {
        setTimeLeft('Expirado');
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);

    return () => clearInterval(intervalId);
  }, [expiryTimestamp]);

  if (!timeLeft) return null;

  return (
    <div className={`flex items-center gap-2 font-mono text-xs ${timeLeft === 'Expirado' ? 'text-destructive' : 'text-amber-700'}`}>
      <Clock className="size-3" />
      <span>{timeLeft === 'Expirado' ? 'Pagamento expirado' : `Pagamento expira em ${timeLeft}`}</span>
    </div>
  );
}

export default function MyOrdersPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [trackingInfo, setTrackingInfo] = useState<Record<string, any>>({});
  const [editingItem, setEditingItem] = useState<{ type: 'order' | 'request', data: Order | CustomRequest } | null>(null);

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

  useEffect(() => {
    // Client-side cleanup of expired 'Processing' orders.
    if (firestore && user?.uid && orders) {
      const now = new Date();
      orders.forEach(order => {
        if (order.status === 'Processing' && order.expiresAt && order.expiresAt.toDate() < now) {
          console.log(`Cleaning up expired order: ${order.id}`);
          const orderRef = doc(firestore, 'users', user.uid, 'orders', order.id);
          deleteDocumentNonBlocking(orderRef);
        }
      });
    }
  }, [orders, firestore, user]);

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
      case 'Pending': return <Badge variant="outline"><MessageCircle className="size-3 mr-1" /> Em Negociação</Badge>;
      case 'Approved': return <Badge variant="default" className="bg-amber-500"><Sparkles className="size-3 mr-1" /> Em Produção</Badge>;
      
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

                  {order.status === 'Processing' && order.expiresAt && (
                    <div className="bg-amber-50 border border-amber-200/50 p-3 rounded-lg flex justify-between items-center">
                      <Countdown expiryTimestamp={order.expiresAt} />
                      <Button asChild size="sm">
                        <Link href={`/checkout?order_id=${order.id}`}>
                          Continuar Pagamento
                          <ArrowRight className="ml-2 size-4" />
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
                 <CardFooter className="p-4 bg-muted/30 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      {(order.status === 'Processing' || order.status === 'IN_PRODUCTION') && (
                          <Button variant="outline" size="sm" onClick={() => setEditingItem({ type: 'order', data: order })}>
                              <Pencil className="mr-2 size-3" /> Editar Endereço
                          </Button>
                      )}
                    </div>
                    <p className="text-xl font-bold text-primary">R$ {order.totalAmount.toFixed(2).replace('.', ',')}</p>
                </CardFooter>
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
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-amber-800 text-sm">
                      <p><strong>Prazo de confecção:</strong> {req.productionDays || 7} dias.</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mt-4">
                     {req.status === 'Pending' && (
                        <Button variant="secondary" onClick={() => setEditingItem({ type: 'request', data: req })}>
                            <Pencil className="mr-2 size-4" /> Alterar Endereço
                        </Button>
                     )}
                     <Button asChild variant="outline" className="w-full">
                        <Link href={`https://wa.me/${WHATSAPP_NUMBER}?text=Olá!%20Gostaria%20de%20falar%20sobre%20a%20solicitação%20#${req.id.slice(-6).toUpperCase()}`}>
                          Falar com a Gê no WhatsApp
                        </Link>
                      </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <EditAddressDialog
        item={editingItem}
        onClose={() => setEditingItem(null)}
      />
    </div>
  );
}

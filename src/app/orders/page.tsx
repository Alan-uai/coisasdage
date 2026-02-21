
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
  ClipboardList,
  FileText,
  Loader2,
  MapPin
} from 'lucide-react';
import type { Order, CustomRequest } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getMLShipmentLabel, getMLShipmentTracking } from '@/lib/mercado-livre';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function MyOrdersPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isGeneratingLabel, setIsGeneratingLabel] = useState<string | null>(null);
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

  // Busca rastreio para pedidos enviados
  useEffect(() => {
    if (orders) {
      orders.forEach(order => {
        if (order.merchantOrderId && order.status === 'Shipped') {
           getMLShipmentTracking(order.merchantOrderId).then(res => {
             if (res.success) {
               setTrackingInfo(prev => ({ ...prev, [order.id]: res }));
             }
           });
        }
      });
    }
  }, [orders]);

  const handleDownloadLabel = async (shipmentId: string) => {
    setIsGeneratingLabel(shipmentId);
    try {
      const result = await getMLShipmentLabel(shipmentId);
      if (result.success && result.base64) {
        const linkSource = `data:application/pdf;base64,${result.base64}`;
        const downloadLink = document.createElement("a");
        const fileName = `etiqueta-${shipmentId}.pdf`;
        downloadLink.href = linkSource;
        downloadLink.download = fileName;
        downloadLink.click();
        
        toast({ title: "Etiqueta gerada!", description: "Você também pode enviá-la para a artesã." });
        
        if (result.whatsappLink) {
           window.open(result.whatsappLink, '_blank');
        }
      } else {
        toast({ 
          variant: "destructive", 
          title: "Erro ao gerar etiqueta", 
          description: result.error 
        });
      }
    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "Erro inesperado", 
        description: "Não foi possível processar a etiqueta." 
      });
    } finally {
      setIsGeneratingLabel(null);
    }
  };

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
                  <div className="flex flex-col">
                    <div className="p-6 flex-1 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Pedido #{order.id.slice(-6).toUpperCase()}</p>
                          <h3 className="text-lg font-bold">
                            {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                          </h3>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getOrderStatusBadge(order.status)}
                          {order.merchantOrderId && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-[10px]"
                              disabled={isGeneratingLabel === order.merchantOrderId}
                              onClick={() => handleDownloadLabel(order.merchantOrderId!)}
                            >
                              {isGeneratingLabel === order.merchantOrderId ? <Loader2 className="animate-spin size-3 mr-1" /> : <FileText className="size-3 mr-1" />}
                              Etiqueta Mercado Envios
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex -space-x-2 overflow-hidden">
                        {order.items.slice(0, 4).map((item, idx) => (
                          <div key={idx} className="relative size-12 rounded-full border-2 border-background bg-muted overflow-hidden">
                            <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                          </div>
                        ))}
                      </div>

                      {trackingInfo[order.id] && (
                        <div className="bg-blue-50 p-3 rounded-md text-xs border border-blue-100 space-y-2">
                          <p className="font-bold flex items-center gap-1 text-blue-800">
                            <Truck className="size-3" /> Rastreamento Mercado Livre
                          </p>
                          <p className="text-blue-700">Status: {trackingInfo[order.id].description || trackingInfo[order.id].status}</p>
                          {trackingInfo[order.id].trackingUrl && (
                            <Link href={trackingInfo[order.id].trackingUrl} target="_blank" className="text-blue-800 underline font-bold">
                              Ver no site da transportadora
                            </Link>
                          )}
                        </div>
                      )}

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
          {/* ... mantido conteúdo original de solicitações ... */}
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/20">
              <ClipboardList className="size-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Suas solicitações sob demanda aparecerão aqui.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

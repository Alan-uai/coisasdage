'use client';

import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser } from '@/firebase';
import { collectionGroup, query, orderBy, limit, doc, serverTimestamp } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Truck, Hammer, CheckCircle2, Clock, XCircle, Info, Loader2 } from 'lucide-react';
import type { Order } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { getMLShipmentLabel } from '@/lib/mercado-livre';
import { useToast } from '@/hooks/use-toast';

export function AdminOrders() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const ordersQuery = useMemoFirebase(
    () => (firestore ? query(collectionGroup(firestore, 'orders'), orderBy('createdAt', 'desc'), limit(50)) : null),
    [firestore]
  );

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const handleUpdateStatus = async (order: Order, status: Order['status']) => {
    if (!firestore) return;
    
    setIsProcessing(order.id);

    try {
      // Automação: Se o status for alterado para 'Shipped', gera a etiqueta e abre o WhatsApp automaticamente
      if (status === 'Shipped' && order.merchantOrderId) {
        toast({ title: "Gerando etiqueta...", description: "Aguarde o redirecionamento para o WhatsApp." });
        const labelResult = await getMLShipmentLabel(order.merchantOrderId);
        if (labelResult.success && labelResult.whatsappLink) {
          window.open(labelResult.whatsappLink, '_blank');
          toast({ title: "Sucesso!", description: "Etiqueta enviada para o WhatsApp." });
        } else {
          toast({ variant: "destructive", title: "Erro na logística", description: labelResult.error || "Não foi possível gerar a etiqueta." });
        }
      }

      const orderRef = doc(firestore, 'users', order.userId, 'orders', order.id);
      updateDocumentNonBlocking(orderRef, {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(null);
    }
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'Processing': return <Clock className="size-3 mr-1" />;
      case 'Crafting': return <Hammer className="size-3 mr-1" />;
      case 'Shipped': return <Truck className="size-3 mr-1" />;
      case 'Delivered': return <CheckCircle2 className="size-3 mr-1" />;
      case 'Cancelled': return <XCircle className="size-3 mr-1" />;
      default: return null;
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  if (!orders || orders.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">Nenhum pedido confirmado encontrado.</div>;
  }

  return (
    <div className="overflow-x-auto bg-card rounded-lg border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pedido</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status Atual</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead className="text-right">Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-mono text-xs">#{order.id.slice(-6).toUpperCase()}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-bold">{order.shippingAddress.cpf}</span>
                  <span className="text-xs text-muted-foreground">{order.shippingAddress.city}/{order.shippingAddress.state}</span>
                </div>
              </TableCell>
              <TableCell className="font-bold">R$ {order.totalAmount.toFixed(2).replace('.', ',')}</TableCell>
              <TableCell>
                <Badge variant={order.status === 'Processing' ? 'secondary' : 'default'}>
                  {getStatusIcon(order.status)}
                  {order.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Select 
                    defaultValue={order.status} 
                    onValueChange={(val) => handleUpdateStatus(order, val as Order['status'])}
                    disabled={isProcessing === order.id}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      {isProcessing === order.id ? <Loader2 className="animate-spin size-3 mr-2" /> : <SelectValue />}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Processing">Processando</SelectItem>
                      <SelectItem value="Crafting">Em Produção</SelectItem>
                      <SelectItem value="Shipped">Enviado (Gera Etiqueta)</SelectItem>
                      <SelectItem value="Delivered">Entregue</SelectItem>
                      <SelectItem value="Cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon"><Info className="size-4" /></Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-xl">
                    <DialogHeader>
                      <DialogTitle>Detalhes do Pedido #{order.id.toUpperCase()}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="font-bold text-muted-foreground uppercase text-[10px]">Endereço de Entrega</p>
                          <p>{order.shippingAddress.streetName}, {order.shippingAddress.streetNumber}</p>
                          <p>{order.shippingAddress.city} - {order.shippingAddress.state}</p>
                          <p>CEP: {order.shippingAddress.zipCode}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-muted-foreground uppercase text-[10px]">Pagamento</p>
                          <p>ID Mercado Pago: {order.paymentId || 'N/A'}</p>
                          <p>Merchant Order: {order.merchantOrderId || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                         <p className="font-bold text-muted-foreground uppercase text-[10px]">Itens do Pedido</p>
                         <div className="max-h-[300px] overflow-y-auto space-y-2">
                           {order.items.map((item, idx) => (
                             <div key={idx} className="flex items-center gap-3 p-2 border rounded-md">
                               <Image src={item.imageUrl} alt={item.productName} width={40} height={40} className="rounded object-cover" />
                               <div className="flex-1">
                                 <p className="text-sm font-bold">{item.productName} (x{item.quantity})</p>
                                 <p className="text-xs text-muted-foreground">{item.selectedColor} | {item.selectedSize}</p>
                               </div>
                               <div className="text-sm font-bold">
                                 R$ {(item.unitPriceAtOrder * item.quantity).toFixed(2)}
                               </div>
                             </div>
                           ))}
                         </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

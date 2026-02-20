'use client';

import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser, useDoc } from '@/firebase';
import { collectionGroup, query, orderBy, limit, doc, serverTimestamp } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Truck, Hammer, CheckCircle2, Clock, XCircle, Info } from 'lucide-react';
import type { Order, UserProfile } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Image from 'next/image';

export function AdminOrders() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Fetch profile to double check admin status before querying
  const profileRef = useMemoFirebase(() => 
    (user && firestore) ? doc(firestore, 'users', user.uid) : null,
    [user, firestore]
  );
  const { data: profile } = useDoc<UserProfile>(profileRef);

  const ordersQuery = useMemoFirebase(
    () => (firestore && profile?.isAdmin ? query(collectionGroup(firestore, 'orders'), orderBy('createdAt', 'desc'), limit(50)) : null),
    [firestore, profile?.isAdmin]
  );

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const handleUpdateStatus = (order: Order, status: Order['status']) => {
    if (!firestore) return;
    const orderRef = doc(firestore, 'users', order.userId, 'orders', order.id);
    updateDocumentNonBlocking(orderRef, {
      status,
      updatedAt: serverTimestamp(),
    });
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

  if (isLoading || !profile?.isAdmin) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  if (!orders || orders.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">Nenhum pedido confirmado encontrado.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pedido</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status Atual</TableHead>
            <TableHead>Alterar Status</TableHead>
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
                <Badge variant={order.status === 'Processing' ? 'secondary' : 'default'} className={cn(
                  order.status === 'Crafting' && 'bg-amber-500 hover:bg-amber-600',
                  order.status === 'Shipped' && 'bg-blue-500 hover:bg-blue-600',
                  order.status === 'Delivered' && 'bg-green-600 hover:bg-green-700'
                )}>
                  {getStatusIcon(order.status)}
                  {order.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Select 
                  defaultValue={order.status} 
                  onValueChange={(val) => handleUpdateStatus(order, val as Order['status'])}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Processing">Processando</SelectItem>
                    <SelectItem value="Crafting">Em Produção</SelectItem>
                    <SelectItem value="Shipped">Enviado</SelectItem>
                    <SelectItem value="Delivered">Entregue</SelectItem>
                    <SelectItem value="Cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
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
                          <p>Data: {order.createdAt?.toDate().toLocaleString('pt-BR')}</p>
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
                                 <p className="text-xs text-muted-foreground">{item.selectedColor} | {item.selectedSize} | {item.selectedMaterial}</p>
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

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

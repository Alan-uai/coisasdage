'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, doc, serverTimestamp } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Truck, PackageSearch, LogIn, XCircle, RefreshCw, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addressSchema } from '@/app/checkout/form-schema';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { Order } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const statusMap = {
  Processing: { text: 'Processando', value: 25, variant: 'secondary' as const },
  Crafting: { text: 'Em Produção', value: 50, variant: 'default' as const },
  Shipped: { text: 'Enviado', value: 75, variant: 'default' as const },
  Delivered: { text: 'Entregue', value: 100, variant: 'outline' as const },
  Cancelled: { text: 'Cancelado', value: 0, variant: 'destructive' as const },
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
  const { toast } = useToast();
  const router = useRouter();

  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const ordersQuery = useMemoFirebase(
    () => (user && firestore ? query(collection(firestore, 'users', user.uid, 'orders'), orderBy('orderDate', 'desc'), limit(20)) : null),
    [user, firestore]
  );

  const { data: orders, isLoading: isOrdersLoading } = useCollection<Order>(ordersQuery);

  const handleCancelOrder = (orderId: string) => {
    if (!user || !firestore) return;
    const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
    updateDocumentNonBlocking(orderRef, { 
      status: 'Cancelled',
      updatedAt: serverTimestamp()
    });
    toast({
      title: "Pedido Cancelado",
      description: "Sua desistência foi registrada com sucesso.",
    });
  };

  const handleRedoOrder = (order: Order) => {
    if (!user || !firestore) return;

    // 1. Move items to cart
    order.items.forEach(item => {
      const cartItemData = {
        cartId: 'main',
        productId: item.productId,
        productGroupId: item.productGroupId || item.productId,
        productName: item.productName,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        selectedSize: item.selectedSize,
        selectedColor: item.selectedColor,
        selectedMaterial: item.selectedMaterial,
        unitPriceAtAddition: item.unitPriceAtOrder,
        selected: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const cartItemsRef = collection(firestore, 'users', user.uid, 'carts', 'main', 'items');
      addDocumentNonBlocking(cartItemsRef, cartItemData);
    });

    // 2. Remove the old cancelled order from history as requested
    const orderRef = doc(firestore, 'users', user.uid, 'orders', order.id);
    deleteDocumentNonBlocking(orderRef);

    toast({
      title: "Pedido Restaurado!",
      description: "Os itens foram movidos para o carrinho e o registro antigo foi removido.",
    });
    router.push('/cart');
  };

  const openAddressDialog = (order: Order) => {
    setEditingOrder(order);
    setAddressDialogOpen(true);
  };

  const addressForm = useForm<z.infer<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
    values: editingOrder ? {
        cpf: editingOrder.shippingAddress.cpf,
        streetName: editingOrder.shippingAddress.streetName,
        streetNumber: editingOrder.shippingAddress.streetNumber,
        zipCode: editingOrder.shippingAddress.zipCode,
        city: editingOrder.shippingAddress.city,
        state: editingOrder.shippingAddress.state,
    } : undefined,
  });

  const onAddressSubmit = (values: z.infer<typeof addressSchema>) => {
    if (!user || !firestore || !editingOrder) return;
    
    const orderRef = doc(firestore, 'users', user.uid, 'orders', editingOrder.id);
    updateDocumentNonBlocking(orderRef, {
        shippingAddress: values,
        updatedAt: serverTimestamp(),
    });

    toast({
        title: "Endereço Atualizado",
        description: "Os dados de entrega foram alterados com sucesso.",
    });
    setAddressDialogOpen(false);
  };

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
          (orders || []).map((order) => {
            const statusInfo = statusMap[order.status];
            const canCancel = order.status === 'Processing' || order.status === 'Crafting';
            const canChangeAddress = order.status === 'Processing' || order.status === 'Crafting';
            const isCancelled = order.status === 'Cancelled';

            return (
              <Card key={order.id} className={cn(isCancelled && "opacity-75 bg-muted/30")}>
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
                         <div className="block flex-shrink-0">
                           <Image
                             src={item.imageUrl}
                             alt={item.productName}
                             width={120}
                             height={80}
                             className="rounded-md object-cover aspect-[3/2] size-24"
                           />
                         </div>
                         <div className="flex-1">
                           <h4 className="font-semibold">{item.productName}</h4>
                           <p className="text-sm text-muted-foreground">Qtd: {item.quantity} | {item.selectedSize} | {item.selectedColor}</p>
                           <p className="text-sm font-bold text-primary">R$ {(item.unitPriceAtOrder * item.quantity).toFixed(2).replace('.', ',')}</p>
                         </div>
                       </div>
                    ))}
                  </div>

                  <Separator className="my-4" />
                   <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                        {isCancelled ? (
                            <div className="flex items-center gap-1 text-destructive">
                                <XCircle className="size-4" />
                                <span>Pedido cancelado</span>
                            </div>
                        ) : order.trackingNumber ? (
                            <div className="flex items-center gap-2 text-primary">
                                <Truck className="size-4" />
                                <span>Rastreio: <span className="font-mono font-bold">{order.trackingNumber}</span></span>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                <span>Aguardando produção...</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="size-3" />
                                    {order.shippingAddress.streetName}, {order.shippingAddress.streetNumber}
                                </span>
                            </div>
                        )}
                    </div>
                    <p className="font-bold text-lg">Total: R$ {order.totalAmount.toFixed(2).replace('.', ',')}</p>
                   </div>
                  
                  {statusInfo && !isCancelled && (
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
                <CardFooter className="justify-end bg-muted/50 py-3 rounded-b-lg gap-2">
                    {canChangeAddress && (
                        <Button variant="ghost" size="sm" onClick={() => openAddressDialog(order)}>
                            <MapPin className="size-4 mr-2" />
                            Mudei de endereço
                        </Button>
                    )}
                    {canCancel && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                    <XCircle className="size-4 mr-2" />
                                    Desistir do Pedido
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Deseja realmente cancelar este pedido?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta ação registrará sua desistência. Se o pagamento já foi aprovado, entraremos em contato para o processo de estorno.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleCancelOrder(order.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Confirmar Cancelamento
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    {isCancelled && (
                        <Button variant="outline" size="sm" onClick={() => handleRedoOrder(order)}>
                            <RefreshCw className="size-4 mr-2" />
                            Refazer Pedido
                        </Button>
                    )}
                </CardFooter>
              </Card>
            );
          })
        )}
      </main>

      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Atualizar Endereço de Entrega</DialogTitle>
            <DialogDescription>
              Altere os dados de destino para o pedido #{editingOrder?.id.substring(0,6)}.
            </DialogDescription>
          </DialogHeader>
          <Form {...addressForm}>
            <form onSubmit={addressForm.handleSubmit(onAddressSubmit)} className="space-y-4 py-4">
              <FormField control={addressForm.control} name="cpf" render={({ field }) => (
                <FormItem><FormLabel>CPF</FormLabel><FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={addressForm.control} name="zipCode" render={({ field }) => (
                  <FormItem><FormLabel>CEP</FormLabel><FormControl><Input placeholder="00000-000" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={addressForm.control} name="state" render={({ field }) => (
                  <FormItem><FormLabel>UF</FormLabel><FormControl><Input placeholder="SP" {...field} maxLength={2} /></FormControl><FormMessage /></FormItem>
                )}/>
              </div>
              <FormField control={addressForm.control} name="streetName" render={({ field }) => (
                <FormItem><FormLabel>Rua</FormLabel><FormControl><Input placeholder="Endereço" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={addressForm.control} name="streetNumber" render={({ field }) => (
                  <FormItem><FormLabel>Número</FormLabel><FormControl><Input placeholder="123" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={addressForm.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input placeholder="Sua cidade" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
              </div>
              <DialogFooter className="pt-4">
                <Button variant="outline" type="button" onClick={() => setAddressDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Salvar Alterações</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

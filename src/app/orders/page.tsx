
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, doc, serverTimestamp, where } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Truck, PackageSearch, LogIn, XCircle, RefreshCw, MapPin, ClipboardList, ShoppingBag, Clock } from 'lucide-react';
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
import type { Order, CustomRequest } from '@/lib/types';
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
    <Card className="mb-4">
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
          <Skeleton className="h-[80px] w-[120px] rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
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

  // 1. Fetch finished orders
  const ordersQuery = useMemoFirebase(
    () => (user && firestore ? query(collection(firestore, 'users', user.uid, 'orders'), orderBy('orderDate', 'desc'), limit(20)) : null),
    [user, firestore]
  );
  const { data: orders, isLoading: isOrdersLoading } = useCollection<Order>(ordersQuery);

  // 2. Fetch custom requests (on-demand)
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

  const handleCancelOrder = (orderId: string) => {
    if (!user || !firestore) return;
    const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
    updateDocumentNonBlocking(orderRef, { 
      status: 'Cancelled',
      updatedAt: serverTimestamp()
    });
    toast({ title: "Pedido Cancelado" });
  };

  const handleRedoOrder = (order: Order) => {
    if (!user || !firestore) return;
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
    const orderRef = doc(firestore, 'users', user.uid, 'orders', order.id);
    deleteDocumentNonBlocking(orderRef);
    toast({ title: "Itens movidos para o carrinho!" });
    router.push('/cart');
  };

  const handleAddToCartRequest = (request: CustomRequest) => {
    if (!user || !firestore) return;
    const requestRef = doc(firestore, 'custom_requests', request.id);
    updateDocumentNonBlocking(requestRef, { status: 'AddedToCart', updatedAt: serverTimestamp() });
    
    const cartRef = doc(firestore, 'users', user.uid, 'carts', 'main');
    setDocumentNonBlocking(cartRef, { userId: user.uid, updatedAt: serverTimestamp() }, { merge: true });
    
    const cartItemData = {
      cartId: 'main',
      productId: request.productId,
      productGroupId: request.productGroupId,
      productName: `[Sob Demanda] ${request.productName}`,
      imageUrl: request.imageUrl,
      quantity: 1,
      selectedSize: request.selectedSize,
      selectedColor: request.selectedColor,
      selectedMaterial: request.selectedMaterial,
      unitPriceAtAddition: request.finalPrice,
      selected: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const cartItemsRef = collection(firestore, 'users', user.uid, 'carts', 'main', 'items');
    addDocumentNonBlocking(cartItemsRef, cartItemData);
    toast({ title: "Pronto para pagamento!" });
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
    toast({ title: "Endereço Atualizado" });
    setAddressDialogOpen(false);
  };

  if (isUserLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <OrderCardSkeleton />
        <OrderCardSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-center p-8">
        <LogIn className="size-16 text-muted-foreground mb-4" />
        <h1 className="text-3xl font-bold font-headline">Acesse sua Conta</h1>
        <p className="text-muted-foreground mt-2">Conecte-se para ver seus pedidos e solicitações.</p>
        <Button asChild className="mt-6"><Link href="/login">Fazer Login</Link></Button>
      </div>
    );
  }

  const hasNoData = !isOrdersLoading && !isRequestsLoading && (!orders || orders.length === 0) && (!requests || requests.length === 0);

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight font-headline">Meus Pedidos</h1>
        <p className="text-muted-foreground mt-2">Acompanhe suas compras e solicitações personalizadas.</p>
      </header>

      <main className="flex-1 space-y-8">
        {hasNoData ? (
          <div className="flex flex-col items-center justify-center text-center py-20 border-2 border-dashed rounded-lg">
            <PackageSearch className="size-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold font-headline">Nada por aqui ainda</h2>
            <p className="text-muted-foreground mt-2">Explore nosso catálogo e comece suas encomendas!</p>
            <Button asChild className="mt-6"><Link href="/">Ver Catálogo</Link></Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Custom Requests Section (Pending Approval) */}
            {(requests && requests.length > 0) && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
                  <Clock className="size-5" /> Sob Demanda (Em Análise)
                </h2>
                {requests.map(request => (
                  <Card key={request.id} className={cn(request.status === 'AddedToCart' && "opacity-60")}>
                    <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
                      <div className="size-20 relative rounded-md overflow-hidden bg-muted">
                        <Image src={request.imageUrl} alt={request.productName} fill className="object-cover" />
                      </div>
                      <div className="flex-1 text-center sm:text-left">
                         <div className="mb-1">
                          <Badge variant={
                            request.status === 'Approved' ? 'default' : 
                            request.status === 'Contested' ? 'destructive' : 'secondary'
                          }>
                            {request.status === 'Pending' ? 'Em Análise pela Artesã' : 
                             request.status === 'Approved' ? 'Aprovado' : 
                             request.status === 'Contested' ? 'Não disponível agora' : 'No Carrinho'}
                          </Badge>
                        </div>
                        <h4 className="font-bold">{request.productName}</h4>
                        <p className="text-sm text-muted-foreground">{request.selectedSize} | {request.selectedColor}</p>
                      </div>
                      <div className="text-center sm:text-right">
                        <p className="font-bold text-lg text-primary">R$ {request.finalPrice.toFixed(2).replace('.', ',')}</p>
                        {request.status === 'Approved' && (
                          <Button size="sm" onClick={() => handleAddToCartRequest(request)} className="mt-2">
                            <ShoppingBag className="size-4 mr-2" /> Pagar Agora
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </section>
            )}

            {/* 2. Finished Orders Section */}
            {(orders && orders.length > 0) && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
                  <Truck className="size-5" /> Compras e Entregas
                </h2>
                {orders.map(order => {
                  const statusInfo = statusMap[order.status];
                  const isCancelled = order.status === 'Cancelled';
                  return (
                    <Card key={order.id} className={cn(isCancelled && "opacity-75 bg-muted/30")}>
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">Pedido #{order.id.substring(0,6)}</CardTitle>
                            <CardDescription>{order.orderDate?.toDate().toLocaleDateString('pt-BR')}</CardDescription>
                          </div>
                          {statusInfo && <Badge variant={statusInfo.variant}>{statusInfo.text}</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="space-y-2">
                          {order.items.map(item => (
                            <div key={item.productId} className="flex gap-3 items-center">
                              <div className="size-12 relative rounded overflow-hidden flex-shrink-0">
                                <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                              </div>
                              <div className="text-sm">
                                <p className="font-medium line-clamp-1">{item.productName}</p>
                                <p className="text-muted-foreground text-xs">Qtd: {item.quantity} | {item.selectedSize}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Separator className="my-3" />
                        <div className="flex justify-between items-center text-sm">
                           <span className="text-muted-foreground flex items-center gap-1">
                             <MapPin className="size-3" /> {order.shippingAddress.city}, {order.shippingAddress.state}
                           </span>
                           <span className="font-bold">Total: R$ {order.totalAmount.toFixed(2).replace('.', ',')}</span>
                        </div>
                        {statusInfo && !isCancelled && statusInfo.value > 0 && (
                          <div className="mt-3">
                            <Progress value={statusInfo.value} className="h-1.5" />
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="p-2 px-4 bg-muted/30 rounded-b-lg justify-end gap-2">
                        {(order.status === 'Processing' || order.status === 'Crafting') && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openAddressDialog(order)}>
                              <MapPin className="size-4 mr-1" /> Mudar Endereço
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                  <XCircle className="size-4 mr-1" /> Desistir
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancelar Pedido?</AlertDialogTitle>
                                  <AlertDialogDescription>Esta ação registrará sua desistência e o estorno será processado.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleCancelOrder(order.id)} className="bg-destructive">Confirmar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        {isCancelled && (
                          <Button variant="outline" size="sm" onClick={() => handleRedoOrder(order)}>
                            <RefreshCw className="size-4 mr-1" /> Refazer Pedido
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  )
                })}
              </section>
            )}
          </div>
        )}
      </main>

      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Alterar Endereço</DialogTitle>
            <DialogDescription>Atualize o destino para o pedido #{editingOrder?.id.substring(0,6)}.</DialogDescription>
          </DialogHeader>
          <Form {...addressForm}>
            <form onSubmit={addressForm.handleSubmit(onAddressSubmit)} className="space-y-4">
              <FormField control={addressForm.control} name="cpf" render={({ field }) => (
                <FormItem><FormLabel>CPF</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )}/>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={addressForm.control} name="zipCode" render={({ field }) => (
                  <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )}/>
                <FormField control={addressForm.control} name="state" render={({ field }) => (
                  <FormItem><FormLabel>UF</FormLabel><FormControl><Input {...field} maxLength={2} /></FormControl></FormItem>
                )}/>
              </div>
              <FormField control={addressForm.control} name="streetName" render={({ field }) => (
                <FormItem><FormLabel>Rua</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )}/>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={addressForm.control} name="streetNumber" render={({ field }) => (
                  <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )}/>
                <FormField control={addressForm.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )}/>
              </div>
              <DialogFooter><Button type="submit">Salvar Alterações</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

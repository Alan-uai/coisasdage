
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, doc, serverTimestamp, where } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Truck, PackageSearch, LogIn, XCircle, ShoppingBag, ClipboardList, Clock } from 'lucide-react';
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

export default function OrdersPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  // Busca os pedidos finalizados (compras pagas)
  const ordersQuery = useMemoFirebase(
    () => (user && firestore ? query(
      collection(firestore, 'users', user.uid, 'orders'), 
      orderBy('orderDate', 'desc'), 
      limit(20)
    ) : null),
    [user, firestore]
  );
  const { data: orders, isLoading: isOrdersLoading } = useCollection<Order>(ordersQuery);

  // Busca as solicitações sob demanda (em análise ou aprovadas)
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
    updateDocumentNonBlocking(orderRef, { status: 'Cancelled', updatedAt: serverTimestamp() });
    toast({ title: "Pedido Cancelado" });
  };

  const handleAddToCartRequest = (request: CustomRequest) => {
    if (!user || !firestore || !request.items) return;
    
    // Marca como adicionado ao carrinho para não repetir o botão
    const requestRef = doc(firestore, 'custom_requests', request.id);
    updateDocumentNonBlocking(requestRef, { status: 'AddedToCart', updatedAt: serverTimestamp() });
    
    const cartRef = doc(firestore, 'users', user.uid, 'carts', 'main');
    setDocumentNonBlocking(cartRef, { userId: user.uid, updatedAt: serverTimestamp() }, { merge: true });
    
    const cartItemsRef = collection(firestore, 'users', user.uid, 'carts', 'main', 'items');
    
    request.items.forEach(item => {
        addDocumentNonBlocking(cartItemsRef, {
            cartId: 'main',
            productId: item.productId,
            productGroupId: item.productGroupId,
            productName: `[Aprovado] ${item.productName}`,
            imageUrl: item.imageUrl,
            quantity: item.quantity,
            selectedSize: item.selectedSize,
            selectedColor: item.selectedColor,
            selectedMaterial: item.selectedMaterial,
            unitPriceAtAddition: item.unitPriceAtOrder,
            readyMade: true, // Agora ele é pronto para pagamento
            selected: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    toast({ title: "Produtos aprovados adicionados ao carrinho!" });
    router.push('/cart');
  };

  if (isUserLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-8 text-center min-h-[60vh]">
        <LogIn className="size-16 text-muted-foreground mb-4" />
        <h1 className="text-3xl font-bold font-headline">Acesse sua Conta</h1>
        <p className="text-muted-foreground mt-2">Você precisa estar logado para ver seus pedidos.</p>
        <Button asChild className="mt-6"><Link href="/login">Fazer Login</Link></Button>
      </div>
    );
  }

  const hasNoData = !isOrdersLoading && !isRequestsLoading && (!orders || orders.length === 0) && (!requests || requests.length === 0);

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 space-y-8">
      <header>
        <h1 className="text-4xl font-bold font-headline">Meus Pedidos</h1>
        <p className="text-muted-foreground mt-2">Acompanhe suas compras e o status das suas solicitações artesanais.</p>
      </header>

      <main className="flex-1 space-y-12">
        {hasNoData ? (
          <div className="flex flex-col items-center justify-center text-center py-20 border-2 border-dashed rounded-lg">
            <PackageSearch className="size-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold font-headline">Nada por aqui ainda</h2>
            <p className="text-muted-foreground mt-2">Você ainda não realizou pedidos ou solicitações.</p>
            <Button asChild className="mt-6"><Link href="/">Ver Catálogo</Link></Button>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Seção de Solicitações Sob Demanda */}
            {requests && requests.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
                  <ClipboardList className="size-5" /> Sob Demanda (Em Análise)
                </h2>
                <div className="grid gap-4">
                  {requests.map(request => (
                    <Card key={request.id} className={cn(request.status === 'AddedToCart' && "opacity-60")}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
                          <div>
                            <Badge variant={
                              request.status === 'Approved' ? 'default' : 
                              request.status === 'Contested' ? 'destructive' : 'secondary'
                            }>
                              {request.status === 'Pending' ? 'Em Análise pela Artesã' : 
                               request.status === 'Approved' ? 'Aprovado para Pagamento' : 
                               request.status === 'Contested' ? 'Não disponível' : 'Já no Carrinho'}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="size-3" /> Solicitado em {request.createdAt?.toDate().toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-xl text-primary">R$ {request.finalPrice.toFixed(2).replace('.', ',')}</p>
                            {request.status === 'Approved' && (
                              <Button size="sm" onClick={() => handleAddToCartRequest(request)} className="mt-2">
                                <ShoppingBag className="size-4 mr-2" /> Pagar Agora
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {request.items && request.items.length > 0 ? (
                            request.items.map((item, idx) => (
                              <div key={idx} className="flex gap-3 items-center bg-muted/30 p-2 rounded">
                                <div className="size-12 relative rounded overflow-hidden shrink-0">
                                  <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                                </div>
                                <div className="text-xs">
                                  <p className="font-bold line-clamp-1">{item.productName}</p>
                                  <p className="text-muted-foreground">{item.selectedSize} | {item.selectedColor}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs italic text-muted-foreground col-span-full">Solicitação personalizada única.</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Seção de Pedidos Finalizados (Compras) */}
            {orders && orders.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
                  <Truck className="size-5" /> Minhas Compras
                </h2>
                <div className="grid gap-4">
                  {orders.map(order => {
                    const statusInfo = statusMap[order.status];
                    return (
                      <Card key={order.id} className={cn(order.status === 'Cancelled' && "opacity-75 bg-muted/30")}>
                        <CardHeader className="p-4 pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">Pedido #{order.id.substring(0,6).toUpperCase()}</CardTitle>
                              <CardDescription>{order.orderDate?.toDate().toLocaleDateString()}</CardDescription>
                            </div>
                            {statusInfo && <Badge variant={statusInfo.variant}>{statusInfo.text}</Badge>}
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="space-y-2 mt-2">
                            {order.items && order.items.map((item, idx) => (
                              <div key={idx} className="flex gap-3 items-center">
                                <div className="size-10 relative rounded overflow-hidden flex-shrink-0">
                                  <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                                </div>
                                <div className="text-xs">
                                  <p className="font-medium line-clamp-1">{item.productName}</p>
                                  <p className="text-muted-foreground">Qtd: {item.quantity} | {item.selectedSize}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Separator className="my-3" />
                          <div className="flex justify-between items-center text-sm font-bold">
                             <span>Total Pago: R$ {order.totalAmount.toFixed(2).replace('.', ',')}</span>
                          </div>
                          {statusInfo && order.status !== 'Cancelled' && statusInfo.value > 0 && (
                            <div className="mt-3">
                              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                <span>Processando</span>
                                <span>Enviado</span>
                                <span>Entregue</span>
                              </div>
                              <Progress value={statusInfo.value} className="h-1.5" />
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="p-2 px-4 bg-muted/30 rounded-b-lg justify-end">
                          {(order.status === 'Processing' || order.status === 'Crafting') && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8">
                                  <XCircle className="size-4 mr-1" /> Desistir da Compra
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancelar Pedido?</AlertDialogTitle>
                                  <AlertDialogDescription>Esta ação notificará a artesã e o processo de estorno será iniciado.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleCancelOrder(order.id)} className="bg-destructive">Confirmar Cancelamento</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

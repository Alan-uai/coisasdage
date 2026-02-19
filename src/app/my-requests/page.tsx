
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag, Clock, CheckCircle2, XCircle, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { CustomRequest } from '@/lib/types';

export default function MyRequestsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const requestsQuery = useMemoFirebase(
    () => (user && firestore ? query(
      collection(firestore, 'custom_requests'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    ) : null),
    [user, firestore]
  );

  const { data: requests, isLoading } = useCollection<CustomRequest>(requestsQuery);

  const handleAddToCart = (request: CustomRequest) => {
    if (!user || !firestore) return;

    // 1. Mark the request as "AddedToCart" so it doesn't show the button again
    const requestRef = doc(firestore, 'custom_requests', request.id);
    updateDocumentNonBlocking(requestRef, { status: 'AddedToCart', updatedAt: serverTimestamp() });

    // 2. Add to cart
    const cartRef = doc(firestore, 'users', user.uid, 'carts', 'main');
    setDocumentNonBlocking(cartRef, { userId: user.uid, updatedAt: serverTimestamp() }, { merge: true });
    
    const cartItemData = {
      cartId: 'main',
      productId: request.productId,
      productGroupId: request.productGroupId,
      productName: `[Aprovado] ${request.productName}`,
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

    toast({
      title: "Pronto para Pagamento!",
      description: "O item aprovado foi adicionado ao seu carrinho.",
    });
    router.push('/cart');
  };

  if (isUserLoading || (user && isLoading)) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <LogIn className="size-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold font-headline">Login Necessário</h1>
        <p className="text-muted-foreground">Faça login para ver suas solicitações sob demanda.</p>
        <Button asChild className="mt-4"><Link href="/login">Entrar</Link></Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight font-headline">Minhas Solicitações</h1>
        <p className="text-muted-foreground mt-2">Acompanhe o status dos seus pedidos sob demanda.</p>
      </header>

      <main className="grid grid-cols-1 gap-4">
        {(!requests || requests.length === 0) ? (
          <div className="text-center py-20 border-2 border-dashed rounded-lg">
            <Clock className="size-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-bold font-headline">Nenhuma solicitação feita</h3>
            <p className="text-muted-foreground">Produtos sob demanda aparecerão aqui após você solicitar um orçamento.</p>
            <Button asChild className="mt-4"><Link href="/">Ver Catálogo</Link></Button>
          </div>
        ) : (
          requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="size-24 relative rounded-md overflow-hidden shrink-0">
                  <Image src={request.imageUrl} alt={request.productName} fill className="object-cover" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                    <Badge variant={
                      request.status === 'Approved' ? 'default' : 
                      request.status === 'Contested' ? 'destructive' : 'secondary'
                    }>
                      {request.status === 'Pending' ? 'Aguardando Artesã' : 
                       request.status === 'Approved' ? 'Aprovado' : 
                       request.status === 'Contested' ? 'Não disponível no momento' : 'Adicionado ao Carrinho'}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-lg">{request.productName}</h4>
                  <p className="text-sm text-muted-foreground">
                    {request.selectedSize} | {request.selectedColor} | {request.selectedMaterial}
                  </p>
                </div>
                <div className="flex flex-col items-center sm:items-end gap-2">
                  <p className="font-bold text-xl text-primary">R$ {request.finalPrice.toFixed(2).replace('.', ',')}</p>
                  {request.status === 'Approved' && (
                    <Button onClick={() => handleAddToCart(request)}>
                      <ShoppingBag className="size-4 mr-2" /> Finalizar e Pagar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}

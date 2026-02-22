
'use client';
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, limit, where, doc } from 'firebase/firestore';
import type { CartItem, Order, OrderItemSummary } from '@/lib/types';
import { CheckoutForm } from './checkout-form';
import { Skeleton } from '@/components/ui/skeleton';
import { LogIn, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function CheckoutSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start max-w-6xl mx-auto">
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}

function CheckoutPageContent() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const orderIdToResume = searchParams.get('order_id');

  // Mode 1: Resume an existing order
  const orderToResumeRef = useMemoFirebase(
    () => (user && firestore && orderIdToResume ? doc(firestore, 'users', user.uid, 'orders', orderIdToResume) : null),
    [user, firestore, orderIdToResume]
  );
  const { data: resumedOrder, isLoading: isOrderLoading } = useDoc<Order>(orderToResumeRef);

  // Mode 2: New checkout from cart (only if not resuming)
  const cartItemsQuery = useMemoFirebase(
    () => (!orderIdToResume && user && firestore ? query(
        collection(firestore, 'users', user.uid, 'carts', 'main', 'items'), 
        where('selected', '==', true),
        limit(20)
    ) : null),
    [user, firestore, orderIdToResume]
  );
  const { data: cartItems, isLoading: isCartLoading } = useCollection<CartItem>(cartItemsQuery);

  const subtotalFromCart = useMemo(() => {
    return cartItems?.reduce((acc, item) => acc + item.unitPriceAtAddition * item.quantity, 0) || 0;
  }, [cartItems]);

  const pageIsLoading = isUserLoading || (user && (isCartLoading || isOrderLoading));

  if (!user && !isUserLoading) {
    return (
        <div className="flex flex-col flex-1 items-center justify-center text-center p-4 col-span-full min-h-[50vh]">
            <LogIn className="size-16 text-muted-foreground" />
            <h1 className="text-4xl font-bold tracking-tight font-headline mt-6">Faça Login para Continuar</h1>
            <p className="text-muted-foreground mt-2">Você precisa estar conectado para finalizar sua compra.</p>
            <Button asChild className="mt-6">
                <Link href="/login">Fazer Login</Link>
            </Button>
        </div>
    );
  }

  if (pageIsLoading) {
    return <CheckoutSkeleton />;
  }
  
  if (orderIdToResume && !resumedOrder) {
      return (
          <div className="flex flex-col items-center justify-center text-center p-8 py-20 min-h-[400px]">
              <ShoppingCart className="size-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold font-headline">Pedido não encontrado</h2>
              <p className="text-muted-foreground mt-2">Não foi possível encontrar o pedido que você está tentando pagar.</p>
              <Button asChild className="mt-6"><Link href="/orders">Voltar aos Pedidos</Link></Button>
          </div>
      );
  }

  const finalItems = (resumedOrder ? resumedOrder.items : cartItems) || [];
  const finalSubtotal = resumedOrder ? resumedOrder.totalAmount : subtotalFromCart;

  if (finalItems.length === 0) {
       return (
            <div className="flex flex-col items-center justify-center text-center p-8 py-20 min-h-[400px]">
                <ShoppingCart className="size-16 text-muted-foreground mb-4" /><h2 className="text-2xl font-bold font-headline">Seu carrinho de checkout está vazio</h2><p className="text-muted-foreground mt-2">Adicione itens ao carrinho para finalizar a compra.</p>
                <Button asChild className="mt-6"><Link href="/">Voltar ao Catálogo</Link></Button>
            </div>
        );
  }
  
  return (
    <CheckoutForm 
      user={user!}
      cartItems={finalItems as (CartItem | OrderItemSummary)[]}
      subtotal={finalSubtotal} 
      isCartLoading={pageIsLoading}
      resumedOrder={resumedOrder || undefined}
    />
  );
}

export default function CheckoutPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <main>
        <Suspense fallback={<CheckoutSkeleton />}>
          <CheckoutPageContent />
        </Suspense>
      </main>
    </div>
  );
}

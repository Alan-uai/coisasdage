'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit } from 'firebase/firestore';
import type { CartItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { LogIn, ShoppingBag } from 'lucide-react';
import { CheckoutForm } from './checkout-form';
import { Skeleton } from '@/components/ui/skeleton';

function CheckoutSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

export default function CheckoutPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const cartItemsQuery = useMemoFirebase(
    () => (user && firestore ? query(collection(firestore, 'users', user.uid, 'carts', 'main', 'items'), limit(20)) : null),
    [user, firestore]
  );
  const { data: cartItems, isLoading: isCartLoading } = useCollection<CartItem>(cartItemsQuery);

  const subtotal = useMemo(() => {
    return cartItems?.reduce((acc, item) => acc + item.unitPriceAtAddition * item.quantity, 0) || 0;
  }, [cartItems]);
  
  const pageIsLoading = isUserLoading || (user && isCartLoading);

  const renderContent = () => {
    if (pageIsLoading) {
        return <CheckoutSkeleton />;
    }

    if (!user) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center text-center p-4 col-span-full">
                <LogIn className="size-16 text-muted-foreground" />
                <h1 className="text-4xl font-bold tracking-tight font-headline mt-6">Faça Login para Continuar</h1>
                <p className="text-muted-foreground mt-2">Você precisa estar conectado para finalizar sua compra.</p>
                <Button asChild className="mt-6">
                    <Link href="/login">Fazer Login</Link>
                </Button>
            </div>
        );
    }

    if (!isCartLoading && (!cartItems || cartItems.length === 0)) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center text-center p-4 col-span-full">
                <ShoppingBag className="size-16 text-muted-foreground" />
                <h1 className="text-4xl font-bold tracking-tight font-headline mt-6">Seu carrinho está vazio</h1>
                <p className="text-muted-foreground mt-2">Adicione itens ao seu carrinho antes de prosseguir para o checkout.</p>
                <Button asChild className="mt-6">
                    <Link href="/">Voltar ao Catálogo</Link>
                </Button>
            </div>
        );
    }

    if (cartItems) {
        return <CheckoutForm cartItems={cartItems} subtotal={subtotal} />;
    }

    return null;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight font-headline">Finalizar Compra</h1>
        <p className="text-muted-foreground mt-2">Revise seu pedido e realize o pagamento.</p>
      </header>
      <main className="max-w-6xl mx-auto">
        {renderContent()}
      </main>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, limit } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { LogIn, ShoppingBag, Trash2, Plus, Minus } from 'lucide-react';
import type { CartItem } from '@/lib/types';

function CartSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 flex items-center gap-6">
          <Skeleton className="size-24 sm:size-32 rounded-md" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/4" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-6 w-16" />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-48" />
      </div>
    </div>
  );
}

export default function CartPage() {
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

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (!user || !firestore || newQuantity < 1) return;
    const itemRef = doc(firestore, 'users', user.uid, 'carts', 'main', 'items', itemId);
    updateDocumentNonBlocking(itemRef, { quantity: newQuantity });
  };

  const handleRemoveItem = (itemId: string) => {
    if (!user || !firestore) return;
    const itemRef = doc(firestore, 'users', user.uid, 'carts', 'main', 'items', itemId);
    deleteDocumentNonBlocking(itemRef);
  };

  if (isUserLoading || (user && isCartLoading)) {
    return (
      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight font-headline">Seu Carrinho</h1>
          <p className="text-muted-foreground mt-2">Verificando seus itens...</p>
        </header>
        <CartSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-center p-4">
        <LogIn className="size-16 text-muted-foreground" />
        <h1 className="text-4xl font-bold tracking-tight font-headline mt-6">Faça Login para Ver seu Carrinho</h1>
        <p className="text-muted-foreground mt-2">Você precisa estar conectado para adicionar itens e finalizar a compra.</p>
        <Button asChild className="mt-6">
          <Link href="/login">Fazer Login</Link>
        </Button>
      </div>
    );
  }

  if (!isCartLoading && (!cartItems || cartItems.length === 0)) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-center p-4">
        <ShoppingBag className="size-16 text-muted-foreground" />
        <h1 className="text-4xl font-bold tracking-tight font-headline mt-6">Seu Carrinho está Vazio</h1>
        <p className="text-muted-foreground mt-2">Explore nosso catálogo e adicione algumas peças artesanais!</p>
        <Button asChild className="mt-6">
          <Link href="/">Voltar ao Catálogo</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight font-headline">Seu Carrinho</h1>
        <p className="text-muted-foreground mt-2">Revise seus itens e finalize sua compra.</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-4">
          {(cartItems || []).map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4 sm:p-6 flex gap-4">
                <Link href={`/products/${item.productGroupId}`}>
                  <Image src={item.imageUrl} alt={item.productName} width={128} height={128} className="rounded-md object-cover hidden sm:block" />
                </Link>
                <div className="flex-1 flex flex-col sm:flex-row justify-between gap-4">
                   <div className="flex-1">
                    <Link href={`/products/${item.productGroupId}`} className="font-semibold hover:underline text-lg">{item.productName}</Link>
                    <p className="text-sm text-muted-foreground">{item.selectedColor} / {item.selectedSize} / {item.selectedMaterial}</p>
                    <p className="text-sm font-semibold sm:hidden mt-2">R$ {(item.unitPriceAtAddition * item.quantity).toFixed(2).replace('.', ',')}</p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-normal sm:flex-col sm:items-end gap-4">
                    <div className="flex items-center border rounded-md">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => handleQuantityChange(item.id, item.quantity - 1)}>
                        <Minus className="size-4" />
                      </Button>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                        className="w-12 h-8 text-center border-x border-y-0 rounded-none focus-visible:ring-0"
                      />
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => handleQuantityChange(item.id, item.quantity + 1)}>
                        <Plus className="size-4" />
                      </Button>
                    </div>
                     <p className="text-lg font-semibold hidden sm:block">R$ {(item.unitPriceAtAddition * item.quantity).toFixed(2).replace('.', ',')}</p>
                  </div>
                   <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive self-start sm:self-center" onClick={() => handleRemoveItem(item.id)}>
                      <Trash2 className="size-5" />
                    </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <aside className="lg:col-span-1 sticky top-24">
          <Card>
            <CardHeader>
              <CardTitle>Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Frete</span>
                <span>A calcular</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
              </div>
              <Button asChild size="lg" className="w-full">
                <Link href="/checkout">Finalizar Compra</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

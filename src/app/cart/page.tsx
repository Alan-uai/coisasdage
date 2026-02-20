
'use client';

import { useMemo, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, limit, serverTimestamp } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { LogIn, ShoppingBag, Trash2, Plus, Minus, ArrowRight, ClipboardList, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { CartItem } from '@/lib/types';
import { cn } from '@/lib/utils';

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
        </CardContent>
      </Card>
    </div>
  );
}

export default function CartPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cartItemsQuery = useMemoFirebase(
    () => (user && firestore ? query(collection(firestore, 'users', user.uid, 'carts', 'main', 'items'), limit(50)) : null),
    [user, firestore]
  );

  const { data: cartItems, isLoading: isCartLoading } = useCollection<CartItem>(cartItemsQuery);

  const readyItems = useMemo(() => cartItems?.filter(item => item.readyMade) || [], [cartItems]);
  const customItems = useMemo(() => cartItems?.filter(item => !item.readyMade) || [], [cartItems]);

  const selectedItems = useMemo(() => cartItems?.filter(item => item.selected) || [], [cartItems]);
  
  const selectedType = useMemo(() => {
    if (selectedItems.length === 0) return null;
    return selectedItems[0].readyMade ? 'ready' : 'custom';
  }, [selectedItems]);

  const subtotal = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + item.unitPriceAtAddition * item.quantity, 0);
  }, [selectedItems]);

  const handleToggleSelection = (itemId: string, currentSelected: boolean, isReadyMade: boolean) => {
    if (!user || !firestore) return;

    if (!currentSelected && selectedType && ((selectedType === 'ready' && !isReadyMade) || (selectedType === 'custom' && isReadyMade))) {
        toast({
            title: "Seleção Restrita",
            description: "Você só pode selecionar itens de Pronta Entrega ou Sob Demanda por vez.",
            variant: "destructive"
        });
        return;
    }

    const itemRef = doc(firestore, 'users', user.uid, 'carts', 'main', 'items', itemId);
    updateDocumentNonBlocking(itemRef, { selected: !currentSelected });
  };

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

  const handleSubmitCustomRequest = async () => {
    if (!user || !firestore || isSubmitting) return;
    setIsSubmitting(true);

    try {
        const requestsRef = collection(firestore, 'users', user.uid, 'custom_requests');
        const requestData = {
            userId: user.uid,
            userName: user.displayName || 'Cliente',
            userEmail: user.email || '',
            items: selectedItems.map(item => ({
                productId: item.productId,
                productGroupId: item.productGroupId,
                productName: item.productName,
                imageUrl: item.imageUrl,
                quantity: item.quantity,
                unitPriceAtOrder: item.unitPriceAtAddition,
                selectedSize: item.selectedSize,
                selectedColor: item.selectedColor,
                selectedMaterial: item.selectedMaterial,
                readyMade: false,
            })),
            totalBasePrice: subtotal,
            finalPrice: subtotal,
            status: 'Pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        await addDocumentNonBlocking(requestsRef, requestData);

        selectedItems.forEach(item => {
            const itemRef = doc(firestore, 'users', user.uid, 'carts', 'main', 'items', item.id);
            deleteDocumentNonBlocking(itemRef);
        });

        toast({
            title: "Solicitação Enviada!",
            description: "Seus pedidos sob demanda foram enviados para análise.",
        });
        router.push('/orders');
    } catch (e) {
        console.error(e);
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isUserLoading || (user && isCartLoading)) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <header className="mb-8"><Skeleton className="h-10 w-64" /></header>
        <CartSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-center p-8">
        <LogIn className="size-16 text-muted-foreground mb-4" />
        <h1 className="text-3xl font-bold font-headline">Acesse seu Carrinho</h1>
        <Button asChild className="mt-6"><Link href="/login">Fazer Login</Link></Button>
      </div>
    );
  }

  if (!isCartLoading && (!cartItems || cartItems.length === 0)) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-center p-8">
        <ShoppingBag className="size-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold font-headline">Seu Carrinho está Vazio</h1>
        <Button asChild className="mt-6"><Link href="/">Ver Catálogo</Link></Button>
      </div>
    );
  }

  const renderItem = (item: CartItem) => (
    <Card key={item.id} className={cn(!item.selected && "opacity-60")}>
      <CardContent className="p-4 flex items-center gap-4">
        <Checkbox 
          checked={!!item.selected} 
          onCheckedChange={() => handleToggleSelection(item.id, !!item.selected, item.readyMade)}
          className="size-5"
        />
        <div className="size-20 relative rounded overflow-hidden shrink-0">
          <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold truncate">{item.productName}</h4>
          <p className="text-xs text-muted-foreground">{item.selectedSize} | {item.selectedColor}</p>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center border rounded">
              <Button variant="ghost" size="icon" className="size-7" onClick={() => handleQuantityChange(item.id, item.quantity - 1)}><Minus className="size-3" /></Button>
              <span className="w-8 text-center text-sm">{item.quantity}</span>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => handleQuantityChange(item.id, item.quantity + 1)}><Plus className="size-3" /></Button>
            </div>
            <span className="font-bold text-primary">R$ {(item.unitPriceAtAddition * item.quantity).toFixed(2).replace('.', ',')}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <header>
        <h1 className="text-4xl font-bold font-headline">Seu Carrinho</h1>
        <p className="text-muted-foreground mt-2">Organize e finalize suas escolhas artesanais.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {readyItems.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingBag className="size-5 text-primary" /> Pronta Entrega
              </h2>
              <div className="grid gap-4">{readyItems.map(renderItem)}</div>
            </section>
          )}

          {customItems.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ClipboardList className="size-5 text-primary" /> Sob Demanda (Para Análise)
              </h2>
              <div className="grid gap-4">{customItems.map(renderItem)}</div>
            </section>
          )}
        </div>

        <aside className="lg:col-span-1">
          <Card className="sticky top-24 border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle>Resumo do Pacote</CardTitle>
              <CardDescription>
                {selectedItems.length === 0 
                  ? "Nenhum item selecionado" 
                  : `${selectedItems.length} item(ns) ${selectedType === 'ready' ? 'de pronta entrega' : 'sob demanda'}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between font-bold text-xl text-primary">
                <span>Total</span>
                <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
              </div>
              
              {selectedType === 'custom' ? (
                <Button className="w-full" size="lg" disabled={isSubmitting} onClick={handleSubmitCustomRequest}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <ClipboardList className="mr-2" />}
                  Enviar para Análise
                </Button>
              ) : (
                <Button asChild className="w-full" size="lg" disabled={selectedItems.length === 0}>
                  <Link href={selectedItems.length > 0 ? "/checkout" : "#"}>
                    Prosseguir para Pagamento <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              )}

              {selectedItems.length > 0 && (
                <div className="bg-muted p-3 rounded-lg flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="size-4 shrink-0" />
                  <p>
                    {selectedType === 'custom' 
                      ? "Ao enviar para análise, a artesã avaliará a viabilidade e prazo. Você será notificado para concluir o pagamento após a aprovação."
                      : "Produtos de pronta entrega serão processados imediatamente após a confirmação do pagamento."
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

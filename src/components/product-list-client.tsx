
'use client';
import { useMemo } from 'react';
import type { Product } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ProductCard } from '@/components/product-card';

type InventoryItem = {
    id: string;
    quantity: number;
}

function ProductListSkeleton() {
    return (
        <section>
            <Skeleton className="h-8 w-64 mb-4" />
            <div className="flex gap-4">
                <Skeleton className="h-[400px] w-1/3" />
                <Skeleton className="h-[400px] w-1/3" />
                <Skeleton className="h-[400px] w-1/3" />
            </div>
        </section>
    );
}

export function ProductListClient({ allProducts }: { allProducts: Product[] }) {
    const firestore = useFirestore();
    const inventoryQuery = useMemoFirebase(
        () => (firestore ? collection(firestore, 'product_inventory') : null),
        [firestore]
    );
    const { data: inventory, isLoading: isInventoryLoading } = useCollection<InventoryItem>(inventoryQuery);

    const enrichedProducts = useMemo(() => {
        if (!inventory) {
            return allProducts;
        }
        const inventoryMap = new Map(inventory.map(item => [item.id, item.quantity]));
        return allProducts.map(p => ({
            ...p,
            quantity: inventoryMap.get(p.groupId) ?? 0,
        }));
    }, [allProducts, inventory]);

    const readyMadeProducts = enrichedProducts.filter(product => {
        return product.isMain && (product.quantity ?? 0) > 0;
    });

    const categoryDisplayProducts = enrichedProducts.filter(p => p.quantity === 0 || (p.quantity > 0 && p.isMain));

    const productsByCategory = categoryDisplayProducts.reduce((acc, product) => {
        if (!acc[product.category]) {
            acc[product.category] = [];
        }
        acc[product.category].push(product);
        return acc;
    }, {} as Record<string, Product[]>);

    if (isInventoryLoading && allProducts.length > 0) {
        return (
            <main className="flex-1 space-y-12">
                <ProductListSkeleton />
                <ProductListSkeleton />
            </main>
        );
    }
    
    return (
        <main className="flex-1 space-y-12">
          {enrichedProducts.length === 0 && (
            <div className="text-center text-muted-foreground p-12 border-2 border-dashed rounded-lg bg-muted/50">
                <h2 className="text-2xl font-bold font-headline mb-2 text-foreground">Estamos fechados/sem produtos, obrigado.</h2>
                <p>Volte em breve para conferir nossas novidades artesanais!</p>
            </div>
          )}

          {readyMadeProducts.length > 0 && (
            <section>
              <h2 className="text-3xl font-bold tracking-tight font-headline mb-4">A Pronta Entrega</h2>
              <Carousel 
                opts={{
                  align: "start",
                  loop: readyMadeProducts.length > 3,
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-4">
                  {readyMadeProducts.map((product) => (
                    <CarouselItem key={product.id} className="pl-4 sm:basis-1/2 lg:basis-1/3">
                      <div className="h-full">
                        <ProductCard product={product} isReadyMadeCarousel={true} />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="ml-12" />
                <CarouselNext className="mr-12"/>
              </Carousel>
            </section>
          )}

          {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
            <section key={category}>
              <h2 className="text-3xl font-bold tracking-tight font-headline mb-4">{category}</h2>
              <Carousel 
                opts={{
                  align: "start",
                  loop: categoryProducts.length > 3,
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-4">
                  {categoryProducts.map((product) => (
                    <CarouselItem key={product.id} className="pl-4 sm:basis-1/2 lg:basis-1/3">
                      <div className="h-full">
                         <ProductCard product={product} />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="ml-12" />
                <CarouselNext className="mr-12" />
              </Carousel>
            </section>
          ))}
        </main>
    );
}

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
            // Se o inventário não foi carregado, assume quantidade 0 para tudo.
             return allProducts.map(p => ({
                ...p,
                quantity: 0,
                variants: p.variants.map(v => ({ ...v, quantity: 0 })),
            }));
        }
        
        const inventoryMap = new Map(inventory.map(item => [item.id, item.quantity]));
        
        return allProducts.map(p => {
            let totalGroupQuantity = 0;
            const variantsWithQuantity = p.variants.map(v => {
                const quantity = inventoryMap.get(v.id) ?? 0;
                totalGroupQuantity += quantity;
                return { ...v, quantity };
            });

            return {
                ...p,
                variants: variantsWithQuantity,
                quantity: totalGroupQuantity, // A quantidade do grupo é a soma das variantes
            };
        });
    }, [allProducts, inventory]);

    const readyMadeProducts = useMemo(() => {
        const inStock: Product[] = [];
        if (!enrichedProducts) return inStock;

        enrichedProducts.forEach(group => {
            // Filtra as variantes que realmente têm estoque
            const variantsInStock = group.variants.filter(v => (v as any).quantity > 0);

            variantsInStock.forEach(variant => {
                // Para cada variante em estoque, cria um card de "Produto" para o carrossel
                inStock.push({
                    ...group,
                    id: variant.id, // ID da variante específica
                    name: group.name,
                    imageUrl: variant.imageUrl,
                    price: variant.price || group.price,
                    minPrice: variant.price || group.price,
                    maxPrice: variant.price || group.price,
                    // Propriedades específicas da variante para exibição no card
                    color: (variant as any).color,
                    size: (variant as any).size,
                    quantity: (variant as any).quantity,
                    isMain: false,
                    variants: [], // Não são necessárias sub-variantes no card de pronta-entrega
                    options: { sizes: [], colors: [], materials: [] },
                    sizeRangeText: (variant as any).size,
                });
            });
        });
        return inStock;
    }, [enrichedProducts]);


    const categoryDisplayProducts = enrichedProducts.filter(p => p.isMain);

    const productsByCategory = useMemo(() => {
        return categoryDisplayProducts.reduce((acc, product) => {
            const category = product.category || 'Outros';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(product);
            return acc;
        }, {} as Record<string, Product[]>);
    }, [categoryDisplayProducts]);

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

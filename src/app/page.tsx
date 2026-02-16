import Link from 'next/link';
import Image from 'next/image';
import { products } from '@/lib/data';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import type { Product } from '@/lib/types';

// Helper function to render a product card
const ProductCard = ({ product }: { product: Product }) => (
  <Card key={product.id} className="overflow-hidden flex flex-col group h-full">
    <CardHeader className="p-0">
      <Link href={`/products/${product.id}`} className="block overflow-hidden">
        <Image
          src={product.imageUrl}
          alt={product.name}
          width={600}
          height={400}
          className="object-cover w-full aspect-[3/2] group-hover:scale-105 transition-transform duration-300"
          data-ai-hint={product.imageHint}
        />
      </Link>
    </CardHeader>
    <CardContent className="p-4 flex flex-col flex-1">
      <div className="flex-1">
        <h2 className="text-xl font-bold font-headline">{product.name}</h2>
        <p className="text-muted-foreground mt-1 text-sm line-clamp-2">{product.description}</p>
      </div>
      <div className="flex justify-between items-center mt-4">
        <p className="text-lg font-semibold">R$ {product.price.toFixed(2).replace('.', ',')}</p>
        <Button asChild>
          <Link href={`/products/${product.id}`}>Ver Detalhes</Link>
        </Button>
      </div>
    </CardContent>
  </Card>
);

export default function ProductsPage() {
  const readyMadeProducts = products.filter(product => product.readyMade);
  
  const productsByCategory = products.reduce((acc, product) => {
    if (!product.readyMade) { // Do not include ready-made products in category carousels
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
    }
    return acc;
  }, {} as Record<string, Product[]>);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8 space-y-12">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight font-headline">Nosso Catálogo</h1>
          <p className="text-muted-foreground mt-2">Explore nossas criações feitas à mão com amor.</p>
        </header>
        
        <main className="flex-1 space-y-12">
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
                        <ProductCard product={product} />
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
      </div>
    </div>
  );
}

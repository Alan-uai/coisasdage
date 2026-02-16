import Link from 'next/link';
import Image from 'next/image';
import { getProducts, getLogoUrl } from '@/lib/cloudinary';
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

export default async function ProductsPage() {
  const [logoUrl, products] = await Promise.all([
    getLogoUrl(),
    getProducts()
  ]);
  
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
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="Coisas da Gê"
              width={300}
              height={100}
              className="mx-auto"
              priority
            />
          ) : (
            <h1 className="text-4xl font-bold tracking-tight font-headline">Coisas da Gê</h1>
          )}
          <p className="text-muted-foreground mt-2">Explore nossas criações feitas à mão com amor.</p>
        </header>
        
        <main className="flex-1 space-y-12">
          {products.length === 0 && (
            <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                <h2 className="text-2xl font-bold font-headline mb-2 text-foreground">Nenhum produto encontrado!</h2>
                <p className="max-w-2xl mx-auto">
                    Isso pode acontecer por alguns motivos:
                </p>
                <ul className="list-disc list-inside text-left max-w-md mx-auto mt-4 space-y-1">
                    <li>Verifique se suas credenciais <code className="font-semibold bg-muted px-1 py-0.5 rounded">CLOUDINARY_API_KEY</code> e <code className="font-semibold bg-muted px-1 py-0.5 rounded">CLOUDINARY_API_SECRET</code> estão configuradas no arquivo <code className="font-semibold bg-muted px-1 py-0.5 rounded">.env</code>.</li>
                    <li>Certifique-se de que suas imagens estão em pastas no Cloudinary (ex: "Jogo-Banho").</li>
                    <li>Confirme que cada imagem de produto tem os metadados de contexto obrigatórios salvos: <code className="font-semibold bg-muted px-1 py-0.5 rounded">id</code>, <code className="font-semibold bg-muted px-1 py-0.5 rounded">name</code>, e <code className="font-semibold bg-muted px-1 py-0.5 rounded">price</code>.</li>
                </ul>
                <p className="mt-4">Após verificar, pode levar até 1 minuto para as alterações aparecerem.</p>
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

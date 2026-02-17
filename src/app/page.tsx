import Link from 'next/link';
import Image from 'next/image';
import { getProducts, getLogoUrl } from '@/lib/cloudinary';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/product-card';

export default async function ProductsPage() {
  const [logoUrl, products] = await Promise.all([
    getLogoUrl(),
    getProducts()
  ]);
  
  const readyMadeProducts = products.filter(product => product.readyMade);
  
  // A product appears in a category if it's not ready-made, OR if it's a ready-made main product.
  // This prevents ready-made variants from appearing in both the ready-made and category carousels.
  const categoryDisplayProducts = products.filter(p => !p.readyMade || (p.readyMade && p.isMain));
  
  const productsByCategory = categoryDisplayProducts.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
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
                    Isso pode acontecer por alguns motivos. Verifique o terminal onde você executou <code className="font-semibold bg-muted px-1 py-0.5 rounded">npm run dev</code> para mensagens de depuração.
                </p>
                <ul className="list-disc list-inside text-left max-w-md mx-auto mt-4 space-y-1">
                    <li>Verifique se suas credenciais <code className="font-semibold bg-muted px-1 py-0.5 rounded">CLOUDINARY_API_KEY</code> e <code className="font-semibold bg-muted px-1 py-0.5 rounded">CLOUDINARY_API_SECRET</code> estão configuradas no arquivo <code className="font-semibold bg-muted px-1 py-0.5 rounded">.env</code>. <strong>Importante:</strong> Após criar ou editar este arquivo, você precisa reiniciar o servidor.</li>
                    <li>Confirme que cada imagem de produto tem os metadados de contexto obrigatórios salvos, escritos <strong>exatamente</strong> assim (tudo em minúsculo): <code className="font-semibold bg-muted px-1 py-0.5 rounded">id</code>, <code className="font-semibold bg-muted px-1 py-0.5 rounded">groupId</code>, e <code className="font-semibold bg-muted px-1 py-0.5 rounded">name</code>, <code className="font-semibold bg-muted px-1 py-0.5 rounded">price</code>, <code className="font-semibold bg-muted px-1 py-0.5 rounded">category</code>.</li>
                     <li>Para variações, garanta que um produto do grupo tenha `isMain: true` e as opções listadas (ex: `colors`).</li>
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
      </div>
    </div>
  );
}

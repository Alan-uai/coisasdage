import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getProducts, getProductById } from '@/lib/cloudinary';
import { Separator } from '@/components/ui/separator';
import { ProductCustomizationForm } from './product-customization-form';

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({
    slug: product.id,
  }));
}

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const product = await getProductById(params.slug);

  if (!product) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8">
      <main className="flex-1">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto">
          <div className="overflow-hidden rounded-lg">
            <Image
              src={product.imageUrl}
              alt={product.name}
              width={800}
              height={600}
              className="object-cover w-full aspect-[4/3]"
              data-ai-hint={product.imageHint}
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl lg:text-4xl font-bold font-headline">{product.name}</h1>
            <p className="text-lg text-muted-foreground mt-2">{product.category}</p>
            <p className="text-3xl font-bold mt-4">R$ {product.price.toFixed(2).replace('.', ',')}</p>
            <Separator className="my-6" />
            <p className="text-base leading-relaxed">{product.description}</p>
            <Separator className="my-6" />
            <ProductCustomizationForm product={product} />
          </div>
        </div>
      </main>
    </div>
  );
}

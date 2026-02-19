import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getProducts, getProductByGroupId } from '@/lib/cloudinary';
import { ProductClientPage } from './product-customization-form';

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({
    slug: product.groupId,
  }));
}

export default async function ProductDetailPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const product = await getProductByGroupId(params.slug);

  if (!product) {
    notFound();
  }

  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground font-headline">Carregando detalhes do produto...</p>
        </div>
      </div>
    }>
      <ProductClientPage product={product} />
    </Suspense>
  );
}

import { notFound } from 'next/navigation';
import { getProducts, getProductByGroupId } from '@/lib/cloudinary';
import { ProductClientPage } from './product-customization-form';

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({
    slug: product.groupId,
  }));
}

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const product = await getProductByGroupId(params.slug);

  if (!product) {
    notFound();
  }

  return <ProductClientPage product={product} />;
}

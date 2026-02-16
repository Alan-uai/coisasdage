import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CartPage() {
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

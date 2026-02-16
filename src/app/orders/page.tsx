import { orders } from '@/lib/data';
import { products } from '@/lib/data';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Truck } from 'lucide-react';

type StatusKey = 'Processing' | 'Crafting' | 'Shipped' | 'Delivered';

const statusMap: { [key in StatusKey]: { text: string; value: number; variant: 'default' | 'secondary' | 'outline' | 'destructive' | null | undefined } } = {
  Processing: { text: 'Processando', value: 25, variant: 'secondary' },
  Crafting: { text: 'Em Produção', value: 50, variant: 'default' },
  Shipped: { text: 'Enviado', value: 75, variant: 'default' },
  Delivered: { text: 'Entregue', value: 100, variant: 'outline' },
};

export default function OrdersPage() {
  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight font-headline">Meus Pedidos</h1>
        <p className="text-muted-foreground mt-2">Acompanhe o progresso de suas encomendas.</p>
      </header>
      <main className="flex-1 space-y-6">
        {orders.map((order) => {
          const product = products.find(p => p.id === order.productId);
          const statusInfo = statusMap[order.status as StatusKey];
          return (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div>
                    <CardTitle className="font-headline text-xl">Pedido #{order.id}</CardTitle>
                    <CardDescription>
                      Realizado em {new Date(order.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </CardDescription>
                  </div>
                  <Badge variant={statusInfo.variant}>{statusInfo.text}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  {product && (
                     <Link href={`/products/${product.id}`} className="block flex-shrink-0">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={150}
                        height={100}
                        className="rounded-md object-cover aspect-[3/2]"
                        data-ai-hint={product.imageHint}
                      />
                    </Link>
                  )}
                  <div className="flex-1">
                    <Link href={`/products/${order.productId}`} className="font-semibold hover:underline">{order.productName}</Link>
                    <p className="text-sm text-muted-foreground">Entrega estimada: {new Date(order.estimatedDelivery).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                    {order.status === 'Shipped' && order.trackingNumber && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-primary">
                        <Truck className="size-4" />
                        <span className="font-medium">Rastreamento:</span>
                        <a href="#" className="font-mono hover:underline">{order.trackingNumber}</a>
                      </div>
                    )}
                  </div>
                </div>
                <Separator className="my-4" />
                <div>
                  <Label htmlFor={`progress-${order.id}`} className="mb-2 block text-sm font-medium">Progresso do Pedido</Label>
                  <Progress id={`progress-${order.id}`} value={statusInfo.value} className="h-2" />
                  <div className="hidden sm:flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Processando</span>
                    <span>Em Produção</span>
                    <span>Enviado</span>
                    <span>Entregue</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}

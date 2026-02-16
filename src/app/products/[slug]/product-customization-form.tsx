'use client';

import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingBag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ProductCustomizationForm({ product }: { product: Product }) {
  const { toast } = useToast();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Here you would typically add the item to a cart state/context
    toast({
      title: "Adicionado ao Carrinho!",
      description: `${product.name} foi adicionado ao seu carrinho de compras.`,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {product.options.sizes.length > 1 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">Tamanho</Label>
          <RadioGroup defaultValue={product.options.sizes[0]} className="flex flex-wrap gap-x-4 gap-y-2">
            {product.options.sizes.map((size) => (
              <div key={size} className="flex items-center">
                <RadioGroupItem value={size} id={`size-${size}`} />
                <Label htmlFor={`size-${size}`} className="ml-2 cursor-pointer text-sm">{size}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}

      {product.options.colors.length > 1 && (
        <div className="space-y-3">
          <Label htmlFor="color-select" className="text-base font-semibold">Cor</Label>
          <Select defaultValue={product.options.colors[0]}>
            <SelectTrigger id="color-select" className="w-full md:w-[240px]">
              <SelectValue placeholder="Selecione uma cor" />
            </SelectTrigger>
            <SelectContent>
              {product.options.colors.map((color) => (
                <SelectItem key={color} value={color}>{color}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {product.options.materials.length > 1 && (
        <div className="space-y-3">
          <Label htmlFor="material-select" className="text-base font-semibold">Material</Label>
          <Select defaultValue={product.options.materials[0]}>
            <SelectTrigger id="material-select" className="w-full md:w-[240px]">
              <SelectValue placeholder="Selecione um material" />
            </SelectTrigger>
            <SelectContent>
              {product.options.materials.map((material) => (
                <SelectItem key={material} value={material}>{material}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full md:w-auto mt-4">
        <ShoppingBag className="mr-2" />
        Adicionar ao Carrinho
      </Button>
    </form>
  );
}

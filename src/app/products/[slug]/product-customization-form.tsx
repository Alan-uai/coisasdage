'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ShoppingBag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// The actual form component
function ProductCustomizationFormComponent({ product, setSelectedImageUrl }: { product: Product, setSelectedImageUrl: (url: string) => void }) {
  const { toast } = useToast();

  const [selectedColor, setSelectedColor] = useState<string>(product.options.colors[0]);
  const [selectedSize, setSelectedSize] = useState<string>(product.options.sizes[0]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>(product.options.materials[0]);
  
  useEffect(() => {
    // Find the variant that matches the selected color
    const variant = product.variants.find(v => v.color === selectedColor);
    if (variant) {
      setSelectedImageUrl(variant.imageUrl);
    }
  }, [selectedColor, product.variants, setSelectedImageUrl]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast({
      title: "Adicionado ao Carrinho!",
      description: `${product.name} (${selectedColor}, ${selectedSize}) foi adicionado ao seu carrinho de compras.`,
    });
  };

  const hasColorOptions = product.options.colors.length > 1 || (product.options.colors.length === 1 && product.options.colors[0] !== 'Padrão');
  const hasSizeOptions = product.options.sizes.length > 1 || (product.options.sizes.length === 1 && product.options.sizes[0] !== 'Padrão');
  const hasMaterialOptions = product.options.materials.length > 1 || (product.options.materials.length === 1 && product.options.materials[0] !== 'Padrão');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {hasSizeOptions && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">Tamanho</Label>
          <RadioGroup value={selectedSize} onValueChange={setSelectedSize} className="flex flex-wrap gap-x-4 gap-y-2">
            {product.options.sizes.map((size) => (
              <div key={size} className="flex items-center">
                <RadioGroupItem value={size} id={`size-${size}`} />
                <Label htmlFor={`size-${size}`} className="ml-2 cursor-pointer text-sm">{size}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}

      {hasColorOptions && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">Cor</Label>
           <RadioGroup value={selectedColor} onValueChange={setSelectedColor} className="flex flex-wrap gap-x-4 gap-y-2">
            {product.options.colors.map((color) => (
              <div key={color} className="flex items-center">
                <RadioGroupItem value={color} id={`color-${color}`} />
                <Label htmlFor={`color-${color}`} className="ml-2 cursor-pointer text-sm">{color}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )}

      {hasMaterialOptions && (
        <div className="space-y-3">
          <Label htmlFor="material-select" className="text-base font-semibold">Material</Label>
          <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
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


// The client page component that holds state and renders the layout
export function ProductClientPage({ product }: { product: Product }) {
  const [selectedImageUrl, setSelectedImageUrl] = useState(product.imageUrl);

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8">
      <main className="flex-1">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto">
          <div className="overflow-hidden rounded-lg">
            <Image
              src={selectedImageUrl}
              alt={product.name}
              width={800}
              height={600}
              className="object-cover w-full aspect-[4/3] transition-opacity duration-300"
              key={selectedImageUrl} // Force re-render on image change for transition
              data-ai-hint={product.imageHint}
              priority
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl lg:text-4xl font-bold font-headline">{product.name}</h1>
            <p className="text-lg text-muted-foreground mt-2">{product.category}</p>
            <p className="text-3xl font-bold mt-4">R$ {product.price.toFixed(2).replace('.', ',')}</p>
            <Separator className="my-6" />
            <p className="text-base leading-relaxed">{product.description}</p>
            <Separator className="my-6" />
            <ProductCustomizationFormComponent product={product} setSelectedImageUrl={setSelectedImageUrl} />
          </div>
        </div>
      </main>
    </div>
  );
}

// Default export for backward compatibility if something still imports it directly
export default ProductCustomizationFormComponent;

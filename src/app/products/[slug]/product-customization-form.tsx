'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import type { Product, ProductVariant } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ShoppingBag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Helper to get the first available option from a list
const getFirstAvailable = (
  allOptions: string[],
  availableOptions?: string[]
): string => {
  // If an availability list is provided, find the first match
  if (availableOptions && availableOptions.length > 0) {
    for (const option of allOptions) {
      if (availableOptions.includes(option)) {
        return option;
      }
    }
  }
  // Fallback to the first option in the main list if no available option is found or if no availability list is provided
  return allOptions[0];
};


// The actual form component
function ProductCustomizationFormComponent({ 
  product,
  selectedColor,
  setSelectedColor,
  selectedSize,
  setSelectedSize,
  selectedMaterial,
  setSelectedMaterial,
  availableColorsForCurrentSize,
  availableMaterialsForCurrentSelection,
}: { 
  product: Product, 
  selectedColor: string,
  setSelectedColor: (color: string) => void,
  selectedSize: string,
  setSelectedSize: (size: string) => void,
  selectedMaterial: string,
  setSelectedMaterial: (material: string) => void,
  availableColorsForCurrentSize: string[],
  availableMaterialsForCurrentSelection: string[],
}) {
  const { toast } = useToast();

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

  const globallyAvailableSizes = product.availability?.sizes;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {hasSizeOptions && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">Tamanho</Label>
          <RadioGroup value={selectedSize} onValueChange={setSelectedSize} className="flex flex-wrap gap-x-4 gap-y-2">
            {product.options.sizes.map((size) => {
              const isAvailable = globallyAvailableSizes ? globallyAvailableSizes.includes(size) : true;
              return (
                <div key={size} className="flex items-center">
                  <RadioGroupItem value={size} id={`size-${size}`} disabled={!isAvailable} />
                  <Label 
                    htmlFor={`size-${size}`} 
                    className={cn(
                      "ml-2 cursor-pointer text-sm",
                      !isAvailable && "text-muted-foreground line-through cursor-not-allowed"
                    )}
                  >
                    {size}
                  </Label>
                </div>
              )
            })}
          </RadioGroup>
        </div>
      )}

      {hasColorOptions && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">Cor</Label>
           <RadioGroup value={selectedColor} onValueChange={setSelectedColor} className="flex flex-wrap gap-x-4 gap-y-2">
            {product.options.colors.map((color) => {
              // Use the dynamically calculated available colors
              const isAvailable = availableColorsForCurrentSize.includes(color);
              return (
                <div key={color} className="flex items-center">
                  <RadioGroupItem value={color} id={`color-${color}`} disabled={!isAvailable} />
                  <Label 
                    htmlFor={`color-${color}`} 
                    className={cn(
                      "ml-2 cursor-pointer text-sm",
                      !isAvailable && "text-muted-foreground line-through cursor-not-allowed"
                    )}
                  >
                    {color}
                  </Label>
                </div>
              )
            })}
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
              {product.options.materials.map((material) => {
                 const isAvailable = availableMaterialsForCurrentSelection.includes(material);
                 return (
                  <SelectItem key={material} value={material} disabled={!isAvailable}>
                    {material}
                  </SelectItem>
                 )
              })}
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
  const searchParams = useSearchParams();
  const colorFromUrl = searchParams.get('color');

  const [selectedImageUrl, setSelectedImageUrl] = useState(product.imageUrl);
  const [currentPrice, setCurrentPrice] = useState(product.price);
  
  const [selectedSize, setSelectedSize] = useState<string>(() =>
    getFirstAvailable(product.options.sizes, product.availability?.sizes)
  );
  
  // Memoize the calculation of available colors based on the selected size.
  const availableColorsForCurrentSize = useMemo(() => {
    const sizeToMatch = selectedSize === 'Padrão' ? (product.size || 'Padrão') : selectedSize;
    
    // A variant is considered for this size if its own size matches, OR if it has no size (inherits 'Padrão').
    const variantsForSize = product.variants.filter(v => (v.size || product.size || 'Padrão') === sizeToMatch);
    
    const specificColorsForSize = [...new Set(variantsForSize.map(v => v.color).filter((c): c is string => !!c))];

    let candidateColors: string[];
    
    if (specificColorsForSize.length > 0) {
      candidateColors = specificColorsForSize;
    } else {
      candidateColors = product.options.colors;
    }
    
    const globallyAvailableColors = product.availability?.colors || product.options.colors;
    const finalColors = candidateColors.filter(c => globallyAvailableColors.includes(c));
    
    return finalColors.length > 0 ? finalColors : globallyAvailableColors;

  }, [selectedSize, product]);
  
  const [selectedColor, setSelectedColor] = useState<string>(() => {
    if (colorFromUrl && availableColorsForCurrentSize.includes(colorFromUrl)) {
      return colorFromUrl;
    }
    return getFirstAvailable(product.options.colors, availableColorsForCurrentSize);
  });

  const availableMaterialsForCurrentSelection = useMemo(() => {
    const sizeToMatch = selectedSize === 'Padrão' ? (product.size || 'Padrão') : selectedSize;
    
    const variantsForSize = product.variants.filter(v => (v.size || product.size || 'Padrão') === sizeToMatch);
    const variantsForSizeAndColor = variantsForSize.filter(v => v.color === selectedColor || !v.color);
    
    const specificMaterials = [...new Set(variantsForSizeAndColor.map(v => v.material).filter((m): m is string => !!m))];
    
    let candidateMaterials: string[];

    if (specificMaterials.length > 0) {
        candidateMaterials = specificMaterials;
    } else {
        candidateMaterials = product.options.materials;
    }

    const globallyAvailableMaterials = product.availability?.materials || product.options.materials;
    const finalMaterials = candidateMaterials.filter(m => globallyAvailableMaterials.includes(m));

    return finalMaterials.length > 0 ? finalMaterials : globallyAvailableMaterials;

  }, [selectedSize, selectedColor, product]);

  const [selectedMaterial, setSelectedMaterial] = useState<string>(() => 
    getFirstAvailable(product.options.materials, availableMaterialsForCurrentSelection)
  );

  useEffect(() => {
    if (!availableColorsForCurrentSize.includes(selectedColor)) {
      setSelectedColor(availableColorsForCurrentSize[0] || product.options.colors[0]);
    }
  }, [availableColorsForCurrentSize, selectedColor, product.options.colors]);
  
  useEffect(() => {
    if (!availableMaterialsForCurrentSelection.includes(selectedMaterial)) {
      setSelectedMaterial(availableMaterialsForCurrentSelection[0] || product.options.materials[0]);
    }
  }, [availableMaterialsForCurrentSelection, selectedMaterial, product.options.materials]);

  useEffect(() => {
    const findBestVariant = (): ProductVariant | null => {
      if (!product.variants || product.variants.length === 0) return null;
      
      let bestScore = -1;
      let bestVariant: ProductVariant | null = null;
      
      const sizeToMatch = selectedSize === 'Padrão' ? (product.size || 'Padrão') : selectedSize;

      for (const variant of product.variants) {
        const variantEffectiveSize = variant.size || product.size || 'Padrão';
        
        if (variantEffectiveSize !== sizeToMatch) continue;
        if (variant.color && variant.color !== selectedColor) continue;
        if (variant.material && variant.material !== selectedMaterial) continue;

        let currentScore = 0;
        if (variant.color === selectedColor) currentScore++;
        if (variant.size) currentScore++;
        if (variant.material === selectedMaterial) currentScore++;

        if (currentScore > bestScore) {
          bestScore = currentScore;
          bestVariant = variant;
        }
      }
      
      return bestVariant;
    };

    const variant = findBestVariant();

    if (variant) {
      setSelectedImageUrl(variant.imageUrl);
      setCurrentPrice(variant.price ?? product.price);
    } else {
      setSelectedImageUrl(product.imageUrl);
      setCurrentPrice(product.price);
    }
  }, [selectedColor, selectedSize, selectedMaterial, product]);


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
            <p className="text-3xl font-bold mt-4">R$ {currentPrice.toFixed(2).replace('.', ',')}</p>
            <Separator className="my-6" />
            <p className="text-base leading-relaxed whitespace-pre-wrap">{product.description}</p>
            <Separator className="my-6" />
            <ProductCustomizationFormComponent 
              product={product}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
              selectedSize={selectedSize}
              setSelectedSize={setSelectedSize}
              selectedMaterial={selectedMaterial}
              setSelectedMaterial={setSelectedMaterial}
              availableColorsForCurrentSize={availableColorsForCurrentSize}
              availableMaterialsForCurrentSelection={availableMaterialsForCurrentSelection}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

// Default export for backward compatibility if something still imports it directly
export default ProductClientPage;

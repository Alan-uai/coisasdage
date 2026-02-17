'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Renders a color swatch, handling single colors and various two-color combinations.
const renderColorSwatch = (color: string, primaryColor?: string): JSX.Element => {
    const colorHexMap: { [key: string]: string } = {
        'preto': '#262626',
        'branco': '#f8f8f8',
        'cinza': '#8a8a8a',
        'vermelho': '#c85c5c',
        'verde sálvia': '#a8b898',
        'verde': '#6a9c89',
        'azul marinho': '#384d70',
        'azul': '#6c8dae',
        'amarelo': '#e3b448',
        'rosa': '#d4a5a5',
        'roxo': '#9b7e9b',
        'laranja': '#d88c6c',
        'marrom': '#8c6c5c',
        'terracota': '#c27d60',
        'cru': '#e8e2d9',
    };

    const lowerColor = color.toLowerCase();
    const colorParts = lowerColor.split(' e ').map(p => p.trim());

    // Case 1: Explicit two-part color like "Preto e Branco"
    if (colorParts.length > 1 && colorHexMap[colorParts[0]] && colorHexMap[colorParts[1]]) {
        const style: React.CSSProperties = {
            background: `linear-gradient(135deg, ${colorHexMap[colorParts[0]]} 50%, ${colorHexMap[colorParts[1]]} 50%)`
        };
        let className = "w-full h-full rounded-full";
        if (colorParts.includes('branco')) {
            className = cn(className, "border border-gray-300");
        }
        return <div className={className} style={style} />;
    }
    
    const lowerPrimaryColor = primaryColor?.toLowerCase();

    // Case 2: Combination of a primaryColor and the current color from options
    if (lowerPrimaryColor && lowerColor !== lowerPrimaryColor && colorHexMap[lowerColor] && colorHexMap[lowerPrimaryColor]) {
       const style: React.CSSProperties = {
            background: `linear-gradient(135deg, ${colorHexMap[lowerPrimaryColor]} 50%, ${colorHexMap[lowerColor]} 50%)`
        };
        let className = "w-full h-full rounded-full";
        if (lowerColor === 'branco' || lowerPrimaryColor === 'branco') {
             className = cn(className, "border border-gray-300");
        }
        return <div className={className} style={style} />;
    }

    // Case 3: Single solid color, using the hex map for consistency
    const hex = colorHexMap[lowerColor];
    const style: React.CSSProperties = hex ? { backgroundColor: hex } : { backgroundColor: '#e0e0e0' };
    let className = "w-full h-full rounded-full";
    if (lowerColor === 'branco' || lowerColor === 'cru') {
      className = cn(className, "border border-gray-300");
    }
    
    return <div className={className} style={style} />;
}

export const ProductCard = ({ product }: { product: Product }) => {
    // Find the main variant to determine the initial active color.
    const mainVariant = product.variants.find(v => v.id === product.id);
    const initialActiveColor = mainVariant?.color;

    const [activeImageUrl, setActiveImageUrl] = useState(product.imageUrl);
    const [activeColor, setActiveColor] = useState<string | undefined>(initialActiveColor);

    const handleColorChange = (color: string) => {
        const variant = product.variants.find(v => v.color === color);
        if (variant?.imageUrl) {
            setActiveImageUrl(variant.imageUrl);
        } else {
            // Fallback to the main product image if a specific variant image is not found.
            setActiveImageUrl(product.imageUrl);
        }
        setActiveColor(color);
    };

    const colors = product.options.colors.filter(c => c !== 'Padrão');
    const hasColorVariants = colors.length > 0;
    
    const availableColors = product.availability?.colors;
    const sortedColors = [...colors].sort((a, b) => {
        const aIsAvailable = availableColors ? availableColors.includes(a) : true;
        const bIsAvailable = availableColors ? availableColors.includes(b) : true;
        if (aIsAvailable === bIsAvailable) return 0;
        return aIsAvailable ? -1 : 1;
    });

    const MAX_SWATCHES = 5;
    const visibleColors = sortedColors.slice(0, MAX_SWATCHES);
    const remainingColorsCount = sortedColors.length - MAX_SWATCHES;

    return (
        <Card className="overflow-hidden flex flex-col group h-full">
            <CardHeader className="p-0">
                <Link href={`/products/${product.groupId}`} className="block overflow-hidden">
                    <Image
                        src={activeImageUrl}
                        alt={product.name}
                        width={600}
                        height={400}
                        className="object-cover w-full aspect-[3/2] group-hover:scale-105 transition-transform duration-300"
                        data-ai-hint={product.imageHint}
                        key={activeImageUrl} // Force re-render for animations on src change
                    />
                </Link>
            </CardHeader>
            <CardContent className="p-4 flex flex-col flex-1">
                {(hasColorVariants || product.sizeRangeText) && (
                  <div className="flex justify-between items-center mb-3 min-h-[20px]">
                      {hasColorVariants ? (
                          <TooltipProvider delayDuration={100}>
                              <div className="flex items-center gap-2">
                                  {visibleColors.map(color => {
                                       const isAvailable = availableColors ? availableColors.includes(color) : true;
                                       return (
                                          <Tooltip key={color}>
                                              <TooltipTrigger asChild>
                                                  <button
                                                      onClick={() => isAvailable && handleColorChange(color)}
                                                      className={cn(
                                                          "w-5 h-5 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all",
                                                          activeColor === color ? 'ring-2 ring-primary ring-offset-1' : 'hover:ring-1 hover:ring-muted-foreground',
                                                          !isAvailable && 'opacity-40 cursor-not-allowed'
                                                      )}
                                                      aria-label={`Mudar para cor ${color}`}
                                                      disabled={!isAvailable}
                                                  >
                                                      {renderColorSwatch(color, product.primaryColor)}
                                                  </button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                  <p>{product.primaryColor && product.primaryColor.toLowerCase() !== color.toLowerCase() ? `${product.primaryColor} e ${color}` : color}</p>
                                              </TooltipContent>
                                          </Tooltip>
                                       )
                                  })}
                                  {remainingColorsCount > 0 && (
                                      <Tooltip>
                                          <TooltipTrigger asChild>
                                              <Link href={`/products/${product.groupId}`} className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold border hover:bg-accent">
                                                  +{remainingColorsCount}
                                              </Link>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                              <p>{remainingColorsCount} mais cores</p>
                                          </TooltipContent>
                                      </Tooltip>
                                  )}
                              </div>
                          </TooltipProvider>
                      ) : <div />}
                      
                      {product.sizeRangeText && (
                           <p className="text-xs text-muted-foreground font-semibold">{product.sizeRangeText}</p>
                      )}
                  </div>
                )}
                <div className="flex-1">
                    <h2 className="text-xl font-bold font-headline">{product.name}</h2>
                    <p className="text-muted-foreground mt-1 text-sm line-clamp-2">{product.description}</p>
                </div>
                <div className="flex justify-between items-center mt-4">
                    <p className="text-lg font-semibold">
                        {product.minPrice !== product.maxPrice 
                            ? `R$ ${product.minPrice.toFixed(2).replace('.', ',')} - R$ ${product.maxPrice.toFixed(2).replace('.', ',')}`
                            : `R$ ${product.price.toFixed(2).replace('.', ',')}`}
                    </p>
                    <Button asChild>
                        <Link href={`/products/${product.groupId}`}>Ver Detalhes</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

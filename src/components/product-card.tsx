'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Renders a color swatch, handling single colors and various multi-color combinations.
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
        'salmão': '#FFA07A',
        'bordô': '#6D2E46',
        'lima': '#C0D904',
        'esmeralda': '#50C878',
        'dourado': '#FFD700',
    };

    const getHex = (c: string) => colorHexMap[c.toLowerCase().trim()];
    
    // Get colors from the 'color' option string (e.g., "Verde e Branco")
    const optionColors = color.split(' e ').map(c => c.trim().toLowerCase()).filter(Boolean);
    
    let allColorNames: string[] = [];

    // Add primary color if it exists and is not already in the option colors
    if (primaryColor && !optionColors.includes(primaryColor.toLowerCase())) {
        allColorNames.push(primaryColor.toLowerCase());
    }
    
    // Add the option colors
    allColorNames.push(...optionColors);

    // Remove duplicates, get hex codes, and limit to 3 for the swatch
    const finalHexParts = [...new Set(allColorNames)]
                            .map(getHex)
                            .filter((c): c is string => !!c)
                            .slice(0, 3);
    
    if (finalHexParts.length === 0) {
        // Fallback for unknown colors to prevent errors
        return <div className="w-full h-full rounded-full bg-gray-200" />;
    }

    let style: React.CSSProperties;
    switch (finalHexParts.length) {
        case 3:
            style = { background: `linear-gradient(135deg, ${finalHexParts[0]} 33%, ${finalHexParts[1]} 33%, ${finalHexParts[1]} 66%, ${finalHexParts[2]} 66%)` };
            break;
        case 2:
            style = { background: `linear-gradient(135deg, ${finalHexParts[0]} 50%, ${finalHexParts[1]} 50%)` };
            break;
        default: // case 1
            style = { backgroundColor: finalHexParts[0] };
            break;
    }
    
    // Add a border for light colors (like white or off-white) to make them visible on light backgrounds
    const hasLightColor = allColorNames.some(c => c.includes('branco') || c.includes('cru'));
    const className = cn(
        "w-full h-full rounded-full",
        hasLightColor && "border border-gray-300"
    );
    
    return <div className={className} style={style} />;
}


export const ProductCard = ({ product, isReadyMadeCarousel = false }: { product: Product, isReadyMadeCarousel?: boolean }) => {
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
    
    const productUrl = `/products/${product.groupId}`;
    const productLink = activeColor ? `${productUrl}?color=${encodeURIComponent(activeColor)}` : productUrl;


    return (
        <Card className="overflow-hidden flex flex-col group h-full">
            <CardHeader className="p-0">
                <Link href={productLink} className="block overflow-hidden">
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
                {!isReadyMadeCarousel && (hasColorVariants || product.sizeRangeText) && (
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
                    <p className="text-muted-foreground mt-1 text-sm line-clamp-2 whitespace-pre-wrap">{product.description}</p>
                </div>
                <div className="flex justify-between items-center mt-4">
                    <p className="text-lg font-semibold">
                        {product.minPrice !== product.maxPrice 
                            ? `R$ ${product.minPrice.toFixed(2).replace('.', ',')} - R$ ${product.maxPrice.toFixed(2).replace('.', ',')}`
                            : `R$ ${product.price.toFixed(2).replace('.', ',')}`}
                    </p>
                    <Button asChild>
                        <Link href={productLink}>Ver Detalhes</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Maps color names to Tailwind CSS background color classes for the swatches.
const colorNameToTailwind = (colorName: string): string => {
    const lowerColor = colorName.toLowerCase();
    if (lowerColor.includes('preto')) return 'bg-black';
    if (lowerColor.includes('branco')) return 'bg-white border border-gray-300';
    if (lowerColor.includes('cinza')) return 'bg-gray-500';
    if (lowerColor.includes('vermelho')) return 'bg-red-500';
    if (lowerColor.includes('verde sálvia')) return 'bg-[#8F9779]';
    if (lowerColor.includes('verde')) return 'bg-green-600';
    if (lowerColor.includes('azul marinho')) return 'bg-blue-900';
    if (lowerColor.includes('azul')) return 'bg-blue-500';
    if (lowerColor.includes('amarelo')) return 'bg-yellow-400';
    if (lowerColor.includes('rosa')) return 'bg-pink-400';
    if (lowerColor.includes('roxo')) return 'bg-purple-500';
    if (lowerColor.includes('laranja')) return 'bg-orange-500';
    if (lowerColor.includes('marrom') || lowerColor.includes('terracota')) return 'bg-amber-800';
    if (lowerColor.includes('cru')) return 'bg-stone-200';
    return 'bg-gray-300'; // Default fallback color
};

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
            setActiveColor(color);
        }
    };

    const colors = product.options.colors.filter(c => c !== 'Padrão');
    const hasColorVariants = colors.length > 1;
    const MAX_SWATCHES = 5;
    const visibleColors = colors.slice(0, MAX_SWATCHES);
    const remainingColorsCount = colors.length - MAX_SWATCHES;

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
                {hasColorVariants && (
                    <TooltipProvider delayDuration={100}>
                    <div className="flex items-center gap-2 mb-3">
                        {visibleColors.map(color => {
                            // Ensure there is a variant for this color before rendering a swatch
                            const variant = product.variants.find(v => v.color === color);
                            if (!variant?.imageUrl) return null;

                            return (
                                <Tooltip key={color}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => handleColorChange(color)}
                                            className={cn(
                                                "w-5 h-5 rounded-full border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all",
                                                activeColor === color ? 'ring-2 ring-primary ring-offset-1' : 'hover:ring-1 hover:ring-muted-foreground'
                                            )}
                                            aria-label={`Mudar para cor ${color}`}
                                        >
                                            <div className={cn("w-full h-full rounded-full", colorNameToTailwind(color))} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{color}</p>
                                    </TooltipContent>
                                </Tooltip>
                            );
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
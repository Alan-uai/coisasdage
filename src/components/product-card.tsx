
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
    const optionColors = color.split(' e ').map(c => c.trim().toLowerCase()).filter(Boolean);
    let allColorNames: string[] = [];
    if (primaryColor && !optionColors.includes(primaryColor.toLowerCase())) {
        allColorNames.push(primaryColor.toLowerCase());
    }
    allColorNames.push(...optionColors);
    const finalHexParts = [...new Set(allColorNames)].map(getHex).filter((c): c is string => !!c).slice(0, 3);
    if (finalHexParts.length === 0) return <div className="w-full h-full rounded-full bg-gray-200" />;
    let style: React.CSSProperties;
    switch (finalHexParts.length) {
        case 3: style = { background: `linear-gradient(135deg, ${finalHexParts[0]} 33%, ${finalHexParts[1]} 33%, ${finalHexParts[1]} 66%, ${finalHexParts[2]} 66%)` }; break;
        case 2: style = { background: `linear-gradient(135deg, ${finalHexParts[0]} 50%, ${finalHexParts[1]} 50%)` }; break;
        default: style = { backgroundColor: finalHexParts[0] }; break;
    }
    const hasLightColor = allColorNames.some(c => c.includes('branco') || c.includes('cru'));
    return <div className={cn("w-full h-full rounded-full", hasLightColor && "border border-gray-300")} style={style} />;
}

export const ProductCard = ({ product, isReadyMadeCarousel = false }: { product: Product, isReadyMadeCarousel?: boolean }) => {
    const mainVariant = product.variants.find(v => v.id === product.id);
    const initialActiveColor = mainVariant?.color;
    const [activeImageUrl, setActiveImageUrl] = useState(product.imageUrl);
    const [activeColor, setActiveColor] = useState<string | undefined>(initialActiveColor);
    const [activePrice, setActivePrice] = useState(product.price);
    const [activeSizeIndex, setActiveSizeIndex] = useState(-1);

    const handleColorChange = (color: string) => {
        const variant = product.variants.find(v => v.color === color) || product;
        setActiveImageUrl(variant.imageUrl);
        setActivePrice(variant.price || product.price);
        setActiveColor(color);
        setActiveSizeIndex(-1);
    };

    const cycleableSizes = useMemo(() => {
        const sizes = product.options.sizes.filter(s => s.toLowerCase() !== 'padrão');
        return sizes;
    }, [product.options.sizes]);

    const handleSizeCycle = () => {
        if (cycleableSizes.length === 0) return;
        const nextSizeIndex = activeSizeIndex + 1;
        if (nextSizeIndex >= cycleableSizes.length) {
            setActiveSizeIndex(-1);
            setActiveImageUrl(product.imageUrl);
            setActivePrice(product.price);
            setActiveColor(initialActiveColor);
        } else {
            setActiveSizeIndex(nextSizeIndex);
            const size = cycleableSizes[nextSizeIndex];
            const variant = product.variants.find(v => v.size === size);
            if (variant) {
                setActiveImageUrl(variant.imageUrl);
                setActivePrice(variant.price || product.price);
                setActiveColor(variant.color || initialActiveColor);
            }
        }
    };

    const colors = product.options.colors.filter(c => c !== 'Padrão');
    const sortedColors = [...colors];
    const visibleColors = sortedColors.slice(0, 5);
    const remainingColorsCount = sortedColors.length - 5;
    const productUrl = `/products/${product.groupId}`;
    const productLink = activeColor ? `${productUrl}?color=${encodeURIComponent(activeColor)}` : productUrl;

    let priceText = `R$ ${activePrice.toFixed(2).replace('.', ',')}`;
    if (!isReadyMadeCarousel && product.minPrice !== product.maxPrice && activeSizeIndex === -1) {
        priceText = `R$ ${product.minPrice.toFixed(2).replace('.', ',')} - R$ ${product.maxPrice.toFixed(2).replace('.', ',')}`;
    }

    return (
        <Card className="overflow-hidden flex flex-col group h-full relative">
            {!product.readyMade && (
                <div className="absolute top-2 right-2 z-10">
                    <Badge variant="secondary" className="bg-primary text-primary-foreground shadow-sm">
                        Sob Demanda
                    </Badge>
                </div>
            )}
            <CardHeader className="p-0">
                <Link href={productLink} className="block overflow-hidden">
                    <Image
                        src={activeImageUrl}
                        alt={product.name}
                        width={600}
                        height={400}
                        className="object-cover w-full aspect-[3/2] group-hover:scale-105 transition-transform duration-300"
                        key={activeImageUrl}
                    />
                </Link>
            </CardHeader>
            <CardContent className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-center mb-3 min-h-[20px]">
                    {isReadyMadeCarousel ? (
                         <div className="flex w-full justify-between items-center gap-2">
                            {product.color && product.color !== 'Padrão' ? (
                                <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="w-5 h-5 rounded-full cursor-default">
                                                {renderColorSwatch(product.color, product.primaryColor)}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{product.primaryColor && product.primaryColor.toLowerCase() !== product.color.toLowerCase() ? `${product.primaryColor} e ${product.color}` : product.color}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : <div />}
                            {product.size && product.size !== 'Padrão' && (
                                <span className="text-xs text-muted-foreground font-semibold">{product.size}</span>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                {visibleColors.map(color => {
                                    const isAvailable = !product.availability?.colors || product.availability.colors.includes(color);
                                    return (
                                        <TooltipProvider key={color} delayDuration={100}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={() => isAvailable && handleColorChange(color)}
                                                        disabled={!isAvailable}
                                                        className={cn(
                                                            "w-5 h-5 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all",
                                                            activeColor === color ? 'ring-2 ring-primary ring-offset-1' : 'hover:ring-1 hover:ring-muted-foreground',
                                                            !isAvailable && "opacity-30 grayscale cursor-not-allowed border border-dashed border-muted-foreground/50"
                                                        )}
                                                    >
                                                        {renderColorSwatch(color, product.primaryColor)}
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{product.primaryColor && product.primaryColor.toLowerCase() !== color.toLowerCase() ? `${product.primaryColor} e ${color}` : color} {!isAvailable && '(Indisponível)'}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                                {remainingColorsCount > 0 && (
                                    <Link href={productUrl} className="text-xs font-bold text-muted-foreground">+{remainingColorsCount}</Link>
                                )}
                            </div>
                            {product.sizeRangeText && (
                                <button onClick={handleSizeCycle} className="text-xs text-muted-foreground font-semibold">
                                    {activeSizeIndex > -1 ? cycleableSizes[activeSizeIndex] : product.sizeRangeText}
                                </button>
                            )}
                        </>
                    )}
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold font-headline">{product.name}</h2>
                    <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                </div>
                <div className="flex justify-between items-center mt-4">
                    <p className="text-lg font-semibold">{priceText}</p>
                    <Button asChild>
                        <Link href={productLink}>Ver Detalhes</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

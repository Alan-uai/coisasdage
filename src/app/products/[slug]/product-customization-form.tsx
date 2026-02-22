
'use client';

import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Product, ProductVariant } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Loader2, Info, ArrowRight, Sparkles, ShoppingCart, Archive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, serverTimestamp, query, where, getDocs, writeBatch } from 'firebase/firestore';
import Link from 'next/link';

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
    let style: CSSProperties;
    switch (finalHexParts.length) {
        case 3: style = { background: `linear-gradient(135deg, ${finalHexParts[0]} 33%, ${finalHexParts[1]} 33%, ${finalHexParts[1]} 66%, ${finalHexParts[2]} 66%)` }; break;
        case 2: style = { background: `linear-gradient(135deg, ${finalHexParts[0]} 50%, ${finalHexParts[1]} 50%)` }; break;
        default: style = { backgroundColor: finalHexParts[0] }; break;
    }
    const hasLightColor = allColorNames.some(c => c.includes('branco') || c.includes('cru'));
    return <div className={cn("w-full h-full rounded-full", hasLightColor && "border border-gray-300")} style={style} />;
};

const getFirstAvailable = (allOptions: string[], availableOptions?: string[]): string => {
  if (availableOptions && availableOptions.length > 0) {
    for (const option of allOptions) {
      if (availableOptions.includes(option)) return option;
    }
  }
  return allOptions[0];
};

export function ProductClientPage({ product }: { product: Product }) {
  const searchParams = useSearchParams();
  const colorFromUrl = searchParams.get('color');
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const inventoryCollectionRef = useMemoFirebase(() =>
    firestore ? collection(firestore, 'product_inventory') : null
  , [firestore]);
  const { data: inventoryItems, isLoading: isInventoryLoading } = useCollection<{quantity: number}>(inventoryCollectionRef);

  const inventoryMap = useMemo(() => {
    if (!inventoryItems) return new Map<string, number>();
    return new Map(inventoryItems.map(item => [item.id, item.quantity]));
  }, [inventoryItems]);

  const [selectedImageUrl, setSelectedImageUrl] = useState(product.imageUrl);
  const [currentPrice, setCurrentPrice] = useState(product.price);
  const [isAdding, setIsAdding] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  
  const displayableSizes = useMemo(() => product.options.sizes.filter(s => s.toLowerCase() !== 'padrão'), [product.options.sizes]);

  const [selectedSize, setSelectedSize] = useState<string>(() => 
    getFirstAvailable(product.options.sizes, product.availability?.sizes)
  );
  
  const availableColorsForCurrentSize = useMemo(() => {
    const sizeToMatch = selectedSize === 'Padrão' ? (product.size || 'Padrão') : selectedSize;
    const variantsForSize = product.variants.filter(v => (v.size || product.size || 'Padrão') === sizeToMatch);
    const specificColorsForSize = [...new Set(variantsForSize.map(v => v.color).filter((c): c is string => !!c))];
    const candidateColors = specificColorsForSize.length > 0 ? specificColorsForSize : product.options.colors;
    const globallyAvailableColors = product.availability?.colors || product.options.colors;
    return candidateColors.filter(c => globallyAvailableColors.includes(c));
  }, [selectedSize, product]);

  const displayableColors = useMemo(() => product.options.colors.filter(c => c.toLowerCase() !== 'padrão'), [product.options.colors]);
  
  const [selectedColor, setSelectedColor] = useState<string>(() => {
    if (colorFromUrl && availableColorsForCurrentSize.includes(colorFromUrl)) return colorFromUrl;
    return getFirstAvailable(product.options.colors, availableColorsForCurrentSize);
  });

  const availableMaterialsForCurrentSelection = useMemo(() => {
    const sizeToMatch = selectedSize === 'Padrão' ? (product.size || 'Padrão') : selectedSize;
    const variantsForSize = product.variants.filter(v => (v.size || product.size || 'Padrão') === sizeToMatch);
    const variantsForSizeAndColor = variantsForSize.filter(v => v.color === selectedColor || !v.color);
    const specificMaterials = [...new Set(variantsForSizeAndColor.map(v => v.material).filter((m): m is string => !!m))];
    const candidateMaterials = specificMaterials.length > 0 ? specificMaterials : product.options.materials;
    const globallyAvailableMaterials = product.availability?.materials || product.options.materials;
    return candidateMaterials.filter(m => globallyAvailableMaterials.includes(m));
  }, [selectedSize, selectedColor, product]);

  const [selectedMaterial, setSelectedMaterial] = useState<string>(() => 
    getFirstAvailable(product.options.materials, availableMaterialsForCurrentSelection)
  );

  useEffect(() => {
    const sizeToMatch = selectedSize === 'Padrão' ? (product.size || 'Padrão') : selectedSize;
    const variant = product.variants.find(v => 
      (v.size || product.size || 'Padrão') === sizeToMatch &&
      (v.color === selectedColor || !v.color) &&
      (v.material === selectedMaterial || !v.material)
    );
    if (variant) {
      setSelectedImageUrl(variant.imageUrl);
      setCurrentPrice(variant.price ?? product.price);
    } else {
      setSelectedImageUrl(product.imageUrl);
      setCurrentPrice(product.price);
    }
  }, [selectedColor, selectedSize, selectedMaterial, product]);

  const currentVariant = useMemo(() => {
    const sizeToMatch = selectedSize === 'Padrão' ? (product.size || 'Padrão') : selectedSize;
    return product.variants.find(v => 
      (v.size || product.size || 'Padrão') === sizeToMatch &&
      (v.color === selectedColor || !v.color) &&
      (v.material === selectedMaterial || !v.material)
    );
  }, [selectedSize, selectedColor, selectedMaterial, product]);

  const stockQuantity = useMemo(() => {
    const variantId = currentVariant?.id || product.id;
    return inventoryMap.get(variantId) ?? 0;
  }, [currentVariant, product.id, inventoryMap]);

  const isReady = stockQuantity > 0;

  const handleAddToCart = async () => {
    if (!user || !firestore) {
      toast({ variant: "destructive", title: "Login Necessário", description: "Faça login para adicionar ao carrinho." });
      router.push('/login');
      return;
    }

    setIsAdding(true);
    const cartItemsRef = collection(firestore, 'users', user.uid, 'carts', 'main', 'items');
    
    const cartItemData = {
      cartId: 'main',
      productId: currentVariant?.id || product.id,
      productGroupId: product.groupId,
      productName: product.name,
      imageUrl: selectedImageUrl,
      quantity: 1,
      selectedSize,
      selectedColor,
      selectedMaterial,
      unitPriceAtAddition: currentPrice,
      readyMade: isReady,
      selected: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    addDocumentNonBlocking(cartItemsRef, cartItemData);
    setIsAdding(false);

    toast({
        title: "No Carrinho!",
        description: `${product.name} foi adicionado.`,
        action: <Button variant="outline" size="sm" asChild><Link href="/cart">Ver Carrinho</Link></Button>
    });
  };

  const handleBuyNow = async () => {
    if (!user || !firestore) {
      toast({ variant: "destructive", title: "Login Necessário", description: "Faça login para prosseguir." });
      router.push('/login');
      return;
    }

    setIsBuyingNow(true);
    try {
        const cartItemsRef = collection(firestore, 'users', user.uid, 'carts', 'main', 'items');
        const batch = writeBatch(firestore);

        const q = query(cartItemsRef, where('selected', '==', true));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          batch.update(doc.ref, { selected: false });
        });

        const newCartItemRef = doc(cartItemsRef);
        const cartItemData = {
            cartId: 'main',
            productId: currentVariant?.id || product.id,
            productGroupId: product.groupId,
            productName: product.name,
            imageUrl: selectedImageUrl,
            quantity: 1,
            selectedSize,
            selectedColor,
            selectedMaterial,
            unitPriceAtAddition: currentPrice,
            readyMade: isReady,
            selected: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        batch.set(newCartItemRef, cartItemData);

        await batch.commit();

        const checkoutType = isReady ? 'ready' : 'custom';
        router.push(`/checkout?type=${checkoutType}`);

    } catch (error) {
        console.error("Error during 'Buy Now':", error);
        toast({
          variant: "destructive",
          title: "Algo deu errado",
          description: "Não foi possível iniciar a compra. Tente novamente.",
        });
        setIsBuyingNow(false);
    }
  };
  
  const isLoading = isAdding || isBuyingNow;

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8">
      <main className="max-w-6xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
          <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/5] bg-muted">
            <Image
              src={selectedImageUrl}
              alt={product.name}
              fill
              className="object-cover transition-all duration-500 hover:scale-105"
              priority
            />
            {!isReady && (
              <div className="absolute top-6 right-6">
                <Badge className="bg-primary/90 backdrop-blur px-4 py-1 text-sm font-bold shadow-lg">
                  Sob Demanda
                </Badge>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center space-y-8">
            <div>
              <div className="flex justify-between items-center">
                 <p className="text-primary font-bold tracking-widest uppercase text-xs mb-2">{product.category}</p>
                 {!isInventoryLoading && isReady && (
                    <Badge variant="secondary">
                      {`Apenas ${stockQuantity} em estoque!`}
                    </Badge>
                  )}
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold font-headline leading-tight">{product.name}</h1>
              <div className="flex items-baseline gap-4 mt-4">
                <span className="text-3xl font-bold text-primary">R$ {currentPrice.toFixed(2).replace('.', ',')}</span>
                <span className="text-sm text-muted-foreground italic">Feito à mão com amor</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-6">
              {displayableSizes.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Escolha o Tamanho</Label>
                  <RadioGroup value={selectedSize} onValueChange={setSelectedSize} className="flex flex-wrap gap-2">
                    {displayableSizes.map((size) => (
                      <div key={size}>
                        <RadioGroupItem value={size} id={`size-${size}`} className="peer sr-only" />
                        <Label 
                          htmlFor={`size-${size}`}
                          className="px-4 py-2 border rounded-md cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary hover:bg-muted transition-all"
                        >
                          {size}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {displayableColors.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Escolha a Cor</Label>
                  <div className="flex flex-wrap gap-3">
                    {displayableColors.map((color) => {
                      const isAvailable = availableColorsForCurrentSize.includes(color);
                      return (
                        <button
                          key={color}
                          onClick={() => isAvailable && setSelectedColor(color)}
                          disabled={!isAvailable}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 border rounded-full text-sm transition-all",
                            selectedColor === color
                              ? "bg-primary text-primary-foreground border-primary"
                              : isAvailable ? "hover:bg-muted" : "",
                            !isAvailable && "opacity-40 cursor-not-allowed line-through"
                          )}
                        >
                          <div className="size-5 rounded-full shrink-0">
                            {renderColorSwatch(color, product.primaryColor)}
                          </div>
                          <span>{color}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <p className="text-muted-foreground leading-relaxed text-sm">
              {product.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <Button 
                onClick={handleBuyNow} 
                size="lg" 
                className="h-14 text-lg font-bold shadow-lg shadow-primary/20"
                disabled={isLoading}
              >
                {isBuyingNow ? <Loader2 className="animate-spin mr-2" /> : <ShoppingBag className="mr-2 size-5" />}
                Comprar Agora
              </Button>
              <Button 
                onClick={handleAddToCart}
                variant="outline" 
                size="lg" 
                className="h-14 border-2 font-bold"
                disabled={isLoading}
              >
                {isAdding ? <Loader2 className="animate-spin mr-2" /> : <ShoppingCart className="mr-2 size-5" />}
                Adicionar ao Carrinho
              </Button>
            </div>

            {!isReady && (
              <div className="bg-primary/5 p-4 rounded-xl flex gap-3 border border-primary/10">
                <Info className="size-5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Este produto é produzido sob encomenda. O prazo de confecção pode variar de acordo com a complexidade.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

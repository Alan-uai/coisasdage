'use server';

import { v2 as cloudinary } from 'cloudinary';
import type { Product, ProductVariant } from '@/lib/types';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dme6as4bi',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// A cache to avoid fetching multiple times in the same request
let productsCache: Product[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 60 * 1000; // 1 minute

// Cache for the logo
let logoUrlCache: string | null = null;
let logoCacheTimestamp: number | null = null;

// An internal type for processing
type RawProduct = Omit<Product, 'variants' | 'options' | 'minPrice' | 'maxPrice' | 'availability' | 'sizeRangeText'> & {
  color?: string; // Singular color for this specific variant
  size?: string;
  material?: string;
  // Raw options from Cloudinary
  rawOptions: {
    sizes?: string;
    colors?: string;
    materials?: string;
    availableSizes?: string;
    availableColors?: string;
    availableMaterials?: string;
  }
};


export async function getLogoUrl(): Promise<string | null> {
  const now = Date.now();
  if (logoUrlCache && logoCacheTimestamp && (now - logoCacheTimestamp < CACHE_DURATION)) {
    return logoUrlCache;
  }
  
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('Cloudinary API key/secret not configured. Cannot fetch logo.');
    return null; 
  }

  try {
    const { resources } = await cloudinary.api.resources({
      type: 'upload',
      max_results: 500, // Search all resources
      context: true,
    });
    
    // Find a resource with metadata category: 'Logotipo' and active: 'true'
    const activeLogo = resources.find((resource: any) => 
      resource.context?.custom?.category === 'Logotipo' && resource.context?.custom?.active === 'true'
    );

    if (activeLogo) {
      logoUrlCache = activeLogo.secure_url;
      logoCacheTimestamp = now;
      return activeLogo.secure_url;
    }

    console.warn('No active logo found. Make sure an image has metadata "category" set to "Logotipo" and "active" set to "true".');
    return null;

  } catch (error) {
    console.error('Error fetching logo from Cloudinary:', error);
    return null;
  }
}

export async function getProducts(): Promise<Product[]> {
  const now = Date.now();
  if (productsCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    return productsCache;
  }

  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('Cloudinary API key/secret not configured. Returning empty product list.');
    return [];
  }

  try {
    const { resources } = await cloudinary.api.resources({
      type: 'upload',
      max_results: 500,
      context: true,
    });
    
    const rawProducts: RawProduct[] = resources.map((resource: any): RawProduct | null => {
      const context = resource.context?.custom;
      if (!context) return null;

      const { 
        id, 
        groupId,
        isMain,
        name, 
        price, 
        description,
        category,
        readyMade, 
        sizes, 
        colors, 
        materials,
        availableSizes,
        availableColors,
        availableMaterials,
        primaryColor,
        color,
        size,
        material,
        imageHint,
      } = context as Record<string, string>;

      if (category === 'Logotipo') {
        return null;
      }
      
      if (!id || !groupId) {
          return null;
      }

      return {
        id,
        groupId,
        isMain: isMain === 'true',
        name: name || '',
        description: description || '',
        price: parseFloat(price) || 0,
        imageUrl: resource.secure_url,
        imageHint: imageHint || 'handmade product',
        category: category || 'Sem Categoria',
        readyMade: readyMade === 'true',
        primaryColor,
        rawOptions: {
            sizes,
            colors,
            materials,
            availableSizes,
            availableColors,
            availableMaterials,
        },
        color,
        size,
        material,
      };
    }).filter((p): p is RawProduct => p !== null && !!p.name && p.price > 0);

    const groupedByGroupId = rawProducts.reduce((acc, product) => {
        if (!acc[product.groupId]) {
            acc[product.groupId] = [];
        }
        acc[product.groupId].push(product);
        return acc;
    }, {} as Record<string, RawProduct[]>);
    
    const consolidatedProducts: Product[] = [];

    Object.values(groupedByGroupId).forEach(group => {
        const mainProductForGroup = group.find(p => p.isMain) || group[0];

        // LOGIC 1: If the main product of the group is NOT ready-made,
        // then we create the full, customizable product entry.
        if (!mainProductForGroup.readyMade) {
            const variants: ProductVariant[] = group.map(p => ({
                id: p.id,
                color: p.color,
                size: p.size,
                material: p.material,
                imageUrl: p.imageUrl,
                price: p.price,
            }));
            
            const allPrices = group.map(p => p.price).filter(p => p !== undefined && p > 0);
            const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : mainProductForGroup.price;
            const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : mainProductForGroup.price;
            
            const mainOptions = {
                sizes: mainProductForGroup.rawOptions.sizes ? mainProductForGroup.rawOptions.sizes.split(',').map(s => s.trim()) : [],
                colors: mainProductForGroup.rawOptions.colors ? mainProductForGroup.rawOptions.colors.split(',').map(c => c.trim()) : [],
                materials: mainProductForGroup.rawOptions.materials ? mainProductForGroup.rawOptions.materials.split(',').map(m => m.trim()) : [],
            };
            
            let sizeRangeText: string | undefined = undefined;
            if (mainOptions.sizes.length > 1) {
                const sizeNumbers = mainOptions.sizes.map(s => {
                    if (s.toLowerCase() === 'padrão') {
                        // Use the main product's specific size if it's 'padrão'
                        return parseInt(mainProductForGroup.size || '', 10);
                    }
                    return parseInt(s, 10);
                }).filter(n => !isNaN(n));

                if (sizeNumbers.length > 1) {
                    const minSize = Math.min(...sizeNumbers);
                    const maxSize = Math.max(...sizeNumbers);
                    if (minSize !== maxSize) {
                        sizeRangeText = `${minSize}-${maxSize} peças`;
                    }
                }
            }

            const availability: Product['availability'] = {};
            if (mainProductForGroup.rawOptions.availableColors) {
                availability.colors = mainProductForGroup.rawOptions.availableColors.split(',').map(s => s.trim());
            }
             if (mainProductForGroup.rawOptions.availableSizes) {
                availability.sizes = mainProductForGroup.rawOptions.availableSizes.split(',').map(s => s.trim());
            }
             if (mainProductForGroup.rawOptions.availableMaterials) {
                availability.materials = mainProductForGroup.rawOptions.availableMaterials.split(',').map(s => s.trim());
            }

            const customizableProduct: Product = {
                ...mainProductForGroup,
                minPrice,
                maxPrice,
                options: mainOptions,
                availability: Object.keys(availability).length > 0 ? availability : undefined,
                variants: variants,
                sizeRangeText,
            };

            if (customizableProduct.options.sizes.length === 0) customizableProduct.options.sizes = ['Padrão'];
            if (customizableProduct.options.colors.length === 0) customizableProduct.options.colors = ['Padrão'];
            if (customizableProduct.options.materials.length === 0) customizableProduct.options.materials = ['Barbante de Algodão'];

            consolidatedProducts.push(customizableProduct);
        }

        // LOGIC 2: Go through the group AGAIN and create standalone entries
        // for ANY product (main or variant) marked as readyMade.
        group.forEach(p => {
            if (p.readyMade) {
                // This is a ready-made item, create a simple, standalone product for it.
                const readyMadeProduct: Product = {
                    ...p,
                    price: p.price,
                    minPrice: p.price,
                    maxPrice: p.price,
                    // Not customizable, so options are empty/default
                    options: { 
                        sizes: p.size ? [p.size] : ['Padrão'], 
                        colors: p.color ? [p.color] : ['Padrão'],
                        materials: p.material ? [p.material] : ['Barbante de Algodão'],
                    },
                    // It has no other variants in this context
                    variants: [{
                      id: p.id,
                      imageUrl: p.imageUrl,
                      price: p.price,
                      color: p.color,
                      size: p.size,
                      material: p.material,
                    }],
                };
                consolidatedProducts.push(readyMadeProduct);
            }
        });
    });

    productsCache = consolidatedProducts;
    cacheTimestamp = now;
    return consolidatedProducts;

  } catch (error) {
    console.error('Error fetching products from Cloudinary:', error);
    return [];
  }
}

export async function getProductByGroupId(groupId: string): Promise<Product | null> {
    const products = await getProducts();
    return products.find(p => p.groupId === groupId) || null;
}

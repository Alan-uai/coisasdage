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
type RawProduct = Omit<Product, 'variants' | 'options'> & {
  color?: string; // Singular color for this specific variant
  size?: string;
  material?: string;
  // Raw options from Cloudinary
  rawOptions: {
    sizes?: string;
    colors?: string;
    materials?: string;
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
        rawOptions: {
            sizes,
            colors,
            materials,
        },
        color,
        size,
        material,
      };
    }).filter((p): p is RawProduct => p !== null);

    const groupedByGroupId = rawProducts.reduce((acc, product) => {
        if (!acc[product.groupId]) {
            acc[product.groupId] = [];
        }
        acc[product.groupId].push(product);
        return acc;
    }, {} as Record<string, RawProduct[]>);
    
    const consolidatedProducts: Product[] = Object.values(groupedByGroupId).map(group => {
        let mainProduct = group.find(p => p.isMain);
        if (!mainProduct) {
             mainProduct = group.find(p => p.name && p.price) || group[0];
        }

        const variants: ProductVariant[] = group.map(p => ({
            id: p.id,
            color: p.color,
            size: p.size,
            material: p.material,
            imageUrl: p.imageUrl,
        }));
        
        const mainOptions = {
            sizes: mainProduct.rawOptions.sizes ? mainProduct.rawOptions.sizes.split(',').map(s => s.trim()) : [],
            colors: mainProduct.rawOptions.colors ? mainProduct.rawOptions.colors.split(',').map(c => c.trim()) : [],
            materials: mainProduct.rawOptions.materials ? mainProduct.rawOptions.materials.split(',').map(m => m.trim()) : [],
        };

        const finalProduct: Product = {
            ...mainProduct,
            id: mainProduct.id,
            name: mainProduct.name,
            price: mainProduct.price,
            description: mainProduct.description,
            imageUrl: mainProduct.imageUrl,
            options: mainOptions,
            variants: variants,
        };

        if (finalProduct.options.sizes.length === 0) finalProduct.options.sizes = ['Padrão'];
        if (finalProduct.options.colors.length === 0) finalProduct.options.colors = ['Padrão'];
        if (finalProduct.options.materials.length === 0) finalProduct.options.materials = ['Barbante de Algodão'];

        return finalProduct;
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

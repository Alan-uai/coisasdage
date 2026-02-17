'use server';

import { v2 as cloudinary } from 'cloudinary';
import type { Product } from '@/lib/types';

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
    
    const products: Product[] = resources.map((resource: any): Product | null => {
      const context = resource.context?.custom;
      if (!context) return null;
      
      const { 
        id, 
        name, 
        price, 
        description, 
        readyMade, 
        sizes, 
        colors, 
        materials, 
        imageHint,
        category // Read category from metadata
      } = context as Record<string, string>;

      // Exclude logos and items without a category
      if (!category || category === 'Logotipo') {
        return null;
      }
      
      // Essential fields: id, name, and price from context.
      if (!id || !name || !price) {
          return null;
      }

      return {
        id,
        name,
        description: description || '',
        price: parseFloat(price) || 0,
        imageUrl: resource.secure_url,
        imageHint: imageHint || 'handmade product',
        category, // Use category from metadata
        readyMade: readyMade === 'true',
        options: {
          sizes: sizes ? sizes.split(',').map(s => s.trim()) : ['Padrão'],
          colors: colors ? colors.split(',').map(c => c.trim()) : ['Padrão'],
          materials: materials ? materials.split(',').map(m => m.trim()) : ['Barbante de Algodão'],
        },
      };
    }).filter((p): p is Product => p !== null);
    
    productsCache = products;
    cacheTimestamp = now;
    return products;

  } catch (error) {
    console.error('Error fetching products from Cloudinary:', error);
    return [];
  }
}

export async function getProductById(id: string): Promise<Product | null> {
    // This function will rely on the cached getProducts() result for performance
    const products = await getProducts();
    return products.find(p => p.id === id) || null;
}

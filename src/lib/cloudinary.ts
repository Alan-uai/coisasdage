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
      prefix: 'Home/', // Fetch all products under Home
      max_results: 500, // Increased limit
      context: true,
    });

    const products: Product[] = resources.map((resource: any): Product | null => {
      if (!resource.context) return null;

      const { 
        id, 
        name, 
        price, 
        description, 
        category, 
        readyMade, 
        sizes, 
        colors, 
        materials, 
        imageHint 
      } = resource.context as Record<string, string>;

      // Essential fields
      if (!id || !name || !price || !category) {
          console.warn('Skipping resource due to missing essential context:', resource.public_id, resource.context);
          return null;
      }

      return {
        id,
        name,
        description: description || '',
        price: parseFloat(price) || 0,
        imageUrl: resource.secure_url,
        imageHint: imageHint || 'handmade product',
        category,
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

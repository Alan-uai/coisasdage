export type ProductVariant = {
  id: string;
  color?: string;
  size?: string;
  material?: string;
  imageUrl: string;
  price?: number;
};

export type Product = {
  id: string; // The ID of the main product
  groupId: string;
  isMain?: boolean;
  name: string;
  description: string;
  price: number;
  minPrice: number;
  maxPrice: number;
  imageUrl: string; // The default/main image URL
  imageHint: string;
  category: string;
  readyMade?: boolean;
  primaryColor?: string;
  sizeRangeText?: string;
  options: { // All possible options for the group
    sizes: string[];
    colors: string[];
    materials: string[];
  };
  availability?: { // Which options are currently available
    sizes: string[];
    colors: string[];
    materials: string[];
  };
  variants: ProductVariant[]; // All variants in the group
};

export type Order = {
  id: string;
  productName: string;
  productId: string;
  date: string;
  status: 'Processing' | 'Crafting' | 'Shipped' | 'Delivered';
  trackingNumber?: string;
  estimatedDelivery: string;
};

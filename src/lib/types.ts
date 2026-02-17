export type ProductVariant = {
  id: string;
  color?: string;
  size?: string;
  material?: string;
  imageUrl: string;
};

export type Product = {
  id: string; // The ID of the main product
  groupId: string;
  isMain?: boolean;
  name: string;
  description: string;
  price: number;
  imageUrl: string; // The default/main image URL
  imageHint: string;
  category: string;
  readyMade?: boolean;
  options: { // All available options for the group
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

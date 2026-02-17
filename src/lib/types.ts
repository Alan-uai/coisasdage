import type { Timestamp } from 'firebase/firestore';

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
  size?: string; // The specific size of the main product variant
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

export type OrderItemSummary = {
  productId: string;
  productName: string;
  imageUrl: string;
  quantity: number;
  unitPriceAtOrder: number;
  selectedSize: string;
  selectedColor: string;
  selectedMaterial: string;
};

export type Order = {
  id: string;
  userId: string;
  orderDate: Timestamp;
  totalAmount: number;
  status: 'Processing' | 'Crafting' | 'Shipped' | 'Delivered';
  items: OrderItemSummary[];
  shippingAddressId: string;
  billingAddressId: string;
  trackingNumber?: string;
  estimatedDeliveryDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

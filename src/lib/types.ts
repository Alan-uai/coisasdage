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

export type Address = {
    cpf: string;
    streetName: string;
    streetNumber: string;
    zipCode: string;
    city: string;
    state: string;
};

export type Order = {
  id: string;
  userId: string;
  orderDate: Timestamp;
  totalAmount: number;
  status: 'Processing' | 'Crafting' | 'Shipped' | 'Delivered';
  items: OrderItemSummary[];
  shippingAddress: Address;
  billingAddressId?: string; // Optional for now
  trackingNumber?: string;
  estimatedDeliveryDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type CartItem = {
  id: string; // The firestore document ID
  cartId: string;
  productId: string;
  productGroupId: string;
  productName: string;
  imageUrl: string;
  quantity: number;
  selectedSize: string;
  selectedColor: string;
  selectedMaterial: string;
  unitPriceAtAddition: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

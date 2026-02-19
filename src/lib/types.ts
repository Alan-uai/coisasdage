
import type { Timestamp } from 'firebase/firestore';

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  createdAt: Timestamp;
  isAdmin?: boolean;
};

export type ProductVariant = {
  id: string;
  color?: string;
  size?: string;
  material?: string;
  imageUrl: string;
  price?: number;
};

export type Product = {
  id: string;
  groupId: string;
  isMain?: boolean;
  name: string;
  description: string;
  price: number;
  minPrice: number;
  maxPrice: number;
  imageUrl: string;
  imageHint: string;
  category: string;
  readyMade?: boolean;
  primaryColor?: string;
  size?: string;
  sizeRangeText?: string;
  options: {
    sizes: string[];
    colors: string[];
    materials: string[];
  };
  availability?: {
    sizes: string[];
    colors: string[];
    materials: string[];
  };
  variants: ProductVariant[];
};

export type CustomRequest = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  productGroupId: string;
  productName: string;
  imageUrl: string;
  selectedSize: string;
  selectedColor: string;
  selectedMaterial: string;
  basePrice: number;
  finalPrice: number;
  status: 'Pending' | 'Approved' | 'Contested' | 'AddedToCart';
  adminNotes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type OrderItemSummary = {
  productId: string;
  productGroupId: string;
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
  status: 'Processing' | 'Crafting' | 'Shipped' | 'Delivered' | 'Cancelled';
  items: OrderItemSummary[];
  shippingAddress: Address;
  billingAddressId?: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  paymentId?: string | number;
  merchantOrderId?: string;
};

export type CartItem = {
  id: string;
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
  selected?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

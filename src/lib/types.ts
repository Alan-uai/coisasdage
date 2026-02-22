
import type { Timestamp } from 'firebase/firestore';

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  createdAt: Timestamp;
  isAdmin?: boolean;
  termsAccepted?: boolean;
};

export type SavedAddress = {
  id: string;
  label: string; // Ex: "Casa", "Trabalho"
  cpf: string;
  streetName: string;
  streetNumber: string;
  zipCode: string;
  city: string;
  state: string;
  isDefault?: boolean;
  phone?: string;
};

export type ProductVariant = {
  id: string;
  color?: string;
  size?: string;
  material?: string;
  imageUrl: string;
  price?: number;
  readyMade?: boolean;
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
  readyMade?: boolean;
};

export type Address = {
    cpf: string;
    streetName: string;
    streetNumber: string;
    zipCode: string;
    city: string;
    state: string;
    phone?: string;
};

export type Order = {
  id: string;
  userId: string;
  userName: string;
  orderDate: Timestamp;
  totalAmount: number;
  status: 'Processing' | 'IN_PRODUCTION' | 'READY' | 'LABEL_GENERATED' | 'Shipped' | 'Delivered' | 'Cancelled';
  items: OrderItemSummary[];
  shippingAddress: Address;
  shippingMethod: 'mercado_envios' | 'local_delivery' | 'pickup';
  shippingCost: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  paymentId?: string | number;
  merchantOrderId?: string;
  preferenceId?: string;
  productionDays?: number;
  shippingAllowed?: boolean;
  shipmentId?: string;
  trackingNumber?: string;
  labelUrl?: string; // Embora não possamos gerar uma URL pública, mantemos o campo para consistência
  expiresAt?: Timestamp;
};

export type CustomRequest = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'Pending' | 'Approved' | 'Cancelled' | 'AddedToCart';
  totalBasePrice: number;
  finalPrice?: number;
  items: OrderItemSummary[];
  shippingAddress: Address;
  shippingMethod?: 'mercado_envios' | 'local_delivery' | 'pickup';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  productionDays?: number;
  adminNotes?: string;
};

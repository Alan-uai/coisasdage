export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  imageHint: string;
  category: string;
  readyMade?: boolean;
  options: {
    sizes: string[];
    colors: string[];
    materials: string[];
  };
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

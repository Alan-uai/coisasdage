import type { Order } from '@/lib/types';

// This file now only contains mock data for orders.
// Product data is fetched dynamically from Cloudinary.

export const orders: Order[] = [
  {
    id: 'AAB123',
    productId: 'jogo-banho-conchas',
    productName: 'Jogo de Banheiro Conchas (2 peças)',
    date: '2024-05-15',
    status: 'Crafting',
    estimatedDelivery: '2024-06-10',
  },
  {
    id: 'AAB124',
    productId: 'kit-tapetes-cozinha',
    productName: 'Kit Tapetes de Cozinha (2 peças)',
    date: '2024-05-20',
    status: 'Shipped',
    trackingNumber: '1Z9999W99999999999',
    estimatedDelivery: '2024-06-01',
  },
  {
    id: 'AAB125',
    productId: 'jogo-banheiro-oasis-3-pecas',
    productName: 'Jogo de Banheiro Oásis (3 peças)',
    date: '2024-05-28',
    status: 'Delivered',
    estimatedDelivery: '2024-05-30',
  },
    {
    id: 'AAB126',
    productId: 'jogo-passadeira-cozinha-3-pecas',
    productName: 'Jogo de Passadeira Cozinha (3 peças)',
    date: '2024-05-29',
    status: 'Processing',
    estimatedDelivery: '2024-06-20',
  },
];

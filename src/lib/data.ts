import type { Product, Order } from '@/lib/types';

export const products: Product[] = [
  // Jogo-Banho
  {
    id: 'jogo-banho-conchas',
    name: 'Jogo de Banheiro Conchas (2 peças)',
    description: 'Um lindo conjunto de 2 peças para banheiro em crochê, com tapete para o vaso e tapete de saída de banho. Padrão de conchas.',
    price: 120.00,
    imageUrl: 'https://res.cloudinary.com/artesa-aconchegante-demo/image/upload/v1/Home/Jogo-Banho/jogo-banho-conchas.jpg',
    imageHint: 'crochet bathroom set',
    category: 'Jogo-Banho',
    readyMade: true, // For "pronta entrega"
    options: {
      sizes: ['Padrão'],
      colors: ['Azul Claro', 'Areia', 'Branco'],
      materials: ['Barbante de Algodão'],
    },
  },
  {
    id: 'jogo-banho-flores',
    name: 'Jogo de Banheiro Flores (2 peças)',
    description: 'Decore seu banheiro com este conjunto de 2 peças em crochê com detalhes de flores.',
    price: 125.50,
    imageUrl: 'https://res.cloudinary.com/artesa-aconchegante-demo/image/upload/v1/Home/Jogo-Banho/jogo-banho-flores.jpg',
    imageHint: 'floral bathroom rug',
    category: 'Jogo-Banho',
    options: {
      sizes: ['Padrão'],
      colors: ['Rosa e Verde', 'Amarelo e Branco', 'Lilás e Creme'],
      materials: ['Barbante de Algodão'],
    },
  },

  // Jogo-Duplo
  {
    id: 'jogo-americano-folhas',
    name: 'Jogo Americano Folhas (2 peças)',
    description: 'Conjunto de 2 jogos americanos de crochê com um lindo padrão de folhas. Ideal para uma mesa posta elegante.',
    price: 110.00,
    imageUrl: 'https://res.cloudinary.com/artesa-aconchegante-demo/image/upload/v1/Home/Jogo-Duplo/jogo-americano-folhas.jpg',
    imageHint: 'crochet placemat',
    category: 'Jogo-Duplo',
    options: {
      sizes: ['Padrão (35cm)'],
      colors: ['Verde Musgo', 'Mostarda', 'Terracota'],
      materials: ['Fio de Algodão'],
    },
  },
    {
    id: 'kit-tapetes-cozinha',
    name: 'Kit Tapetes de Cozinha (2 peças)',
    description: 'Um par de tapetes de cozinha em crochê, uma passadeira e um tapete menor, para um ambiente mais acolhedor.',
    price: 180.00,
    imageUrl: 'https://res.cloudinary.com/artesa-aconchegante-demo/image/upload/v1/Home/Jogo-Duplo/kit-tapetes-cozinha.jpg',
    imageHint: 'crochet kitchen rugs',
    category: 'Jogo-Duplo',
    readyMade: true, // For "pronta entrega"
    options: {
      sizes: ['Passadeira (120x45cm) + Tapete (60x45cm)'],
      colors: ['Cinza', 'Preto', 'Vermelho'],
      materials: ['Barbante de Algodão'],
    },
  },

  // Jogo-Triplo
  {
    id: 'jogo-banheiro-oasis-3-pecas',
    name: 'Jogo de Banheiro Oásis (3 peças)',
    description: 'Um conjunto completo de 3 peças para banheiro em crochê: tapete do vaso, tampa e tapete de saída de banho.',
    price: 155.00,
    imageUrl: 'https://res.cloudinary.com/artesa-aconchegante-demo/image/upload/v1/Home/Jogo-Triplo/jogo-banheiro-oasis.jpg',
    imageHint: '3 piece bathroom set',
    category: 'Jogo-Triplo',
    options: {
      sizes: ['Padrão'],
      colors: ['Azul Petróleo', 'Cinza Chumbo', 'Bege'],
      materials: ['Barbante de Algodão'],
    },
  },
  {
    id: 'jogo-passadeira-cozinha-3-pecas',
    name: 'Jogo de Passadeira Cozinha (3 peças)',
    description: 'Jogo de cozinha com 1 passadeira e 2 tapetes menores, ideal para proteger e decorar o piso.',
    price: 210.00,
    imageUrl: 'https://res.cloudinary.com/artesa-aconchegante-demo/image/upload/v1/Home/Jogo-Triplo/jogo-passadeira-cozinha.jpg',
    imageHint: 'crochet kitchen runner',
    category: 'Jogo-Triplo',
    options: {
      sizes: ['Padrão'],
      colors: ['Marrom e Bege', 'Preto e Cinza', 'Vinho'],
      materials: ['Barbante de Algodão'],
    },
  },
];

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

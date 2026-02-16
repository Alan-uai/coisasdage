import type { Product, Order } from '@/lib/types';

export const products: Product[] = [
  {
    id: 'boho-bliss-rug',
    name: 'Tapete Boho Bliss',
    description: 'Um tapete de estilo boêmio tecido à mão com franjas macias, perfeito para adicionar um toque de aconchego a qualquer ambiente.',
    price: 189.90,
    imageUrl: 'https://picsum.photos/seed/rug1/600/400',
    imageHint: 'bohemian rug',
    category: 'Rugs',
    options: {
      sizes: ['Pequeno (90x150cm)', 'Médio (120x180cm)', 'Grande (150x240cm)'],
      colors: ['Natural', 'Verde Sálvia', 'Rosa Pálido'],
      materials: ['Algodão', 'Lã'],
    },
  },
  {
    id: 'modern-geometric-rug',
    name: 'Tapete Geométrico Moderno',
    description: 'Linhas limpas e um padrão geométrico arrojado definem este tapete moderno, ideal para espaços contemporâneos.',
    price: 220.50,
    imageUrl: 'https://picsum.photos/seed/rug2/600/400',
    imageHint: 'modern rug',
    category: 'Rugs',
    options: {
      sizes: ['Médio (120x180cm)', 'Grande (150x240cm)'],
      colors: ['Cinza e Branco', 'Preto e Creme', 'Azul Marinho'],
      materials: ['Polipropileno', 'Juta'],
    },
  },
  {
    id: 'octopus-amigurumi-kit',
    name: 'Kit Amigurumi de Polvo',
    description: 'Crie seu próprio amigo polvo fofinho! Este kit inclui todo o material necessário e um guia passo a passo.',
    price: 79.90,
    imageUrl: 'https://picsum.photos/seed/crochet1/600/400',
    imageHint: 'crochet octopus',
    category: 'Crochet Kits',
    options: {
      sizes: ['Padrão'],
      colors: ['Azul Oceano', 'Rosa Coral', 'Verde Menta'],
      materials: ['Fio de Algodão'],
    },
  },
  {
    id: 'chunky-blanket-kit',
    name: 'Kit de Manta Aconchegante',
    description: 'Um kit para iniciantes para criar uma manta de malha grossa super macia. Perfeito para noites frias.',
    price: 150.00,
    imageUrl: 'https://picsum.photos/seed/crochet2/600/400',
    imageHint: 'crochet blanket',
    category: 'Crochet Kits',
    options: {
      sizes: ['Pequena (100x150cm)', 'Grande (150x200cm)'],
      colors: ['Creme', 'Cinza Claro', 'Verde Sálvia'],
      materials: ['Fio de Chenille'],
    },
  },
  {
    id: 'sage-round-rug',
    name: 'Tapete Redondo Sálvia',
    description: 'Um tapete de pelúcia redondo em uma suave cor verde sálvia, adicionando conforto e um toque de cor.',
    price: 165.00,
    imageUrl: 'https://picsum.photos/seed/rug3/600/400',
    imageHint: 'green rug',
    category: 'Rugs',
    options: {
      sizes: ['Pequeno (120cm diâmetro)', 'Grande (150cm diâmetro)'],
      colors: ['Verde Sálvia', 'Bege', 'Rosa Pálido'],
      materials: ['Lã', 'Microfibra'],
    },
  },
  {
    id: 'winter-scarf-kit',
    name: 'Kit Cachecol de Inverno',
    description: 'Um kit fácil de seguir para tricotar um cachecol elegante e quente para o inverno.',
    price: 95.50,
    imageUrl: 'https://picsum.photos/seed/crochet3/600/400',
    imageHint: 'crochet scarf',
    category: 'Crochet Kits',
    options: {
      sizes: ['Padrão'],
      colors: ['Borgonha', 'Mostarda', 'Carvão'],
      materials: ['Lã Merino'],
    },
  }
];

export const orders: Order[] = [
  {
    id: 'AAB123',
    productId: 'boho-bliss-rug',
    productName: 'Tapete Boho Bliss',
    date: '2024-05-15',
    status: 'Crafting',
    estimatedDelivery: '2024-06-10',
  },
  {
    id: 'AAB124',
    productId: 'chunky-blanket-kit',
    productName: 'Kit de Manta Aconchegante',
    date: '2024-05-20',
    status: 'Shipped',
    trackingNumber: '1Z9999W99999999999',
    estimatedDelivery: '2024-06-01',
  },
  {
    id: 'AAB125',
    productId: 'octopus-amigurumi-kit',
    productName: 'Kit Amigurumi de Polvo',
    date: '2024-05-28',
    status: 'Delivered',
    estimatedDelivery: '2024-05-30',
  },
    {
    id: 'AAB126',
    productId: 'modern-geometric-rug',
    productName: 'Tapete Geométrico Moderno',
    date: '2024-05-29',
    status: 'Processing',
    estimatedDelivery: '2024-06-20',
  },
];

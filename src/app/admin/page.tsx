
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona para a página inicial, pois o fluxo de admin foi movido para o WhatsApp
    router.replace('/');
  }, [router]);

  return null;
}

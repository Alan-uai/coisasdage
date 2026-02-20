
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, updateDocumentNonBlocking } from '@/firebase';
import { collection, collectionGroup, query, orderBy, limit, doc, serverTimestamp } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, AlertTriangle, User, Mail, Calendar, ShieldAlert } from 'lucide-react';
import type { CustomRequest, UserProfile } from '@/lib/types';

export default function AdminRequestsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const profileRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

  // Usa collectionGroup para buscar todas as solicitações em todas as subcoleções 'custom_requests'
  const requestsQuery = useMemoFirebase(
    () => (user && firestore && profile?.isAdmin ? query(collectionGroup(firestore, 'custom_requests'), orderBy('createdAt', 'desc'), limit(50)) : null),
    [user, firestore, profile]
  );

  const { data: requests, isLoading: isRequestsLoading } = useCollection<CustomRequest>(requestsQuery);

  const handleStatusUpdate = (requestId: string, userId: string, status: 'Approved' | 'Contested') => {
    if (!firestore) return;
    const requestRef = doc(firestore, 'users', userId, 'custom_requests', requestId);
    updateDocumentNonBlocking(requestRef, { 
      status, 
      updatedAt: serverTimestamp() 
    });
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user || !profile?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <ShieldAlert className="size-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold font-headline">Acesso Negado</h1>
        <Button asChild className="mt-6"><Link href="/">Voltar ao Início</Link></Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight font-headline">Avaliar Solicitações</h1>
        <p className="text-muted-foreground mt-2">Revise os combos de produtos solicitados sob demanda de todos os clientes.</p>
      </header>

      <main className="grid grid-cols-1 gap-6">
        {(isRequestsLoading) ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (!requests || requests.length === 0) ? (
          <div className="text-center py-20 border-2 border-dashed rounded-lg">
            <AlertTriangle className="size-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhuma solicitação pendente.</p>
          </div>
        ) : (
          requests.map((request) => (
            <Card key={request.id} className="overflow-hidden border-primary/10">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full"><User className="size-5 text-primary" /></div>
                    <div>
                      <CardTitle className="text-lg">{request.userName}</CardTitle>
                      <CardDescription className="flex items-center gap-1"><Mail className="size-3" /> {request.userEmail}</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={
                      request.status === 'Approved' ? 'default' : 
                      request.status === 'Contested' ? 'destructive' : 'secondary'
                    }>
                      {request.status === 'Pending' ? 'Pendente' : 
                       request.status === 'Approved' ? 'Aprovado' : 
                       request.status === 'Contested' ? 'Contestado' : 'Adicionado'}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3" /> {request.createdAt?.toDate().toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {request.items && request.items.length > 0 ? (
                    request.items.map((item, idx) => (
                      <div key={idx} className="flex gap-4 items-center">
                        <div className="size-16 relative rounded overflow-hidden bg-muted">
                          <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">{item.selectedSize} | {item.selectedColor} | {item.selectedMaterial}</p>
                          <p className="text-sm">Qtd: {item.quantity}</p>
                        </div>
                        <p className="font-semibold">R$ {(item.unitPriceAtOrder * item.quantity).toFixed(2).replace('.', ',')}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm italic text-muted-foreground">Esta solicitação não possui itens detalhados.</div>
                  )}
                </div>
                <Separator className="my-6" />
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Total Estimado</p>
                    <p className="text-2xl font-bold text-primary">R$ {request.finalPrice.toFixed(2).replace('.', ',')}</p>
                  </div>
                  {request.status === 'Pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleStatusUpdate(request.id, request.userId, 'Approved')}>
                        <CheckCircle2 className="size-4 mr-2" /> Aprovar Combo
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(request.id, request.userId, 'Contested')}>
                        <XCircle className="size-4 mr-2" /> Contestar
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}

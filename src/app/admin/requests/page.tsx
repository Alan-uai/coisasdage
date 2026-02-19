
'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, doc, serverTimestamp } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, AlertTriangle, User, Mail, Calendar, ShieldAlert } from 'lucide-react';
import type { CustomRequest, UserProfile } from '@/lib/types';

export default function AdminRequestsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // Fetch the user's profile to check for admin status
  const profileRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

  const requestsQuery = useMemoFirebase(
    () => (user && firestore && profile?.isAdmin ? query(collection(firestore, 'custom_requests'), orderBy('createdAt', 'desc'), limit(50)) : null),
    [user, firestore, profile]
  );

  const { data: requests, isLoading: isRequestsLoading } = useCollection<CustomRequest>(requestsQuery);

  const handleStatusUpdate = (requestId: string, status: 'Approved' | 'Contested') => {
    if (!firestore) return;
    const requestRef = doc(firestore, 'custom_requests', requestId);
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

  // Access check
  if (!user || !profile?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <ShieldAlert className="size-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold font-headline">Acesso Negado</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Esta área é restrita apenas para administradores da Artesã Aconchegante.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Voltar ao Início</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight font-headline">Gerenciar Solicitações Sob Demanda</h1>
        <p className="text-muted-foreground mt-2">Aprove ou conteste pedidos personalizados feitos pelos clientes.</p>
      </header>

      <main className="grid grid-cols-1 gap-6">
        {(isRequestsLoading) ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (!requests || requests.length === 0) ? (
          <Card className="text-center py-12">
            <CardContent>
              <AlertTriangle className="size-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhuma solicitação encontrada.</p>
            </CardContent>
          </Card>
        ) : (
          requests.map((request) => (
            <Card key={request.id} className="overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-48 bg-muted relative min-h-[150px]">
                  <Image
                    src={request.imageUrl}
                    alt={request.productName}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 p-6">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={
                          request.status === 'Approved' ? 'default' : 
                          request.status === 'Contested' ? 'destructive' : 'secondary'
                        }>
                          {request.status === 'Pending' ? 'Pendente' : 
                           request.status === 'Approved' ? 'Aprovado' : 
                           request.status === 'Contested' ? 'Contestado' : 'No Carrinho'}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="size-3" />
                          {request.createdAt?.toDate().toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold font-headline">{request.productName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {request.selectedSize} / {request.selectedColor} / {request.selectedMaterial}
                      </p>
                    </div>
                    <div className="text-sm border-l pl-4 border-primary/20">
                      <p className="font-semibold flex items-center gap-1"><User className="size-4" /> {request.userName}</p>
                      <p className="text-muted-foreground flex items-center gap-1"><Mail className="size-4" /> {request.userEmail}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-muted/30 flex flex-col justify-center gap-2 border-l">
                  <p className="text-lg font-bold text-center mb-2">R$ {request.finalPrice.toFixed(2).replace('.', ',')}</p>
                  {request.status === 'Pending' && (
                    <>
                      <Button size="sm" onClick={() => handleStatusUpdate(request.id, 'Approved')}>
                        <CheckCircle2 className="size-4 mr-2" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(request.id, 'Contested')}>
                        <XCircle className="size-4 mr-2" /> Contestar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}

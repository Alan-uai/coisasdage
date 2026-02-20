'use client';

import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser, useDoc } from '@/firebase';
import { collectionGroup, query, orderBy, limit, doc, serverTimestamp } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, X, Eye, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { CustomRequest, UserProfile } from '@/lib/types';
import Image from 'next/image';

export function AdminRequests() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [editingRequest, setEditingRequest] = useState<CustomRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [finalPrice, setFinalPrice] = useState<string>('');

  // Fetch profile to double check admin status before querying
  const profileRef = useMemoFirebase(() => 
    (user && firestore) ? doc(firestore, 'users', user.uid) : null,
    [user, firestore]
  );
  const { data: profile } = useDoc<UserProfile>(profileRef);

  const requestsQuery = useMemoFirebase(
    () => (firestore && profile?.isAdmin ? query(collectionGroup(firestore, 'custom_requests'), orderBy('createdAt', 'desc'), limit(50)) : null),
    [firestore, profile?.isAdmin]
  );

  const { data: requests, isLoading } = useCollection<CustomRequest>(requestsQuery);

  const handleUpdateStatus = (request: CustomRequest, status: CustomRequest['status']) => {
    if (!firestore) return;
    const requestRef = doc(firestore, 'users', request.userId, 'custom_requests', request.id);
    
    updateDocumentNonBlocking(requestRef, {
      status,
      adminNotes: adminNotes || request.adminNotes || '',
      finalPrice: finalPrice ? parseFloat(finalPrice) : request.finalPrice,
      updatedAt: serverTimestamp(),
    });

    setEditingRequest(null);
    setAdminNotes('');
    setFinalPrice('');
  };

  if (isLoading || !profile?.isAdmin) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  if (!requests || requests.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">Nenhuma solicitação encontrada.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Itens</TableHead>
            <TableHead>Valor Base</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="text-sm">
                {request.createdAt?.toDate().toLocaleDateString('pt-BR')}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-bold">{request.userName}</span>
                  <span className="text-xs text-muted-foreground">{request.userEmail}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex -space-x-2">
                  {request.items.map((item, idx) => (
                    <div key={idx} className="relative size-8 rounded-full border-2 border-background bg-muted overflow-hidden">
                      <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                    </div>
                  ))}
                  {request.items.length > 3 && (
                    <div className="size-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold">
                      +{request.items.length - 3}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>R$ {request.totalBasePrice.toFixed(2).replace('.', ',')}</TableCell>
              <TableCell>
                <Badge variant={request.status === 'Pending' ? 'secondary' : request.status === 'Approved' ? 'default' : 'destructive'}>
                  {request.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Dialog open={editingRequest?.id === request.id} onOpenChange={(open) => {
                  if (open) {
                    setEditingRequest(request);
                    setAdminNotes(request.adminNotes || '');
                    setFinalPrice(request.finalPrice.toString());
                  } else {
                    setEditingRequest(null);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon"><Eye className="size-4" /></Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Análise de Solicitação</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                      <div className="space-y-2">
                        <Label>Itens Solicitados</Label>
                        <div className="grid gap-2">
                          {request.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-2 border rounded-md">
                              <Image src={item.imageUrl} alt={item.productName} width={40} height={40} className="rounded object-cover" />
                              <div className="flex-1">
                                <p className="text-sm font-bold">{item.productName} (x{item.quantity})</p>
                                <p className="text-xs text-muted-foreground">{item.selectedColor} | {item.selectedSize}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="price">Valor Final Sugerido (R$)</Label>
                          <Input 
                            id="price" 
                            type="number" 
                            step="0.01"
                            value={finalPrice} 
                            onChange={(e) => setFinalPrice(e.target.value)} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valor Original</Label>
                          <div className="h-10 flex items-center px-3 border rounded-md bg-muted text-muted-foreground">
                            R$ {request.totalBasePrice.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notas da Artesã (aparece para o cliente)</Label>
                        <Textarea 
                          id="notes" 
                          placeholder="Ex: Prazo de produção estendido devido à cor solicitada." 
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter className="gap-2">
                      <Button variant="outline" onClick={() => handleUpdateStatus(request, 'Contested')} className="text-destructive">
                        <X className="mr-2 size-4" /> Contestar/Revisar
                      </Button>
                      <Button onClick={() => handleUpdateStatus(request, 'Approved')} className="bg-green-600 hover:bg-green-700">
                        <Check className="mr-2 size-4" /> Aprovar Orçamento
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Plus, Trash2, Home, Briefcase, Star, Check } from 'lucide-react';
import type { SavedAddress } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AddressesPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);

  const [formData, setFormData] = useState({
    label: '',
    cpf: '',
    zipCode: '',
    streetName: '',
    streetNumber: '',
    city: '',
    state: '',
  });

  const addressesQuery = useMemoFirebase(
    () => (user && firestore ? query(collection(firestore, 'users', user.uid, 'addresses'), orderBy('label')) : null),
    [user, firestore]
  );
  const { data: addresses, isLoading } = useCollection<SavedAddress>(addressesQuery);

  const handleAddAddress = () => {
    if (!user || !firestore) return;
    const addrRef = collection(firestore, 'users', user.uid, 'addresses');
    addDocumentNonBlocking(addrRef, { ...formData, isDefault: addresses?.length === 0 });
    setIsAdding(false);
    setFormData({ label: '', cpf: '', zipCode: '', streetName: '', streetNumber: '', city: '', state: '' });
    toast({ title: "Sucesso!", description: "Endereço salvo com sucesso." });
  };

  const handleDelete = (id: string) => {
    if (!user || !firestore) return;
    const addrRef = doc(firestore, 'users', user.uid, 'addresses', id);
    deleteDocumentNonBlocking(addrRef);
  };

  const handleSetDefault = (id: string) => {
    if (!user || !firestore || !addresses) return;
    addresses.forEach(addr => {
      const ref = doc(firestore, 'users', user.uid, 'addresses', addr.id);
      updateDocumentNonBlocking(ref, { isDefault: addr.id === id });
    });
  };

  if (isUserLoading || isLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-32 w-full" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold font-headline">Meus Endereços</h1>
          <p className="text-muted-foreground mt-2">Gerencie seus locais de entrega para um checkout rápido.</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "ghost" : "default"}>
          {isAdding ? "Cancelar" : <><Plus className="mr-2 size-4" /> Novo Endereço</>}
        </Button>
      </header>

      {isAdding && (
        <Card className="border-primary/20 shadow-lg">
          <CardHeader><CardTitle>Adicionar Novo</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 col-span-full">
              <Label>Nome do Local (ex: Casa, Trabalho)</Label>
              <Input value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} placeholder="Minha Casa" />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input value={formData.zipCode} onChange={e => setFormData({...formData, zipCode: e.target.value})} placeholder="00000-000" />
            </div>
            <div className="space-y-2 col-span-full">
              <Label>Rua</Label>
              <Input value={formData.streetName} onChange={e => setFormData({...formData, streetName: e.target.value})} placeholder="Av. Principal" />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={formData.streetNumber} onChange={e => setFormData({...formData, streetNumber: e.target.value})} placeholder="123" />
            </div>
            <div className="space-y-2">
              <Label>Cidade/UF</Label>
              <div className="flex gap-2">
                <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="Cidade" />
                <Input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} placeholder="SP" className="w-20" />
              </div>
            </div>
            <Button onClick={handleAddAddress} className="col-span-full mt-4">Salvar Endereço</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {addresses?.map((addr) => (
          <Card key={addr.id} className={cn("relative transition-all", addr.isDefault && "border-primary ring-1 ring-primary/20 bg-primary/5")}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  {addr.label.toLowerCase().includes('casa') ? <Home className="size-4 text-primary" /> : <Briefcase className="size-4 text-primary" />}
                  <h3 className="font-bold">{addr.label}</h3>
                  {addr.isDefault && <Badge className="text-[10px] h-4">Padrão</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleSetDefault(addr.id)} title="Tornar Padrão"><Star className={cn("size-4", addr.isDefault && "fill-primary text-primary")} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(addr.id)} className="text-destructive"><Trash2 className="size-4" /></Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{addr.streetName}, {addr.streetNumber}</p>
              <p className="text-sm text-muted-foreground">{addr.city} - {addr.state}</p>
              <p className="text-xs text-muted-foreground/60 mt-2">CEP: {addr.zipCode} | CPF: {addr.cpf}</p>
            </CardContent>
          </Card>
        ))}

        {!isLoading && addresses?.length === 0 && !isAdding && (
          <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl bg-muted/20">
            <MapPin className="size-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Você ainda não tem endereços salvos.</p>
          </div>
        )}
      </div>
    </div>
  );
}
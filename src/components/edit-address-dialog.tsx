
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Order, CustomRequest, SavedAddress, Address } from '@/lib/types';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { addressSchema } from '@/app/checkout/form-schema';
import { Loader2 } from 'lucide-react';

interface EditAddressDialogProps {
  item: { type: 'order' | 'request', data: Order | CustomRequest } | null;
  onClose: () => void;
}

const dialogAddressSchema = addressSchema.extend({
  label: z.string().min(2, { message: "O nome do local (ex: Casa) é obrigatório." }),
});

export function EditAddressDialog({ item, onClose }: EditAddressDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');

  const addressesQuery = useMemoFirebase(
    () => (user && firestore ? query(collection(firestore, 'users', user.uid, 'addresses'), orderBy('label')) : null),
    [user, firestore]
  );
  const { data: savedAddresses, isLoading: isAddressesLoading } = useCollection<SavedAddress>(addressesQuery);

  const form = useForm<z.infer<typeof dialogAddressSchema>>({
    resolver: zodResolver(dialogAddressSchema),
    defaultValues: { label: '', cpf: '', phone: '', streetName: '', streetNumber: '', zipCode: '', city: '', state: '' },
  });

  useEffect(() => {
    if (!item) {
      // Reset form when dialog is closed
      form.reset();
      setShowAddressForm(false);
      setSelectedAddressId('');
      setIsSubmitting(false);
    } else {
        if (savedAddresses && savedAddresses.length === 0) {
            setShowAddressForm(true);
        }
    }
  }, [item, savedAddresses, form]);

  const handleUpdateAddress = (address: Address) => {
    if (!item || !user || !firestore) return;
    setIsSubmitting(true);
    
    const collectionName = item.type === 'order' ? 'orders' : 'custom_requests';
    const docRef = doc(firestore, 'users', user.uid, collectionName, item.data.id);

    updateDocumentNonBlocking(docRef, { shippingAddress: address });

    toast({ title: "Endereço Atualizado!", description: "O endereço do seu pedido foi alterado com sucesso." });
    setIsSubmitting(false);
    onClose();
  };

  const handleSelectAddress = (addressId: string) => {
    const address = savedAddresses?.find(a => a.id === addressId);
    if (address) {
      const { id, label, isDefault, ...addressData } = address;
      handleUpdateAddress(addressData);
    }
  };

  const handleSaveNewAddress = async (values: z.infer<typeof dialogAddressSchema>) => {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    const { label, ...addressData } = values;
    const newAddress: SavedAddress = {
      ...addressData,
      id: '', // Firestore will generate
      label,
      isDefault: savedAddresses?.length === 0,
    };
    
    // Save to user's address book
    const addrRef = collection(firestore, 'users', user.uid, 'addresses');
    addDocumentNonBlocking(addrRef, newAddress);

    // Update the order/request
    handleUpdateAddress(addressData);
  };
  
  const isOpen = !!item;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Alterar Endereço de Entrega</DialogTitle>
          <DialogDescription>
            Selecione um endereço salvo ou adicione um novo. A alteração será aplicada a este pedido.
          </DialogDescription>
        </DialogHeader>

        {isAddressesLoading ? (
            <Skeleton className="h-24 w-full" />
        ) : (
            <div className="py-4 space-y-4">
                {!showAddressForm && savedAddresses && savedAddresses.length > 0 && (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="saved-address">Escolher Endereço</Label>
                             <Select value={selectedAddressId} onValueChange={handleSelectAddress}>
                                <SelectTrigger id="saved-address">
                                    <SelectValue placeholder="Selecione um endereço salvo" />
                                </SelectTrigger>
                                <SelectContent>
                                    {savedAddresses.map(addr => <SelectItem key={addr.id} value={addr.id}>{addr.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="button" variant="link" size="sm" onClick={() => setShowAddressForm(true)}>+ Adicionar novo endereço</Button>
                    </div>
                )}
                
                {showAddressForm && (
                     <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSaveNewAddress)} className="space-y-3">
                           <FormField control={form.control} name="label" render={({ field }) => (<FormItem><FormLabel>Nome do Local (ex: Casa)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                           <div className="grid grid-cols-2 gap-2">
                            <FormField control={form.control} name="cpf" render={({ field }) => (<FormItem><FormLabel>CPF</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                           </div>
                            <FormField control={form.control} name="zipCode" render={({ field }) => (<FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="streetName" render={({ field }) => (<FormItem><FormLabel>Rua</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <div className="grid grid-cols-3 gap-2">
                                <FormField control={form.control} name="streetNumber" render={({ field }) => (<FormItem className="col-span-1"><FormLabel>Nº</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="city" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            </div>
                            <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>Estado (UF)</FormLabel><FormControl><Input {...field} maxLength={2} /></FormControl><FormMessage /></FormItem>)}/>
                            <DialogFooter className="mt-4 gap-2">
                                <Button type="button" variant="ghost" onClick={() => setShowAddressForm(false)} disabled={isSubmitting}>Voltar</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                                    Salvar e Usar Endereço
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

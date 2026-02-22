'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { User } from 'firebase/auth';
import { createPreference, processPayment, notifyAdminNewRequest } from './actions';
import type { CartItem, SavedAddress } from '@/lib/types';
import { addressSchema } from './form-schema';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { useFirestore, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc, serverTimestamp, query, orderBy, where, getDocs, Timestamp } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { QrCode, Loader2, MapPin, ClipboardList, ShoppingBag, ArrowRight, Truck, Calendar, Pencil, ShoppingCart, Phone, CheckCircle, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';

declare global {
    interface Window {
        MercadoPago: any;
    }
}

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";

export function CheckoutForm({ user, cartItems, subtotal, isCartLoading }: { user: User, cartItems: CartItem[], subtotal: number, isCartLoading: boolean }) {
    const searchParams = useSearchParams();
    const checkoutType = searchParams.get('type') || 'ready';
    
    const [step, setStep] = useState<'address' | 'payment' | 'confirmation'>('address');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Address related state
    const [shippingAddress, setShippingAddress] = useState<z.infer<typeof addressSchema> | null>(null);
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [showAddressForm, setShowAddressForm] = useState(false);
    
    // Payment related state
    const [preferenceId, setPreferenceId] = useState<string | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [isBrickLoaded, setIsBrickLoaded] = useState(false);
    const [pixData, setPixData] = useState<{ qr_code: string, qr_code_base64: string } | null>(null);

    const brickRendered = useRef(false);
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const addressesQuery = useMemoFirebase(
      () => (user && firestore ? query(collection(firestore, 'users', user.uid, 'addresses'), orderBy('label')) : null),
      [user, firestore]
    );
    const { data: savedAddresses, isLoading: isAddressesLoading } = useCollection<SavedAddress>(addressesQuery);

    const form = useForm<z.infer<typeof addressSchema>>({
        resolver: zodResolver(addressSchema),
        defaultValues: { cpf: '', phone: '', streetName: '', streetNumber: '', zipCode: '', city: '', state: '' },
    });

    const currentAddress = useMemo(() => 
      savedAddresses?.find(a => a.id === selectedAddressId), 
    [savedAddresses, selectedAddressId]);

    const clearPaidCartItems = useCallback(() => {
        if (!user || !firestore) return;
        const selectedItemsQuery = query(collection(firestore, 'users', user.uid, 'carts', 'main', 'items'), where('selected', '==', true));
        getDocs(selectedItemsQuery).then(snapshot => {
            snapshot.forEach(document => {
                deleteDocumentNonBlocking(document.ref);
            });
        });
    }, [user, firestore]);
    
    const handleSelectAddress = useCallback((id: string, initialLoad = false) => {
        const addr = savedAddresses?.find(a => a.id === id);
        if (addr) {
            setSelectedAddressId(id);
            setShippingAddress(addr);
            if (!initialLoad) {
                setShowAddressForm(false);
            }
            form.reset({
                cpf: addr.cpf, phone: addr.phone || '', streetName: addr.streetName, streetNumber: addr.streetNumber,
                zipCode: addr.zipCode, city: addr.city, state: addr.state,
            });
        }
    }, [savedAddresses, form]);

    useEffect(() => {
        if (savedAddresses && savedAddresses.length > 0 && !selectedAddressId) {
            const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
            if (defaultAddr) {
                handleSelectAddress(defaultAddr.id, true);
            }
        } else if (!isAddressesLoading && (!savedAddresses || savedAddresses.length === 0)) {
            setShowAddressForm(true);
        }
    }, [savedAddresses, selectedAddressId, isAddressesLoading, handleSelectAddress]);
    
    const handleAddressSubmit = useCallback(async (values: z.infer<typeof addressSchema>) => {
      if (!user || cartItems.length === 0) return;
      
      setIsLoading(true);
      setError(null);
      setShippingAddress(values);

      if (checkoutType === 'custom') {
          try {
              const requestsRef = collection(firestore, 'users', user.uid, 'custom_requests');
              const newRequestRef = doc(requestsRef);
              await setDocumentNonBlocking(newRequestRef, {
                  userId: user.uid,
                  userName: user.displayName || 'Cliente',
                  userEmail: user.email,
                  status: 'Pending',
                  totalBasePrice: subtotal,
                  shippingAddress: values,
                  items: cartItems.map(item => ({
                      productId: item.productId, productName: item.productName, imageUrl: item.imageUrl,
                      quantity: item.quantity, unitPriceAtOrder: item.unitPriceAtAddition,
                      selectedSize: item.selectedSize, selectedColor: item.selectedColor, selectedMaterial: item.selectedMaterial,
                  })),
                  createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
              }, { merge: true });
              
              await notifyAdminNewRequest(newRequestRef.id, user.displayName || 'Cliente', cartItems[0].productName, cartItems[0].imageUrl, values.phone);
              clearPaidCartItems();
              setStep('confirmation'); 
              const message = `Olá Gê! Acabei de solicitar um orçamento pelo site das peças: *${cartItems.map(i => i.productName).join(', ')}*. Aguardo seu retorno!`;
              window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
          } catch (e: any) {
              setError(e.message || 'Erro ao solicitar orçamento.');
          } finally {
              setIsLoading(false);
          }
          return;
      }
      
      setStep('payment');
      setIsLoading(false);
    }, [user, cartItems, subtotal, firestore, checkoutType, clearPaidCartItems]);

    const initializePayment = useCallback(async () => {
      if (step !== 'payment' || !shippingAddress || !user || !user.email || cartItems.length === 0 || !firestore) return;
      
      setIsLoading(true);
      setError(null);

      try {
          const ordersRef = collection(firestore, 'users', user.uid, 'orders');
          const newOrderRef = doc(ordersRef);
          const generatedOrderId = newOrderRef.id;
          setOrderId(generatedOrderId);

          const expirationTime = new Date();
          expirationTime.setHours(expirationTime.getHours() + 72);

          await setDocumentNonBlocking(newOrderRef, {
              userId: user.uid, userName: user.displayName || 'Cliente', orderDate: serverTimestamp(),
              totalAmount: subtotal, status: 'Processing', shippingAddress,
              items: cartItems.map(item => ({
                  productId: item.productId, productGroupId: item.productGroupId, productName: item.productName,
                  imageUrl: item.imageUrl, quantity: item.quantity, unitPriceAtOrder: item.unitPriceAtAddition,
                  selectedSize: item.selectedSize, selectedColor: item.selectedColor, selectedMaterial: item.selectedMaterial,
              })),
              createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
              expiresAt: Timestamp.fromDate(expirationTime),
          }, { merge: true });

          const result = await createPreference(user.uid, user.email, user.displayName, cartItems, shippingAddress, generatedOrderId);
          if (result.preferenceId) setPreferenceId(result.preferenceId);
          else {
              setError(result.error || 'Erro ao iniciar pagamento.');
              setStep('address');
          }
      } catch (e: any) {
          setError('Erro inesperado ao iniciar pagamento.');
          setStep('address');
      } finally {
          setIsLoading(false);
      }
    }, [step, shippingAddress, user, cartItems, subtotal, firestore]);

    useEffect(() => {
      if (step === 'payment' && !preferenceId) {
        initializePayment();
      }
    }, [step, preferenceId, initializePayment]);

    const handlePaymentSubmit = useCallback(async (paymentData: any) => {
        if (!orderId || !user.email || !firestore) return;
        setIsLoading(true);
        try {
            const finalPaymentData = paymentData.formData || paymentData;
            const result = await processPayment(finalPaymentData, orderId, user.email, subtotal);
            if (result.success) {
                if (finalPaymentData.payment_method_id === 'pix' && result.qr_code) {
                    setPixData({ qr_code: result.qr_code, qr_code_base_64: result.qr_code_base_64 || '' });
                }
                setStep('confirmation');
                clearPaidCartItems();
                
                if (result.payment_id) {
                    const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
                    updateDocumentNonBlocking(orderRef, { 
                        paymentId: result.payment_id,
                        merchantOrderId: result.merchant_order_id || null,
                        status: result.status === 'approved' ? 'IN_PRODUCTION' : 'Processing',
                        updatedAt: serverTimestamp(),
                    });
                }
                if (finalPaymentData.payment_method_id !== 'pix') {
                    router.push(`/payment-status?status=${result.status === 'approved' ? 'success' : 'pending'}&order_id=${orderId}`);
                }
            } else setError(result.error || 'Erro no pagamento.');
        } catch (e) {
            setError('Erro ao finalizar.');
        } finally {
          setIsLoading(false);
        }
    }, [orderId, user.email, firestore, router, subtotal, clearPaidCartItems]);

    useEffect(() => {
        if (preferenceId && step === 'payment' && !pixData && !brickRendered.current) {
            const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
            if ((window as any).MercadoPago && publicKey) {
                brickRendered.current = true;
                const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' });
                mp.bricks().create('payment', 'paymentCard', {
                    initialization: { amount: subtotal, preferenceId, payer: { email: user.email } },
                    customization: { paymentMethods: { ticket: 'all', bankTransfer: ['pix'], creditCard: 'all' } },
                    callbacks: {
                        onReady: () => setIsBrickLoaded(true),
                        onSubmit: (param: any) => handlePaymentSubmit(param),
                        onError: (error: any) => setError(error.message),
                    },
                });
            }
        }
    }, [preferenceId, step, pixData, subtotal, handlePaymentSubmit, user.email]);

    if (step === 'confirmation' && pixData) {
        return (
            <div className="max-w-2xl mx-auto p-4">
                <Card className="border-primary/20 shadow-2xl overflow-hidden">
                    <CardHeader className="text-center bg-primary/5 pb-8"><QrCode className="size-16 text-primary mx-auto mb-4" /><CardTitle className="text-3xl font-headline">Pague com Pix</CardTitle><CardDescription>Escaneie o código ou copie a chave para pagar.</CardDescription></CardHeader>
                    <CardContent className="flex flex-col items-center gap-8 p-8">
                        <div className="bg-white p-4 rounded-xl shadow-inner border border-muted">{pixData.qr_code_base_64 && <Image src={`data:image/png;base64,${pixData.qr_code_base_64}`} alt="QR Code" width={240} height={240} className="rounded-lg" />}</div>
                        <div className="w-full space-y-3">
                          <Button onClick={() => { navigator.clipboard.writeText(pixData.qr_code); toast({ title: "Copiado!" }); }} className="w-full h-14 text-lg font-bold">Copiar Código Pix</Button>
                          <Button asChild variant="outline" className="w-full h-12"><Link href="/orders">Ver Meus Pedidos</Link></Button>
                        </div>
                        <div className="text-xs text-center text-muted-foreground bg-muted/30 p-4 rounded-lg"><p>Após o pagamento, o Mercado Pago nos notificará e iniciaremos a produção/envio da sua peça!</p></div>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    if (!isCartLoading && cartItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 py-20 min-h-[400px]">
                <ShoppingCart className="size-16 text-muted-foreground mb-4" /><h2 className="text-2xl font-bold font-headline">Seu carrinho de checkout está vazio</h2><p className="text-muted-foreground mt-2">Adicione itens ao carrinho para finalizar a compra.</p>
                <Button asChild className="mt-6"><Link href="/">Voltar ao Catálogo</Link></Button>
            </div>
        );
    }
    
    const pageIsLoading = isAddressesLoading || isCartLoading;

    const renderAddressStep = () => (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleAddressSubmit)} className="space-y-4">
          {!showAddressForm && savedAddresses && savedAddresses.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground">Escolher Endereço Salvo</Label>
                <Select value={selectedAddressId} onValueChange={handleSelectAddress}><SelectTrigger><SelectValue placeholder="Selecione um endereço" /></SelectTrigger><SelectContent>{savedAddresses.map(addr => <SelectItem key={addr.id} value={addr.id}>{addr.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <Button type="button" variant="link" size="sm" onClick={() => setShowAddressForm(true)}>+ Adicionar novo endereço</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="cpf" render={({ field }) => (<FormItem><FormLabel>CPF</FormLabel><FormControl><Input {...field} placeholder="000.000.000-00" /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Telefone (WhatsApp)</FormLabel><FormControl><Input {...field} placeholder="(11) 99999-9999" /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="zipCode" render={({ field }) => (<FormItem className="col-span-1"><FormLabel>CEP</FormLabel><FormControl><Input {...field} placeholder="00000-000" /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="streetName" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Rua</FormLabel><FormControl><Input {...field} placeholder="Ex: Av. das Flores" /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="streetNumber" render={({ field }) => (<FormItem className="col-span-1"><FormLabel>Número</FormLabel><FormControl><Input {...field} placeholder="123" /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="city" render={({ field }) => (<FormItem className="col-span-1"><FormLabel>Cidade</FormLabel><FormControl><Input {...field} placeholder="Sua Cidade" /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="state" render={({ field }) => (<FormItem className="col-span-1"><FormLabel>UF</FormLabel><FormControl><Input {...field} maxLength={2} placeholder="SP" /></FormControl><FormMessage /></FormItem>)}/>
            </div>
          )}
          <Button type="submit" disabled={isLoading} className="w-full h-14 text-lg font-bold mt-6 shadow-lg shadow-primary/20">
            {isLoading ? <Loader2 className="animate-spin mr-2" /> : (checkoutType === 'custom' ? 'Solicitar no WhatsApp' : 'Continuar para Pagamento')}
          </Button>
          {showAddressForm && savedAddresses && savedAddresses.length > 0 && (<Button type="button" variant="ghost" onClick={() => setShowAddressForm(false)} className="w-full">Voltar para seleção</Button>)}
        </form>
      </Form>
    );

    const renderPaymentStep = () => (
      <div className="space-y-6">
        <div className="p-4 border rounded-xl bg-muted/30 relative group transition-all">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold uppercase text-primary tracking-widest flex items-center gap-1"><MapPin className="size-3" /> Entregar em</span>
              <Button variant="ghost" size="sm" onClick={() => setStep('address')} className="h-6 text-[10px] px-2 gap-1"><Pencil className="size-3" /> Alterar</Button>
            </div>
            <div className="text-sm">
                <p className="font-bold text-base">{currentAddress?.label}</p>
                <p className="text-muted-foreground">{currentAddress?.streetName}, {currentAddress?.streetNumber}</p>
                <p className="text-muted-foreground">{currentAddress?.city} - {currentAddress?.state}</p>
            </div>
        </div>
        <div className="space-y-4">
          <Label className="text-sm font-bold uppercase text-muted-foreground block">Meios de pagamento</Label>
          {isLoading ? (
            <div className="flex items-center justify-center p-8 h-32"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <div id="paymentCard" className={cn("transition-opacity duration-300", !isBrickLoaded && "opacity-0")} />
          )}
          {!isBrickLoaded && preferenceId && !isLoading && (
            <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
          )}
        </div>
      </div>
    );

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto p-4">
          <div className="space-y-6">
              <Card className="shadow-lg">
                  <CardHeader><CardTitle className="font-headline text-2xl flex items-center gap-2">{checkoutType === 'custom' ? <ClipboardList className="size-6 text-primary" /> : <ShoppingBag className="size-6 text-primary" />}Resumo do Pedido</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                      {cartItems.map(item => (
                          <div key={item.id} className="flex justify-between items-center text-sm">
                              <div className="flex items-center gap-3">
                                  <div className="size-12 relative rounded overflow-hidden bg-muted"><Image src={item.imageUrl} alt={item.productName} fill className="object-cover" /></div>
                                  <div className="flex flex-col"><span className="font-bold">{item.productName}</span><span className="text-[10px] text-muted-foreground uppercase">{item.selectedSize} | {item.selectedColor}</span></div>
                              </div>
                              <span className="font-bold">R$ {(item.unitPriceAtAddition * item.quantity).toFixed(2)}</span>
                          </div>
                      ))}
                      <div className="border-t pt-4 flex justify-between font-bold text-xl text-primary"><span>Total</span><span>R$ {subtotal.toFixed(2)}</span></div>
                  </CardContent>
              </Card>
              <Card className="border-primary/10 bg-primary/5 shadow-sm"><CardHeader className="py-4"><CardTitle className="text-sm uppercase font-bold text-primary flex items-center gap-2"><Truck className="size-4" /> Previsão de Entrega</CardTitle></CardHeader><CardContent className="text-sm space-y-2"><div className="flex items-center gap-2 text-muted-foreground"><Calendar className="size-4" /><span>{checkoutType === 'custom' ? 'Prazo de confecção + ' : ''} Chega em aprox. 5 dias úteis</span></div><p className="text-[10px] opacity-60">Enviado via Mercado Envios (Expresso)</p></CardContent></Card>
          </div>
          
          <Card className="shadow-xl min-h-[500px] border-primary/20">
              <CardHeader>
                  <div className="flex justify-between">
                    <CardTitle className="font-headline text-2xl">Finalizar Encomenda</CardTitle>
                    <div className="flex items-center gap-1 text-sm">
                        <span className={cn("flex items-center gap-1.5", step === 'address' ? 'text-primary font-bold' : 'text-muted-foreground')}><MapPin className="size-4"/> Endereço</span>
                        <span className="text-muted-foreground">&gt;</span>
                        <span className={cn("flex items-center gap-1.5", step === 'payment' ? 'text-primary font-bold' : 'text-muted-foreground')}><Wallet className="size-4"/> Pagamento</span>
                    </div>
                  </div>
                  <CardDescription>Confirme o destino e escolha como pagar.</CardDescription>
                  {error && <div className="bg-destructive/10 text-destructive p-3 rounded text-xs mt-2">{error}</div>}
              </CardHeader>
              <CardContent>
                  {pageIsLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 space-y-4"><Loader2 className="size-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Preparando seu checkout...</p></div>
                  ) : (
                      <>
                        {step === 'address' && renderAddressStep()}
                        {step === 'payment' && renderPaymentStep()}
                      </>
                  )}
              </CardContent>
          </Card>
      </div>
    );
}

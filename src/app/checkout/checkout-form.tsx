'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { User } from 'firebase/auth';
import { createPreference, processPayment, notifyAdminNewRequest } from './actions';
import type { CartItem, SavedAddress, Order, OrderItemSummary, CustomRequest, Address } from '@/lib/types';
import { addressSchema } from './form-schema';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { useFirestore, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc, serverTimestamp, query, orderBy, where, getDocs, Timestamp } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { QrCode, Loader2, MapPin, ClipboardList, ShoppingBag, ArrowRight, Truck, Calendar, ChevronsUpDown, ShoppingCart, Phone, CheckCircle, Wallet, Home, Briefcase, Package, Bike, Store, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { PreferenceCartItem } from './actions';


declare global {
    interface Window {
        MercadoPago: any;
    }
}

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const ARTISAN_CITY = (process.env.NEXT_PUBLIC_ARTISAN_CITY || 'Piracicaba').toLowerCase();
const LOCAL_DELIVERY_FEE = parseFloat(process.env.NEXT_PUBLIC_LOCAL_DELIVERY_FEE || '10');

const ConfirmationActions = () => (
    <div className="w-full space-y-3 pt-6">
        <Button asChild className="w-full h-12 text-base" size="lg">
            <Link href="/orders" className="gap-2">
                <Package className="size-5" /> Ver Minhas Encomendas
            </Link>
        </Button>
        <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline" className="h-11">
                <Link href="/">Ver Catálogo</Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
                <Link href="/cart">Voltar ao Carrinho</Link>
            </Button>
        </div>
    </div>
);


export function CheckoutForm({ user, cartItems, subtotal, isCartLoading, resumedOrder }: { user: User, cartItems: (CartItem | OrderItemSummary)[], subtotal: number, isCartLoading: boolean, resumedOrder?: Order }) {
    const searchParams = useSearchParams();
    
    const checkoutType = useMemo(() => {
        if (resumedOrder) {
            return resumedOrder.items[0].readyMade ? 'ready' : 'custom';
        }
        return searchParams.get('type') || 'ready';
    }, [resumedOrder, searchParams]);
    
    const [step, setStep] = useState<'address' | 'payment' | 'confirmation'>(resumedOrder ? 'payment' : 'address');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [shippingAddress, setShippingAddress] = useState<z.infer<typeof addressSchema> | null>(resumedOrder ? resumedOrder.shippingAddress : null);
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    
    const [preferenceId, setPreferenceId] = useState<string | null>(resumedOrder?.preferenceId || null);
    const [orderId, setOrderId] = useState<string | null>(resumedOrder?.id || null);
    const [isBrickLoaded, setIsBrickLoaded] = useState(false);
    const [pixData, setPixData] = useState<{ qr_code: string, qrCodeBase64: string } | null>(null);
    const [confirmedItem, setConfirmedItem] = useState<Order | CustomRequest | null>(null);
    
    const [isLocalCity, setIsLocalCity] = useState(false);
    const [shippingOption, setShippingOption] = useState<'mercado_envios' | 'local_delivery' | 'pickup'>('mercado_envios');
    const [shippingCost, setShippingCost] = useState(0);

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
    
    const finalTotal = useMemo(() => (resumedOrder ? resumedOrder.totalAmount : subtotal + shippingCost), [subtotal, shippingCost, resumedOrder]);

    const watchCity = form.watch('city');
    useEffect(() => {
        if (watchCity && watchCity.trim().toLowerCase() === ARTISAN_CITY) {
            setIsLocalCity(true);
             if (shippingOption === 'mercado_envios') {
                setShippingOption('local_delivery'); 
            }
        } else {
            setIsLocalCity(false);
            setShippingOption('mercado_envios');
        }
    }, [watchCity, shippingOption]);


    useEffect(() => {
        if (shippingOption === 'local_delivery') {
            setShippingCost(LOCAL_DELIVERY_FEE);
        } else {
            setShippingCost(0);
        }
    }, [shippingOption]);
    
    const handleSelectAddress = useCallback((id: string) => {
        if (id === '_new_') {
          setSelectedAddressId('_new_');
          form.reset({ cpf: '', phone: '', streetName: '', streetNumber: '', zipCode: '', city: '', state: '' });
        } else {
          const addr = savedAddresses?.find(a => a.id === id);
          if (addr) {
            setSelectedAddressId(id);
            form.reset({
                cpf: addr.cpf, phone: addr.phone || '', streetName: addr.streetName, streetNumber: addr.streetNumber,
                zipCode: addr.zipCode, city: addr.city, state: addr.state,
            });
          }
        }
      }, [savedAddresses, form]);
    
      useEffect(() => {
        if (isAddressesLoading) return;
    
        // If there are saved addresses and none is selected yet, select the default.
        if (savedAddresses && savedAddresses.length > 0 && selectedAddressId === '') {
            const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
            if (defaultAddr) {
                handleSelectAddress(defaultAddr.id);
            }
        } 
        // If there are no saved addresses, ensure we are in 'add new' mode.
        else if (!savedAddresses || savedAddresses.length === 0) {
            if (selectedAddressId !== '_new_') {
                 setSelectedAddressId('_new_');
            }
        }
      }, [savedAddresses, isAddressesLoading, selectedAddressId, handleSelectAddress]);

    const clearPaidCartItems = useCallback(() => {
        if (!user || !firestore) return;
        const selectedItemsQuery = query(collection(firestore, 'users', user.uid, 'carts', 'main', 'items'), where('selected', '==', true));
        getDocs(selectedItemsQuery).then(snapshot => {
            snapshot.forEach(document => {
                deleteDocumentNonBlocking(document.ref);
            });
        });
    }, [user, firestore]);
    
     const handleCepBlur = async (cep: string) => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;

        try {
            const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
            if (!res.ok) throw new Error('CEP não encontrado');
            const data = await res.json();
            form.setValue('streetName', data.street, { shouldValidate: true });
            form.setValue('city', data.city, { shouldValidate: true });
            form.setValue('state', data.state, { shouldValidate: true });
            toast({ title: "Endereço preenchido!", description: "Por favor, confirme o número." });
        } catch (error) {
            toast({ variant: 'destructive', title: "Erro ao buscar CEP", description: "Verifique o CEP digitado e tente novamente." });
        }
    };

    const handleAddressSubmit = useCallback(async (values: z.infer<typeof addressSchema>) => {
      if (!user || cartItems.length === 0) return;
      
      setIsLoading(true);
      setError(null);
      setShippingAddress(values);

      if (checkoutType === 'custom') {
          try {
              const requestsRef = collection(firestore, 'users', user.uid, 'custom_requests');
              const newRequestRef = doc(requestsRef);
              
              const newRequestData: Omit<CustomRequest, 'updatedAt'> = {
                  id: newRequestRef.id,
                  userId: user.uid,
                  userName: user.displayName || 'Cliente',
                  userEmail: user.email || '',
                  status: 'Pending',
                  totalBasePrice: subtotal,
                  shippingAddress: values,
                  shippingMethod: shippingOption,
                  items: cartItems.map(item => ({
                      productId: item.productId,
                      productGroupId: item.productGroupId || '',
                      productName: item.productName, imageUrl: item.imageUrl,
                      quantity: item.quantity, unitPriceAtOrder: (item as CartItem).unitPriceAtAddition || (item as OrderItemSummary).unitPriceAtOrder,
                      selectedSize: item.selectedSize, selectedColor: item.selectedColor, selectedMaterial: item.selectedMaterial,
                  })),
                  createdAt: Timestamp.now(), // Client-side timestamp for immediate UI
              };

              setDocumentNonBlocking(newRequestRef, { ...newRequestData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
              
              const message = `Olá Gê! Gostaria de solicitar um orçamento pelo site para: *${cartItems.map(i => i.productName).join(', ')}*. Aguardo seu retorno!`;
              const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

              window.open(whatsappUrl, '_blank');

              await notifyAdminNewRequest(newRequestRef.id, user.displayName || 'Cliente', cartItems[0].productName, cartItems[0].imageUrl, values.phone);
              clearPaidCartItems();
              setConfirmedItem(newRequestData as CustomRequest);
              setStep('confirmation');
          } catch (e: any) {
              setError(e.message || 'Erro ao solicitar orçamento.');
          } finally {
              setIsLoading(false);
          }
          return;
      }
      
      setStep('payment');
      setIsLoading(false);
    }, [user, cartItems, subtotal, firestore, checkoutType, clearPaidCartItems, user.displayName, user.email, shippingOption]);

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

          const orderItems = cartItems.map(item => ({
            productId: item.productId,
            productGroupId: item.productGroupId,
            productName: item.productName,
            imageUrl: item.imageUrl,
            quantity: item.quantity,
            unitPriceAtOrder: (item as CartItem).unitPriceAtAddition || (item as OrderItemSummary).unitPriceAtOrder,
            selectedSize: item.selectedSize,
            selectedColor: item.selectedColor,
            selectedMaterial: item.selectedMaterial,
          }));

          const newOrderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'orderDate'> = {
              userId: user.uid, userName: user.displayName || 'Cliente', 
              totalAmount: finalTotal, 
              status: 'Processing', 
              shippingAddress,
              shippingMethod: shippingOption,
              shippingCost: shippingCost,
              items: orderItems,
              expiresAt: Timestamp.fromDate(expirationTime),
          };

          await setDocumentNonBlocking(newOrderRef, {
              ...newOrderData,
              orderDate: serverTimestamp(),
              createdAt: serverTimestamp(), 
              updatedAt: serverTimestamp(),
          }, { merge: true });

          const preferenceItems = cartItems.map(item => ({
             id: item.productId,
             productName: item.productName,
             selectedColor: item.selectedColor,
             selectedSize: item.selectedSize,
             selectedMaterial: item.selectedMaterial,
             quantity: item.quantity,
             unitPriceAtAddition: (item as CartItem).unitPriceAtAddition || (item as OrderItemSummary).unitPriceAtOrder,
             imageUrl: item.imageUrl,
          }));

          const result = await createPreference(user.uid, user.email, user.displayName, preferenceItems as PreferenceCartItem[], shippingAddress, generatedOrderId, shippingOption, shippingCost);
          if (result.preferenceId) {
            setPreferenceId(result.preferenceId);
            updateDocumentNonBlocking(newOrderRef, { preferenceId: result.preferenceId });
          } else {
              setError(result.error || 'Erro ao iniciar pagamento.');
              setStep('address');
          }
      } catch (e: any) {
          setError('Erro inesperado ao iniciar pagamento.');
          setStep('address');
      } finally {
          setIsLoading(false);
      }
    }, [step, shippingAddress, user, cartItems, firestore, finalTotal, shippingOption, shippingCost]);

    useEffect(() => {
      if (step === 'payment' && !preferenceId && !resumedOrder) {
        initializePayment();
      }
    }, [step, preferenceId, initializePayment, resumedOrder]);

    const handlePaymentSubmit = useCallback(async (paymentData: any) => {
        if (!orderId || !user.email || !firestore) return;
        setIsLoading(true);
        try {
            const finalPaymentData = paymentData.formData || paymentData;
            const result = await processPayment(finalPaymentData, orderId, user.email, finalTotal, user.uid);
            
            if (result.success) {
                const orderDataForConfirmation: Partial<Order> = {
                    id: orderId,
                    createdAt: resumedOrder?.createdAt || Timestamp.now(),
                    items: (resumedOrder?.items || cartItems) as OrderItemSummary[],
                    totalAmount: finalTotal,
                    shippingAddress: shippingAddress!,
                    status: result.status as Order['status'],
                };
                setConfirmedItem(orderDataForConfirmation as Order);

                if (finalPaymentData.payment_method_id === 'pix' && result.qr_code && result.qrCodeBase64) {
                    setPixData({ qr_code: result.qr_code, qrCodeBase64: result.qrCodeBase64 });
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
            } else setError(result.error || 'Erro no pagamento.');
        } catch (e) {
            setError('Erro ao finalizar.');
        } finally {
          setIsLoading(false);
        }
    }, [orderId, user.email, firestore, router, finalTotal, clearPaidCartItems, user.uid, resumedOrder, cartItems, shippingAddress]);

    useEffect(() => {
        if (preferenceId && step === 'payment' && !pixData && !brickRendered.current) {
            const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
            if ((window as any).MercadoPago && publicKey) {
                brickRendered.current = true;
                const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' });
                mp.bricks().create('payment', 'paymentCard', {
                    initialization: { amount: finalTotal, preferenceId, payer: { email: user.email } },
                    customization: { paymentMethods: { ticket: 'all', bankTransfer: ['pix'], creditCard: 'all' } },
                    callbacks: {
                        onReady: () => setIsBrickLoaded(true),
                        onSubmit: (param: any) => handlePaymentSubmit(param),
                        onError: (error: any) => setError(error.message),
                    },
                });
            }
        }
    }, [preferenceId, step, pixData, finalTotal, handlePaymentSubmit, user.email]);

    const isTrulyEmpty = !isCartLoading && cartItems.length === 0 && !resumedOrder && step !== 'confirmation';

    if (isTrulyEmpty) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 py-20 min-h-[400px]">
                <ShoppingCart className="size-16 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold font-headline">Seu carrinho de checkout está vazio</h2>
                <p className="text-muted-foreground mt-2">Adicione itens ao carrinho para finalizar a compra.</p>
                <Button asChild className="mt-6"><Link href="/">Voltar ao Catálogo</Link></Button>
            </div>
        );
    }
    
    if (step === 'confirmation') {
        if (checkoutType === 'custom') {
            const req = confirmedItem as CustomRequest;
            return (
                 <div className="max-w-2xl mx-auto p-4">
                    <Card className="border-primary/20 shadow-2xl overflow-hidden">
                        <CardHeader className="text-center bg-primary/5 pb-8"><CheckCircle className="size-16 text-primary mx-auto mb-4" /><CardTitle className="text-3xl font-headline">Solicitação Enviada!</CardTitle><CardDescription>Você já foi redirecionado ao WhatsApp para negociar.</CardDescription></CardHeader>
                        <CardContent className="flex flex-col items-center gap-4 p-8">
                            <div className="text-sm space-y-2 text-muted-foreground bg-muted/30 p-4 rounded-lg w-full">
                                <p><strong>Data da Solicitação:</strong> {req?.createdAt?.toDate().toLocaleString('pt-BR')}</p>
                                <p><strong>Prazo de Entrega:</strong> A ser definido com a artesã via WhatsApp.</p>
                            </div>
                            <ConfirmationActions />
                        </CardContent>
                    </Card>
                </div>
            );
        }

        if (pixData) {
            return (
                <div className="max-w-2xl mx-auto p-4">
                    <Card className="border-primary/20 shadow-2xl overflow-hidden">
                        <CardHeader className="text-center bg-primary/5 pb-8"><QrCode className="size-16 text-primary mx-auto mb-4" /><CardTitle className="text-3xl font-headline">Pague com Pix</CardTitle><CardDescription>Escaneie o código ou copie a chave para pagar.</CardDescription></CardHeader>
                        <CardContent className="flex flex-col items-center gap-6 p-8">
                            <div className="bg-white p-4 rounded-xl shadow-inner border border-muted">{pixData.qrCodeBase64 && <Image src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code" width={240} height={240} className="rounded-lg" />}</div>
                            <div className="w-full space-y-3">
                              <Button onClick={() => { navigator.clipboard.writeText(pixData.qr_code); toast({ title: "Copiado!" }); }} className="w-full h-12 text-lg">Copiar Código Pix</Button>
                              <p className="text-xs text-center text-muted-foreground">Após o pagamento, o Mercado Pago nos notificará e seu pedido será atualizado automaticamente.</p>
                            </div>
                            <ConfirmationActions />
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return (
            <div className="max-w-2xl mx-auto p-4">
                <Card className="border-primary/20 shadow-2xl overflow-hidden">
                    <CardHeader className="text-center bg-primary/5 pb-8"><CheckCircle className="size-16 text-primary mx-auto mb-4" /><CardTitle className="text-3xl font-headline">Obrigado!</CardTitle><CardDescription>Seu pedido está sendo processado. Acompanhe o status na área de "Minhas Encomendas".</CardDescription></CardHeader>
                    <CardContent className="p-8">
                        <ConfirmationActions />
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    const pageIsLoading = isAddressesLoading || isCartLoading;

    const renderAddressStep = () => (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleAddressSubmit)} className="space-y-6">
            
            {/* Address Selector */}
            {savedAddresses && savedAddresses.length > 0 && (
              <div className="space-y-2">
                <Label className="text-base font-semibold">Endereço de Entrega</Label>
                <Select value={selectedAddressId} onValueChange={handleSelectAddress}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Selecione ou adicione um endereço" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedAddresses.map(addr => (
                      <SelectItem key={addr.id} value={addr.id}>
                        <div className="flex items-center gap-2">
                          {addr.label.toLowerCase().includes('casa') ? <Home className="size-4" /> : <Briefcase className="size-4" />}
                          {addr.label}
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="_new_">
                      <div className="flex items-center gap-2"><Plus className="size-4" /> Adicionar novo endereço</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
  
            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <FormField control={form.control} name="cpf" render={({ field }) => (<FormItem><FormLabel>CPF</FormLabel><FormControl><Input {...field} placeholder="000.000.000-00" /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Telefone (WhatsApp)</FormLabel><FormControl><Input {...field} placeholder="(11) 99999-9999" /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="zipCode" render={({ field }) => (<FormItem className="col-span-1"><FormLabel>CEP</FormLabel><FormControl><Input {...field} placeholder="00000-000" onBlur={(e) => handleCepBlur(e.target.value)} /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="streetName" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Rua</FormLabel><FormControl><Input {...field} placeholder="Ex: Av. das Flores" /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="streetNumber" render={({ field }) => (<FormItem className="col-span-1"><FormLabel>Número</FormLabel><FormControl><Input {...field} placeholder="123" /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="city" render={({ field }) => (<FormItem className="col-span-1"><FormLabel>Cidade</FormLabel><FormControl><Input {...field} placeholder="Sua Cidade" /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="state" render={({ field }) => (<FormItem className="col-span-1"><FormLabel>UF</FormLabel><FormControl><Input {...field} maxLength={2} placeholder="SP" /></FormControl><FormMessage /></FormItem>)}/>
            </div>
            
            {/* Shipping Options */}
            {checkoutType === 'ready' && (
               <div className="space-y-3 pt-4">
                  <Label>Opções de Entrega</Label>
                  <RadioGroup value={shippingOption} onValueChange={(v) => setShippingOption(v as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {isLocalCity ? (
                          <>
                              <Label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer has-[:checked]:bg-primary/5 has-[:checked]:border-primary">
                                  <RadioGroupItem value="local_delivery" id="local_delivery" />
                                  <div className="grid gap-0.5">
                                      <span className="font-bold flex items-center gap-1.5"><Bike className="size-4" /> Entrega Local</span>
                                      <span className="text-xs text-muted-foreground">Taxa: R$ {LOCAL_DELIVERY_FEE.toFixed(2).replace('.',',')}</span>
                                  </div>
                              </Label>
                               <Label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer has-[:checked]:bg-primary/5 has-[:checked]:border-primary">
                                  <RadioGroupItem value="pickup" id="pickup" />
                                  <div className="grid gap-0.5">
                                      <span className="font-bold flex items-center gap-1.5"><Store className="size-4" /> Retirar no Local</span>
                                      <span className="text-xs text-muted-foreground">Grátis (a combinar)</span>
                                  </div>
                              </Label>
                          </>
                      ) : (
                          <Label className="col-span-full flex items-center gap-3 p-3 border rounded-lg cursor-pointer has-[:checked]:bg-primary/5 has-[:checked]:border-primary">
                              <RadioGroupItem value="mercado_envios" id="mercado_envios" />
                               <div className="grid gap-0.5">
                                  <span className="font-bold flex items-center gap-1.5"><Truck className="size-4" /> Mercado Envios</span>
                                  <span className="text-xs text-muted-foreground">Entrega para todo o Brasil</span>
                              </div>
                          </Label>
                      )}
                  </RadioGroup>
              </div>
            )}
  
            <Button type="submit" disabled={isLoading} className="w-full h-14 text-lg font-bold mt-6 shadow-lg shadow-primary/20">
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : (checkoutType === 'custom' ? 'Solicitar no WhatsApp' : 'Continuar para Pagamento')}
            </Button>
          </form>
        </Form>
      );

    const renderPaymentStep = () => (
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/30">
          <div>
            <span className="text-[10px] font-bold uppercase text-primary tracking-widest flex items-center gap-1">
              <MapPin className="size-3" /> Entregar em
            </span>
            <div className="text-sm mt-2">
              <p className="font-bold text-base">
                {shippingAddress?.streetName}, {shippingAddress?.streetNumber}
              </p>
              <p className="text-muted-foreground">
                {shippingAddress?.city} - {shippingAddress?.state}
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={() => setStep('address')} className="gap-1.5">
            Alterar
            <ChevronsUpDown className="size-4" />
          </Button>
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
                      {cartItems.map((item: any, index) => (
                          <div key={item.id || index} className="flex justify-between items-center text-sm">
                              <div className="flex items-center gap-3">
                                  <div className="size-12 relative rounded overflow-hidden bg-muted"><Image src={item.imageUrl} alt={item.productName} fill className="object-cover" /></div>
                                  <div className="flex flex-col"><span className="font-bold">{item.productName}</span><span className="text-[10px] text-muted-foreground uppercase">{item.selectedSize} | {item.selectedColor}</span></div>
                              </div>
                              <span className="font-bold">R$ {((item.unitPriceAtAddition || item.unitPriceAtOrder) * item.quantity).toFixed(2)}</span>
                          </div>
                      ))}
                      {shippingCost > 0 && (
                          <div className="flex justify-between items-center text-sm border-t pt-2 mt-2">
                             <div className="flex items-center gap-3"><Bike className="size-5 text-muted-foreground" /><span>Taxa de Entrega</span></div>
                             <span className="font-bold">R$ {shippingCost.toFixed(2)}</span>
                          </div>
                      )}
                      <div className="border-t pt-4 flex justify-between font-bold text-xl text-primary"><span>Total</span><span>R$ {finalTotal.toFixed(2)}</span></div>
                  </CardContent>
              </Card>
              <Card className="border-primary/10 bg-primary/5 shadow-sm"><CardHeader className="py-4"><CardTitle className="text-sm uppercase font-bold text-primary flex items-center gap-2"><Truck className="size-4" /> Previsão de Entrega</CardTitle></CardHeader><CardContent className="text-sm space-y-2"><div className="flex items-center gap-2 text-muted-foreground"><Calendar className="size-4" /><span>{checkoutType === 'custom' ? 'Prazo de confecção + ' : ''} {shippingOption === 'mercado_envios' ? 'Chega em aprox. 5 dias úteis' : 'A combinar via WhatsApp'}</span></div><p className="text-[10px] opacity-60">Enviado via {shippingOption === 'mercado_envios' ? 'Entrega Local' : 'Entrega Local'}</p></CardContent></Card>
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

    

    




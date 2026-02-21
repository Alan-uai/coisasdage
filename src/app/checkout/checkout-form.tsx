
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
import { collection, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { QrCode, Loader2, MapPin, ClipboardList, ShoppingBag, ArrowRight, Truck, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';

declare global {
    interface Window {
        MercadoPago: any;
    }
}

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";

export function CheckoutForm({ user, cartItems, subtotal }: { user: User, cartItems: CartItem[], subtotal: number }) {
    const searchParams = useSearchParams();
    const checkoutType = searchParams.get('type') || 'ready';
    
    const [preferenceId, setPreferenceId] = useState<string | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isBrickLoaded, setIsBrickLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pixData, setPixData] = useState<{ qr_code: string, qr_code_base64: string } | null>(null);
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [showAddressForm, setShowAddressForm] = useState(false);
    const brickRendered = useRef(false);
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const addressesQuery = useMemoFirebase(
      () => (user && firestore ? query(collection(firestore, 'users', user.uid, 'addresses'), orderBy('label')) : null),
      [user, firestore]
    );
    const { data: savedAddresses } = useCollection<SavedAddress>(addressesQuery);

    const form = useForm<z.infer<typeof addressSchema>>({
        resolver: zodResolver(addressSchema),
        defaultValues: { cpf: '', streetName: '', streetNumber: '', zipCode: '', city: '', state: '' },
    });

    useEffect(() => {
      if (savedAddresses && savedAddresses.length > 0 && !selectedAddressId) {
        const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
          setShowAddressForm(false);
          form.reset({
            cpf: defaultAddr.cpf,
            streetName: defaultAddr.streetName,
            streetNumber: defaultAddr.streetNumber,
            zipCode: defaultAddr.zipCode,
            city: defaultAddr.city,
            state: defaultAddr.state,
          });
        }
      } else if (savedAddresses && savedAddresses.length === 0) {
        setShowAddressForm(true);
      }
    }, [savedAddresses, form, selectedAddressId]);

    const handleSelectAddress = (id: string) => {
      const addr = savedAddresses?.find(a => a.id === id);
      if (addr) {
        setSelectedAddressId(id);
        setShowAddressForm(false);
        form.reset({
          cpf: addr.cpf,
          streetName: addr.streetName,
          streetNumber: addr.streetNumber,
          zipCode: addr.zipCode,
          city: addr.city,
          state: addr.state,
        });
      }
    };

    const clearPaidCartItems = useCallback(() => {
        if (!user || !firestore || cartItems.length === 0) return;
        cartItems.forEach(item => {
            const itemRef = doc(firestore, 'users', user.uid, 'carts', 'main', 'items', item.id);
            deleteDocumentNonBlocking(itemRef);
        });
    }, [user, firestore, cartItems]);

    // Simulação de estimativa de frete
    const shippingEstimate = useMemo(() => {
      // Em produção aqui chamaria uma API de frete
      return { days: 5, label: "Expresso (Mercado Envios)" };
    }, []);

    async function onSubmit(values: z.infer<typeof addressSchema>) {
        if (!user || cartItems.length === 0 || !user.email || !firestore) return;
        
        setIsLoading(true);
        setError(null);

        try {
            if (checkoutType === 'custom') {
                const requestsRef = collection(firestore, 'users', user.uid, 'custom_requests');
                const newRequestRef = doc(requestsRef);
                const generatedRequestId = newRequestRef.id;

                await setDocumentNonBlocking(newRequestRef, {
                    userId: user.uid,
                    userName: user.displayName || 'Cliente',
                    userEmail: user.email,
                    status: 'Pending',
                    totalBasePrice: subtotal,
                    shippingAddress: values,
                    items: cartItems.map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        imageUrl: item.imageUrl,
                        quantity: item.quantity,
                        unitPriceAtOrder: item.unitPriceAtAddition,
                        selectedSize: item.selectedSize,
                        selectedColor: item.selectedColor,
                        selectedMaterial: item.selectedMaterial,
                    })),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                }, { merge: true });

                await notifyAdminNewRequest(generatedRequestId, user.displayName || 'Cliente', cartItems[0].productName);
                clearPaidCartItems();

                const message = `Olá Gê! Acabei de solicitar um orçamento pelo site das peças: *${cartItems.map(i => i.productName).join(', ')}*. Aguardo seu retorno!`;
                window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
                return;
            }

            const ordersRef = collection(firestore, 'users', user.uid, 'orders');
            const newOrderRef = doc(ordersRef);
            const generatedOrderId = newOrderRef.id;
            setOrderId(generatedOrderId);

            setDocumentNonBlocking(newOrderRef, {
                userId: user.uid,
                orderDate: serverTimestamp(),
                totalAmount: subtotal,
                status: 'Processing',
                shippingAddress: values,
                items: cartItems.map(item => ({
                    productId: item.productId,
                    productGroupId: item.productGroupId,
                    productName: item.productName,
                    imageUrl: item.imageUrl,
                    quantity: item.quantity,
                    unitPriceAtOrder: item.unitPriceAtAddition,
                    selectedSize: item.selectedSize,
                    selectedColor: item.selectedColor,
                    selectedMaterial: item.selectedMaterial,
                })),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }, { merge: true });

            const result = await createPreference(user.uid, user.email, user.displayName, cartItems, values, generatedOrderId);
            if (result.preferenceId) setPreferenceId(result.preferenceId);
            else setError(result.error || 'Erro ao iniciar pagamento.');
        } catch (e: any) {
            setError('Erro inesperado.');
        } finally {
            setIsLoading(false);
        }
    }

    const handlePaymentSubmit = useCallback(async (paymentData: any) => {
        if (!orderId || !user.email || !firestore) return;
        try {
            const finalPaymentData = paymentData.formData || paymentData;
            const result = await processPayment(finalPaymentData, orderId, user.email, subtotal);
            if (result.success) {
                clearPaidCartItems();
                if (result.payment_id) {
                    const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
                    updateDocumentNonBlocking(orderRef, { 
                        paymentId: result.payment_id,
                        merchantOrderId: result.merchant_order_id || null,
                        status: result.status === 'approved' ? 'Crafting' : 'Processing',
                        updatedAt: serverTimestamp(),
                    });
                }
                if (finalPaymentData.payment_method_id === 'pix' && result.qr_code) {
                    setPixData({ qr_code: result.qr_code, qr_code_base64: result.qr_code_base64 || '' });
                } else {
                    router.push(`/payment-status?status=${result.status === 'approved' ? 'success' : 'pending'}&order_id=${orderId}`);
                }
            } else setError(result.error || 'Erro no pagamento.');
        } catch (e) {
            setError('Erro ao finalizar.');
        }
    }, [orderId, user.email, firestore, router, subtotal, clearPaidCartItems]);

    useEffect(() => {
        if (preferenceId && !pixData && !brickRendered.current) {
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
    }, [preferenceId, pixData, subtotal, handlePaymentSubmit, user.email]);

    if (pixData) {
        return (
            <div className="max-w-2xl mx-auto p-4">
                <Card className="border-primary/20 shadow-2xl">
                    <CardHeader className="text-center">
                        <QrCode className="size-16 text-primary mx-auto mb-4" />
                        <CardTitle className="text-3xl font-headline">Pague com Pix</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-6">
                        {pixData.qr_code_base64 && <Image src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code" width={240} height={240} />}
                        <Button onClick={() => { navigator.clipboard.writeText(pixData.qr_code); toast({ title: "Copiado!" }); }} className="w-full">Copiar Código Pix</Button>
                        <Button asChild variant="outline" className="w-full"><Link href="/orders">Ver Meus Pedidos</Link></Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const currentAddress = savedAddresses?.find(a => a.id === selectedAddressId);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto p-4">
            <div className="space-y-6">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl flex items-center gap-2">
                            {checkoutType === 'custom' ? <ClipboardList className="size-6 text-primary" /> : <ShoppingBag className="size-6 text-primary" />}
                            Resumo
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {cartItems.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-3">
                                    <Image src={item.imageUrl} alt={item.productName} width={40} height={40} className="rounded object-cover" />
                                    <span>{item.productName} (x{item.quantity})</span>
                                </div>
                                <span className="font-bold">R$ {(item.unitPriceAtAddition * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                        <div className="border-t pt-4 flex justify-between font-bold text-xl text-primary">
                            <span>Total</span>
                            <span>R$ {subtotal.toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>

                {currentAddress && !showAddressForm && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="py-4">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm uppercase font-bold text-primary flex items-center gap-2">
                          <Truck className="size-4" /> Previsão de Entrega
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="size-4" />
                        <span>{checkoutType === 'custom' ? 'Prazo de confecção + ' : ''} Chega em aprox. {shippingEstimate.days} dias úteis</span>
                      </div>
                      <p className="text-[10px] opacity-60">Enviado via {shippingEstimate.label}</p>
                    </CardContent>
                  </Card>
                )}
            </div>
            
            <Card className="shadow-lg min-h-[500px]">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Dados de Entrega</CardTitle>
                    {error && <div className="bg-destructive/10 text-destructive p-3 rounded text-xs mt-2">{error}</div>}
                </CardHeader>
                <CardContent>
                    {preferenceId ? (
                        <div id="paymentCard" className={cn("transition-opacity duration-300", !isBrickLoaded && "opacity-0")} />
                    ) : (
                        <div className="space-y-6">
                            {!showAddressForm && currentAddress ? (
                                <div className="space-y-4">
                                    <div className="p-4 border rounded-lg bg-primary/5 flex items-start gap-4 relative group">
                                        <MapPin className="size-5 text-primary mt-1" />
                                        <div className="text-sm flex-1">
                                            <p className="font-bold">{currentAddress.label}</p>
                                            <p className="text-muted-foreground">{currentAddress.streetName}, {currentAddress.streetNumber}</p>
                                            <p className="text-muted-foreground">{currentAddress.city} - {currentAddress.state}</p>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setShowAddressForm(true)} className="h-7 text-xs">Trocar</Button>
                                    </div>
                                    <Button onClick={form.handleSubmit(onSubmit)} disabled={isLoading} className="w-full h-14 text-lg font-bold">
                                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : checkoutType === 'custom' ? 'Solicitar no WhatsApp' : 'Ir para Pagamento'}
                                        <ArrowRight className="ml-2 size-5" />
                                    </Button>
                                </div>
                            ) : (
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                        {savedAddresses && savedAddresses.length > 0 && (
                                            <div className="space-y-2 mb-4">
                                                <Label className="text-xs font-bold text-muted-foreground">Escolher Endereço Salvo</Label>
                                                <Select value={selectedAddressId} onValueChange={handleSelectAddress}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {savedAddresses.map(addr => <SelectItem key={addr.id} value={addr.id}>{addr.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                        <FormField control={form.control} name="cpf" render={({ field }) => (<FormItem><FormLabel>CPF</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={form.control} name="zipCode" render={({ field }) => (<FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                            <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>UF</FormLabel><FormControl><Input {...field} maxLength={2} /></FormControl><FormMessage /></FormItem>)}/>
                                        </div>
                                        <FormField control={form.control} name="streetName" render={({ field }) => (<FormItem><FormLabel>Rua</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={form.control} name="streetNumber" render={({ field }) => (<FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                            <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                        </div>
                                        <Button type="submit" disabled={isLoading} className="w-full h-12">Confirmar</Button>
                                        {savedAddresses && savedAddresses.length > 0 && <Button type="button" variant="ghost" onClick={() => setShowAddressForm(false)} className="w-full">Cancelar</Button>}
                                    </form>
                                </Form>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

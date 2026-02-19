'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { User } from 'firebase/auth';
import { createPreference, processPayment, type PreferenceCartItem } from './actions';
import type { CartItem } from '@/lib/types';
import { addressSchema } from './form-schema';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Copy, AlertCircle, QrCode, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';

declare global {
    interface Window {
        MercadoPago: any;
    }
}

export function CheckoutForm({ user, cartItems, subtotal }: { user: User, cartItems: CartItem[], subtotal: number }) {
    const [preferenceId, setPreferenceId] = useState<string | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [paymentId, setPaymentId] = useState<number | null>(null);
    const [merchantOrderId, setMerchantOrderId] = useState<number | string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isBrickLoaded, setIsBrickLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pixData, setPixData] = useState<{ qr_code: string, qr_code_base64: string } | null>(null);
    const brickRendered = useRef(false);
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof addressSchema>>({
        resolver: zodResolver(addressSchema),
        defaultValues: {
            cpf: '',
            streetName: '',
            streetNumber: '',
            zipCode: '',
            city: '',
            state: '',
        },
    });

    async function onSubmit(values: z.infer<typeof addressSchema>) {
        if (!user || cartItems.length === 0 || !user.email || !firestore) {
            setError('Sessão encerrada ou dados insuficientes.');
            return;
        }
        
        setIsLoading(true);
        setError(null);

        try {
            const serializableCartItems: PreferenceCartItem[] = cartItems.map(item => ({
                id: item.id,
                productName: item.productName,
                selectedColor: item.selectedColor,
                selectedSize: item.selectedSize,
                selectedMaterial: item.selectedMaterial,
                quantity: item.quantity,
                unitPriceAtAddition: item.unitPriceAtAddition,
                imageUrl: item.imageUrl,
            }));

            const ordersRef = collection(firestore, 'users', user.uid, 'orders');
            const newOrderRef = doc(ordersRef);
            const generatedOrderId = newOrderRef.id;
            setOrderId(generatedOrderId);

            const orderData = {
                userId: user.uid,
                orderDate: serverTimestamp(),
                totalAmount: subtotal,
                status: 'Processing',
                shippingAddress: values,
                items: serializableCartItems.map(item => ({
                    productId: item.id,
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
            };

            setDocumentNonBlocking(newOrderRef, orderData, { merge: true });

            const result = await createPreference(
                user.uid, 
                user.email, 
                user.displayName, 
                serializableCartItems, 
                values, 
                generatedOrderId
            );

            if (result.preferenceId) {
                setPreferenceId(result.preferenceId);
            } else {
                setError(result.error || 'Não foi possível iniciar o pagamento.');
            }
        } catch (e: any) {
            console.error('Checkout creation error:', e);
            setError('Erro inesperado ao preparar seu pedido.');
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
                if (result.payment_id) {
                    setPaymentId(result.payment_id);
                    setMerchantOrderId(result.merchant_order_id || null);
                    
                    const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
                    updateDocumentNonBlocking(orderRef, { 
                        paymentId: result.payment_id,
                        merchantOrderId: result.merchant_order_id || null,
                        status: result.status === 'approved' ? 'Crafting' : 'Processing',
                        updatedAt: serverTimestamp(),
                    });
                }

                if (finalPaymentData.payment_method_id === 'pix' && result.qr_code) {
                    setPixData({
                        qr_code: result.qr_code,
                        qr_code_base64: result.qr_code_base64 || '',
                    });
                } else if (result.status === 'approved') {
                    router.push(`/payment-status?status=success&order_id=${orderId}&payment_id=${result.payment_id}&merchant_order_id=${result.merchant_order_id}`);
                } else {
                    router.push(`/payment-status?status=pending&order_id=${orderId}&payment_id=${result.payment_id}&merchant_order_id=${result.merchant_order_id}`);
                }
            } else {
                setError(result.error || 'Erro ao processar pagamento.');
            }
        } catch (e) {
            console.error('Payment processing error:', e);
            setError('Erro ao finalizar o pagamento.');
        }
    }, [orderId, user.email, firestore, router, subtotal]);

    useEffect(() => {
        if (preferenceId && !pixData && !brickRendered.current) {
            const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
            if (!publicKey) {
                setError('Public Key do Mercado Pago não encontrada.');
                return;
            }

            if ((window as any).MercadoPago) {
                brickRendered.current = true;
                const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' });
                const bricksBuilder = mp.bricks();
                
                bricksBuilder.create('payment', 'paymentCard', {
                    initialization: {
                        amount: subtotal,
                        preferenceId: preferenceId,
                        payer: { email: user.email }
                    },
                    customization: {
                        paymentMethods: {
                            ticket: 'all',
                            bankTransfer: ['pix'],
                            creditCard: 'all',
                        },
                    },
                    callbacks: {
                        onReady: () => setIsBrickLoaded(true),
                        onSubmit: (param: any) => handlePaymentSubmit(param),
                        onError: (error: any) => setError(`Erro no módulo de pagamento: ${error.message}`),
                    },
                });
            }
        }
    }, [preferenceId, pixData, subtotal, handlePaymentSubmit, user.email]);

    const copyPixCode = () => {
        if (pixData?.qr_code) {
            navigator.clipboard.writeText(pixData.qr_code);
            toast({ title: "Código Copiado!" });
        }
    };

    if (pixData) {
        return (
            <div className="max-w-2xl mx-auto p-4">
                <Card className="border-primary/20 shadow-2xl">
                    <CardHeader className="text-center">
                        <QrCode className="size-16 text-primary mx-auto mb-4" />
                        <CardTitle className="text-3xl font-bold font-headline">Pague com Pix</CardTitle>
                        <CardDescription>Escaneie o QR Code ou copie o código abaixo.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 flex flex-col items-center">
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm w-full">
                            <div className="flex items-center gap-2 font-bold mb-2">
                                <Info className="size-5" />
                                <span>Dados para Homologação (Go Live)</span>
                            </div>
                            {paymentId && <p><strong>ID do Pagamento:</strong> {paymentId}</p>}
                            {merchantOrderId && <p><strong>Merchant Order ID (ORD...):</strong> {merchantOrderId}</p>}
                            <p className="text-xs italic mt-2">Use o Merchant Order ID para o formulário do Mercado Pago.</p>
                        </div>

                        {pixData.qr_code_base64 && (
                            <Image src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code" width={240} height={240} className="rounded-lg shadow-lg" />
                        )}
                        
                        <div className="w-full space-y-2">
                            <div className="flex gap-2">
                                <Input value={pixData.qr_code} readOnly className="font-mono text-xs" />
                                <Button onClick={copyPixCode}><Copy className="size-4 mr-2" /> Copiar</Button>
                            </div>
                        </div>

                        <div className="flex gap-4 w-full">
                            <Button asChild variant="outline" className="flex-1"><Link href="/">Início</Link></Button>
                            <Button asChild className="flex-1"><Link href="/orders">Ver Pedidos</Link></Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto p-4">
            <Card className="shadow-lg">
                <CardHeader><CardTitle className="font-headline text-2xl">Resumo do Pedido</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {cartItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="relative size-12 overflow-hidden rounded bg-muted">
                                    <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                                </div>
                                <span className="font-medium">{item.productName} (x{item.quantity})</span>
                            </div>
                            <span className="font-bold">R$ {(item.unitPriceAtAddition * item.quantity).toFixed(2).replace('.', ',')}</span>
                        </div>
                    ))}
                    <div className="border-t pt-4 flex justify-between font-bold text-xl text-primary">
                        <span>Total</span>
                        <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                </CardContent>
            </Card>
            
            <Card className="shadow-lg overflow-hidden min-h-[400px]">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Pagamento</CardTitle>
                    {error && <div className="bg-destructive/10 text-destructive p-3 rounded text-sm mt-2">{error}</div>}
                </CardHeader>
                <CardContent className="relative">
                    {!preferenceId ? (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField control={form.control} name="cpf" render={({ field }) => (
                                    <FormItem><FormLabel>CPF</FormLabel><FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="zipCode" render={({ field }) => (
                                        <FormItem><FormLabel>CEP</FormLabel><FormControl><Input placeholder="00000-000" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={form.control} name="state" render={({ field }) => (
                                        <FormItem><FormLabel>UF</FormLabel><FormControl><Input placeholder="SP" {...field} maxLength={2} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                </div>
                                <FormField control={form.control} name="streetName" render={({ field }) => (
                                    <FormItem><FormLabel>Rua</FormLabel><FormControl><Input placeholder="Endereço" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="streetNumber" render={({ field }) => (
                                        <FormItem><FormLabel>Número</FormLabel><FormControl><Input placeholder="123" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={form.control} name="city" render={({ field }) => (
                                        <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input placeholder="Sua cidade" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                </div>
                                <Button type="submit" disabled={isLoading} className="w-full h-12 text-lg">
                                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : 'Continuar para Pagamento'}
                                </Button>
                            </form>
                        </Form>
                    ) : (
                        <div>
                            {!isBrickLoaded && (
                                <div className="absolute inset-0 bg-card flex flex-col items-center justify-center space-y-4">
                                    <Loader2 className="animate-spin text-primary size-10" />
                                    <p className="text-muted-foreground">Carregando Mercado Pago...</p>
                                </div>
                            )}
                            <div id="paymentCard" className={cn("transition-opacity duration-300", !isBrickLoaded ? "opacity-0" : "opacity-100")} />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

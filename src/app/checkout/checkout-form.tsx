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
import { CheckCircle2, Copy, AlertCircle, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

declare global {
    interface window {
        MercadoPago: any;
    }
}

export function CheckoutForm({ user, cartItems, subtotal }: { user: User, cartItems: CartItem[], subtotal: number }) {
    const [preferenceId, setPreferenceId] = useState<string | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
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

            // Create order in Firestore first
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

            // Call server action to create preference
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

    const handlePaymentSubmit = useCallback(async (formData: any) => {
        if (!orderId || !user.email || !firestore) return;

        try {
            const result = await processPayment(formData, orderId, user.email);

            if (result.success) {
                if (result.payment_id) {
                    const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
                    updateDocumentNonBlocking(orderRef, { 
                        paymentId: result.payment_id,
                        status: result.status === 'approved' ? 'Crafting' : 'Processing',
                        updatedAt: serverTimestamp(),
                    });
                }

                if (formData.payment_method_id === 'pix' && result.qr_code) {
                    setPixData({
                        qr_code: result.qr_code,
                        qr_code_base64: result.qr_code_base64 || '',
                    });
                } else if (result.status === 'approved') {
                    router.push(`/payment-status?status=success&order_id=${orderId}`);
                } else {
                    router.push(`/payment-status?status=pending&order_id=${orderId}`);
                }
            } else {
                setError(result.error || 'Erro ao processar pagamento.');
            }
        } catch (e) {
            console.error('Payment processing error:', e);
            setError('Erro ao finalizar o pagamento.');
        }
    }, [orderId, user.email, firestore, router]);

    useEffect(() => {
        if (preferenceId && !pixData && !brickRendered.current) {
            const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
            if (!publicKey) {
                setError('Public Key do Mercado Pago não encontrada no .env.');
                return;
            }

            if ((window as any).MercadoPago) {
                brickRendered.current = true;
                const mp = new (window as any).MercadoPago(publicKey, {
                    locale: 'pt-BR'
                });
                
                const bricksBuilder = mp.bricks();
                
                bricksBuilder.create('payment', 'paymentCard', {
                    initialization: {
                        amount: subtotal,
                        preferenceId: preferenceId,
                    },
                    customization: {
                        paymentMethods: {
                            ticket: 'all',
                            bankTransfer: ['pix'],
                            creditCard: 'all',
                            debitCard: 'all',
                        },
                    },
                    callbacks: {
                        onReady: () => {
                            console.log('Payment Brick ready');
                        },
                        onSubmit: (formData: any) => {
                            return handlePaymentSubmit(formData);
                        },
                        onError: (error: any) => {
                            console.error('Brick error:', error);
                            setError('Erro ao carregar o módulo de pagamento.');
                        },
                    },
                });
            } else {
                setError('O script do Mercado Pago não foi carregado corretamente.');
            }
        }
    }, [preferenceId, pixData, subtotal, handlePaymentSubmit]);

    const copyPixCode = () => {
        if (pixData?.qr_code) {
            navigator.clipboard.writeText(pixData.qr_code);
            toast({
                title: "Código Copiado!",
                description: "Cole no seu aplicativo do banco para pagar.",
            });
        }
    };

    if (pixData) {
        return (
            <Card className="max-w-xl mx-auto border-primary/20 shadow-2xl">
                <CardHeader className="text-center">
                    <QrCode className="size-16 text-primary mx-auto mb-4" />
                    <CardTitle className="text-2xl font-bold font-headline">Pague com Pix</CardTitle>
                    <CardDescription>Escaneie o QR Code ou use o código Copia e Cola.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 flex flex-col items-center">
                    {pixData.qr_code_base64 && (
                        <div className="bg-white p-4 rounded-xl shadow-inner border">
                            <Image 
                                src={`data:image/png;base64,${pixData.qr_code_base64}`} 
                                alt="QR Code Pix" 
                                width={250} 
                                height={250} 
                            />
                        </div>
                    )}
                    <div className="w-full space-y-2">
                        <p className="text-sm font-semibold text-muted-foreground uppercase text-center">Código Pix</p>
                        <div className="flex gap-2">
                            <Input value={pixData.qr_code} readOnly className="font-mono text-xs" />
                            <Button variant="outline" size="icon" onClick={copyPixCode}>
                                <Copy className="size-4" />
                            </Button>
                        </div>
                    </div>
                    <Button asChild className="w-full">
                        <Link href="/orders">Acompanhar Pedido</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start max-w-6xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Seu Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {cartItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-3">
                                <div className="relative size-12 overflow-hidden rounded-md border">
                                    <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                                </div>
                                <span>{item.productName} (x{item.quantity})</span>
                            </div>
                            <span className="font-semibold">R$ {(item.unitPriceAtAddition * item.quantity).toFixed(2).replace('.', ',')}</span>
                        </div>
                    ))}
                    <div className="h-px bg-border w-full my-4" />
                    <div className="flex justify-between font-bold text-xl text-primary">
                        <span>Total</span>
                        <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Dados de Entrega e Pagamento</CardTitle>
                    {error && (
                        <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2 text-xs mt-2">
                            <AlertCircle className="size-4 shrink-0" />
                            {error}
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    {!preferenceId ? (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField control={form.control} name="cpf" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CPF</FormLabel>
                                        <FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="zipCode" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>CEP</FormLabel>
                                            <FormControl><Input placeholder="00000-000" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <FormField control={form.control} name="state" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>UF</FormLabel>
                                            <FormControl><Input placeholder="SP" {...field} maxLength={2} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                </div>
                                <FormField control={form.control} name="streetName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Rua / Endereço</FormLabel>
                                        <FormControl><Input placeholder="Ex: Av. Brasil" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="streetNumber" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Número</FormLabel>
                                            <FormControl><Input placeholder="123" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <FormField control={form.control} name="city" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cidade</FormLabel>
                                            <FormControl><Input placeholder="Sua cidade" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                </div>
                                <Button type="submit" disabled={isLoading} className="w-full h-12 text-lg">
                                    {isLoading ? 'Aguarde...' : 'Escolher Forma de Pagamento'}
                                </Button>
                            </form>
                        </Form>
                    ) : (
                        <div id="paymentCard" className="min-h-[400px]">
                            <div className="flex flex-col items-center justify-center h-full space-y-4 py-20">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-40 w-full" />
                                <p className="text-sm text-muted-foreground animate-pulse">Carregando Mercado Pago...</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

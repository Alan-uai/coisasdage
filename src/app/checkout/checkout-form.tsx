'use client';
import { useEffect, useState, useCallback } from 'react';
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
import { CheckCircle2, Copy, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

declare global {
    interface Window {
        MercadoPago: any;
    }
}

export function CheckoutForm({ user, cartItems, subtotal }: { user: User, cartItems: CartItem[], subtotal: number }) {
    const [preferenceId, setPreferenceId] = useState<string | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pixData, setPixData] = useState<{ qr_code: string, qr_code_base64: string } | null>(null);
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
            setError('Usuário não autenticado ou erro no banco de dados.');
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
                setError(result.error || 'Erro ao preparar o pagamento.');
            }
        } catch (e: any) {
            console.error('Checkout error:', e);
            setError('Erro ao processar seu pedido.');
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
            setError('Erro inesperado no pagamento.');
        }
    }, [orderId, user.email, firestore, router]);

    useEffect(() => {
        if (preferenceId && !pixData) {
            const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
            if (!publicKey) {
                setError('Public Key do Mercado Pago não configurada.');
                return;
            }

            if (window.MercadoPago) {
                const mp = new window.MercadoPago(publicKey, {
                    locale: 'pt-BR'
                });
                
                const container = document.getElementById('paymentCard');
                if (container) container.innerHTML = '';

                mp.bricks().create('payment', 'paymentCard', {
                    initialization: {
                        amount: subtotal,
                        preferenceId: preferenceId,
                    },
                    customization: {
                        paymentMethods: {
                            ticket: 'all',
                            bankTransfer: 'all',
                            creditCard: 'all',
                            debitCard: 'all',
                            mercadoPago: 'all',
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
                            setError('Erro ao carregar opções de pagamento.');
                        },
                    },
                });
            } else {
                setError('SDK do Mercado Pago não encontrado.');
            }
        }
    }, [preferenceId, pixData, subtotal, handlePaymentSubmit]);

    const copyPixCode = () => {
        if (pixData?.qr_code) {
            navigator.clipboard.writeText(pixData.qr_code);
            toast({
                title: "Código Copiado!",
                description: "Agora é só colar no aplicativo do seu banco.",
            });
        }
    };

    if (pixData) {
        return (
            <Card className="max-w-2xl mx-auto">
                <CardHeader className="text-center">
                    <CheckCircle2 className="size-16 text-green-500 mx-auto mb-4" />
                    <CardTitle className="text-2xl font-bold font-headline">Pedido Recebido!</CardTitle>
                    <CardDescription>Pague com Pix para que possamos iniciar a produção artesanal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 flex flex-col items-center">
                    {pixData.qr_code_base64 && (
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                            <Image 
                                src={`data:image/png;base64,${pixData.qr_code_base64}`} 
                                alt="QR Code Pix" 
                                width={200} 
                                height={200} 
                            />
                        </div>
                    )}
                    <div className="w-full space-y-2">
                        <p className="text-sm font-semibold text-center">Código Pix (Copia e Cola)</p>
                        <div className="flex gap-2">
                            <Input value={pixData.qr_code} readOnly className="font-mono text-xs" />
                            <Button variant="outline" size="icon" onClick={copyPixCode}>
                                <Copy className="size-4" />
                            </Button>
                        </div>
                    </div>
                    <Button asChild className="w-full">
                        <Link href="/orders">Ver meus pedidos</Link>
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                        Após o pagamento, seu pedido entrará em produção automaticamente.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <Card>
                <CardHeader>
                    <CardTitle>Resumo da Compra</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {cartItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <Image src={item.imageUrl} alt={item.productName} width={64} height={64} className="rounded-md" />
                                <div>
                                    <p className="font-semibold">{item.productName} <span className="text-sm">x{item.quantity}</span></p>
                                    <p className="text-sm text-muted-foreground">{item.selectedColor} / {item.selectedSize}</p>
                                </div>
                            </div>
                            <p>R$ {(item.unitPriceAtAddition * item.quantity).toFixed(2).replace('.', ',')}</p>
                        </div>
                    ))}
                    <div className="flex justify-between font-bold text-lg pt-4 border-t">
                        <span>Total</span>
                        <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Pagamento e Entrega</CardTitle>
                    {error && (
                        <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2 text-sm">
                            <AlertCircle className="size-4" />
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
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <FormField control={form.control} name="streetName" render={({ field }) => (
                                        <FormItem className="sm:col-span-2">
                                            <FormLabel>Rua</FormLabel>
                                            <FormControl><Input placeholder="Nome da sua rua" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <FormField control={form.control} name="streetNumber" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Número</FormLabel>
                                            <FormControl><Input placeholder="123" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                </div>
                                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <FormField control={form.control} name="zipCode" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>CEP</FormLabel>
                                            <FormControl><Input placeholder="00000-000" {...field} /></FormControl>
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
                                     <FormField control={form.control} name="state" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Estado</FormLabel>
                                            <FormControl><Input placeholder="UF" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                </div>
                                <Button type="submit" disabled={isLoading} size="lg" className="w-full">
                                    {isLoading ? 'Processando...' : 'Ir para Pagamento'}
                                </Button>
                            </form>
                        </Form>
                    ) : (
                        <div id="paymentCard" className="min-h-[400px]">
                            {/* Mercado Pago Payment Brick renders here */}
                            <div className="space-y-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-48 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

import Link from 'next/link';

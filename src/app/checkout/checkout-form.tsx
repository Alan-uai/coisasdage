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
            console.error('Payment error:', e);
            setError('Erro inesperado no pagamento.');
        }
    }, [orderId, user.email, firestore, router]);

    useEffect(() => {
        if (preferenceId && !pixData && !brickRendered.current) {
            const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
            if (!publicKey) {
                setError('Public Key do Mercado Pago não configurada no frontend.');
                return;
            }

            if (window.MercadoPago) {
                brickRendered.current = true;
                const mp = new window.MercadoPago(publicKey, {
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
                            setError('Erro ao carregar opções de pagamento.');
                        },
                    },
                });
            } else {
                setError('SDK do Mercado Pago não encontrado. Verifique sua conexão.');
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
            <Card className="max-w-2xl mx-auto border-primary/20 shadow-xl">
                <CardHeader className="text-center">
                    <QrCode className="size-16 text-primary mx-auto mb-4" />
                    <CardTitle className="text-2xl font-bold font-headline">Quase lá!</CardTitle>
                    <CardDescription>Pague com Pix para confirmarmos seu pedido e iniciarmos a produção.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 flex flex-col items-center">
                    {pixData.qr_code_base64 && (
                        <div className="bg-white p-4 rounded-xl shadow-inner border-2 border-primary/10">
                            <Image 
                                src={`data:image/png;base64,${pixData.qr_code_base64}`} 
                                alt="QR Code Pix" 
                                width={240} 
                                height={240} 
                                className="rounded-sm"
                            />
                        </div>
                    )}
                    <div className="w-full space-y-3">
                        <p className="text-sm font-semibold text-center text-muted-foreground uppercase tracking-wider">Código Pix (Copia e Cola)</p>
                        <div className="flex gap-2">
                            <Input value={pixData.qr_code} readOnly className="font-mono text-xs bg-muted/50" />
                            <Button variant="default" size="icon" onClick={copyPixCode} className="shrink-0">
                                <Copy className="size-4" />
                            </Button>
                        </div>
                    </div>
                    <Separator />
                    <div className="flex flex-col gap-3 w-full">
                        <Button asChild variant="outline" className="w-full">
                            <Link href="/orders">Ver Detalhes do Pedido</Link>
                        </Button>
                        <p className="text-xs text-muted-foreground text-center px-8">
                            O status do seu pedido será atualizado automaticamente assim que o pagamento for confirmado.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start max-w-6xl mx-auto">
            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="font-headline">Resumo da Compra</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {cartItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center group">
                            <div className="flex items-center gap-4">
                                <div className="relative size-16 overflow-hidden rounded-md border">
                                    <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                                </div>
                                <div>
                                    <p className="font-semibold">{item.productName} <span className="text-sm text-muted-foreground ml-1">x{item.quantity}</span></p>
                                    <p className="text-xs text-muted-foreground">{item.selectedColor} / {item.selectedSize}</p>
                                </div>
                            </div>
                            <p className="font-medium">R$ {(item.unitPriceAtAddition * item.quantity).toFixed(2).replace('.', ',')}</p>
                        </div>
                    ))}
                    <Separator className="my-4" />
                    <div className="flex justify-between font-bold text-xl text-primary">
                        <span>Total</span>
                        <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                </CardContent>
            </Card>
            
            <Card className="shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="font-headline">Pagamento e Entrega</CardTitle>
                    {error && (
                        <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2 text-sm mt-2 animate-in fade-in slide-in-from-top-1">
                            <AlertCircle className="size-4 shrink-0" />
                            {error}
                        </div>
                    )}
                </CardHeader>
                <CardContent className="pt-6">
                    {!preferenceId ? (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField control={form.control} name="cpf" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CPF do Comprador</FormLabel>
                                        <FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <FormField control={form.control} name="streetName" render={({ field }) => (
                                        <FormItem className="sm:col-span-2">
                                            <FormLabel>Endereço / Rua</FormLabel>
                                            <FormControl><Input placeholder="Ex: Av. Paulista" {...field} /></FormControl>
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
                                            <FormLabel>UF</FormLabel>
                                            <FormControl><Input placeholder="SP" {...field} maxLength={2} className="uppercase" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                </div>
                                <Button type="submit" disabled={isLoading} size="lg" className="w-full text-lg h-12 shadow-lg hover:shadow-xl transition-all">
                                    {isLoading ? 'Processando...' : 'Escolher Forma de Pagamento'}
                                </Button>
                            </form>
                        </Form>
                    ) : (
                        <div id="paymentCard" className="min-h-[500px] animate-in fade-in zoom-in-95 duration-500">
                            {/* Mercado Pago Payment Brick renders here */}
                            <div className="flex flex-col items-center justify-center h-full space-y-4 py-12">
                                <Skeleton className="h-10 w-full rounded-md" />
                                <Skeleton className="h-64 w-full rounded-md" />
                                <Skeleton className="h-10 w-full rounded-md" />
                                <p className="text-sm text-muted-foreground">Carregando opções seguras do Mercado Pago...</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

const Separator = () => <div className="h-px bg-border w-full my-4" />;


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
                    const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
                    updateDocumentNonBlocking(orderRef, { 
                        paymentId: result.payment_id,
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
                    router.push(`/payment-status?status=success&order_id=${orderId}&payment_id=${result.payment_id}`);
                } else {
                    router.push(`/payment-status?status=pending&order_id=${orderId}&payment_id=${result.payment_id}`);
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
                setError('Public Key do Mercado Pago não encontrada no sistema.');
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
                        payer: {
                            email: user.email,
                        }
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
                            setIsBrickLoaded(true);
                        },
                        onSubmit: (param: any) => {
                            return handlePaymentSubmit(param);
                        },
                        onError: (error: any) => {
                            console.error('Brick error:', error);
                            setError(`Erro no módulo de pagamento: ${error.message || 'Verifique suas chaves.'}`);
                        },
                    },
                });
            } else {
                setError('O script do Mercado Pago não pôde ser carregado.');
            }
        }
    }, [preferenceId, pixData, subtotal, handlePaymentSubmit, user.email]);

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
            <div className="max-w-2xl mx-auto p-4">
                <Card className="border-primary/20 shadow-2xl bg-card">
                    <CardHeader className="text-center">
                        <div className="bg-primary/10 size-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <QrCode className="size-12 text-primary" />
                        </div>
                        <CardTitle className="text-3xl font-bold font-headline">Pague com Pix</CardTitle>
                        <CardDescription className="text-lg">
                            Escaneie o QR Code abaixo com o app do seu banco para finalizar a compra.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8 flex flex-col items-center">
                        {paymentId && (
                            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-center gap-3 text-blue-800 text-sm w-full">
                                <Info className="size-5 shrink-0" />
                                <p><strong>ID do Pagamento para Homologação:</strong> {paymentId}</p>
                            </div>
                        )}

                        {pixData.qr_code_base64 && (
                            <div className="bg-white p-6 rounded-2xl shadow-xl border-4 border-primary/20">
                                <Image 
                                    src={`data:image/png;base64,${pixData.qr_code_base64}`} 
                                    alt="QR Code Pix" 
                                    width={280} 
                                    height={280} 
                                    className="rounded-lg"
                                />
                            </div>
                        )}
                        
                        <div className="w-full space-y-3 bg-muted p-6 rounded-xl">
                            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider text-center">Pix Copia e Cola</p>
                            <div className="flex gap-2">
                                <Input 
                                    value={pixData.qr_code} 
                                    readOnly 
                                    className="font-mono text-xs h-12 bg-background border-primary/20" 
                                />
                                <Button size="lg" onClick={copyPixCode} className="shrink-0">
                                    <Copy className="size-5 mr-2" />
                                    Copiar
                                </Button>
                            </div>
                            <p className="text-xs text-center text-muted-foreground italic">
                                O pagamento é aprovado instantaneamente após a conclusão no seu banco.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 w-full">
                            <Button asChild variant="outline" size="lg" className="flex-1">
                                <Link href="/">Continuar Comprando</Link>
                            </Button>
                            <Button asChild size="lg" className="flex-1">
                                <Link href="/orders">Meus Pedidos</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start max-w-6xl mx-auto p-4">
            <Card className="shadow-lg border-primary/10">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Resumo do Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {cartItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="relative size-16 overflow-hidden rounded-lg border bg-muted">
                                    <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-base">{item.productName}</span>
                                    <span className="text-sm text-muted-foreground">Qtde: {item.quantity}</span>
                                </div>
                            </div>
                            <span className="font-bold text-lg">R$ {(item.unitPriceAtAddition * item.quantity).toFixed(2).replace('.', ',')}</span>
                        </div>
                    ))}
                    <div className="h-px bg-border w-full my-6" />
                    <div className="flex justify-between font-bold text-2xl text-primary">
                        <span>Total a Pagar</span>
                        <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                </CardContent>
            </Card>
            
            <Card className="shadow-lg border-primary/10 overflow-hidden min-h-[500px]">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Finalizar Pagamento</CardTitle>
                    {error && (
                        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-3 text-sm mt-4 border border-destructive/20">
                            <AlertCircle className="size-5 shrink-0" />
                            <div className="flex flex-col">
                                <p className="font-bold">Aviso:</p>
                                <p>{error}</p>
                            </div>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="p-6 relative">
                    {!preferenceId ? (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                                <FormField control={form.control} name="cpf" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-base font-semibold">CPF</FormLabel>
                                        <FormControl><Input placeholder="000.000.000-00" className="h-12 text-lg" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="zipCode" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-base font-semibold">CEP</FormLabel>
                                            <FormControl><Input placeholder="00000-000" className="h-12" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <FormField control={form.control} name="state" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-base font-semibold">UF</FormLabel>
                                            <FormControl><Input placeholder="SP" className="h-12" {...field} maxLength={2} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                </div>
                                <FormField control={form.control} name="streetName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-base font-semibold">Rua / Logradouro</FormLabel>
                                        <FormControl><Input placeholder="Ex: Avenida Paulista" className="h-12" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="streetNumber" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-base font-semibold">Número</FormLabel>
                                            <FormControl><Input placeholder="123" className="h-12" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <FormField control={form.control} name="city" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-base font-semibold">Cidade</FormLabel>
                                            <FormControl><Input placeholder="Sua cidade" className="h-12" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                </div>
                                <Button type="submit" disabled={isLoading} className="w-full h-14 text-xl font-bold mt-6 shadow-lg hover:shadow-primary/20 transition-all">
                                    {isLoading ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="animate-spin" />
                                            Preparando...
                                        </div>
                                    ) : 'Escolher Forma de Pagamento'}
                                </Button>
                            </form>
                        </Form>
                    ) : (
                        <div className="min-h-[400px]">
                            {!isBrickLoaded && (
                                <div className="absolute inset-0 z-10 bg-card flex flex-col items-center justify-center p-10 space-y-6">
                                    <div className="relative">
                                        <Skeleton className="size-20 rounded-full" />
                                        <Loader2 className="absolute inset-0 m-auto animate-spin text-primary size-10" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-lg font-bold text-primary animate-pulse">Conectando ao Mercado Pago</p>
                                        <p className="text-sm text-muted-foreground">Estamos carregando suas opções de pagamento seguras...</p>
                                    </div>
                                    <div className="w-full space-y-3">
                                        <Skeleton className="h-12 w-full rounded-lg" />
                                        <Skeleton className="h-12 w-full rounded-lg" />
                                        <Skeleton className="h-12 w-full rounded-lg" />
                                    </div>
                                </div>
                            )}
                            <div id="paymentCard" className={cn("transition-opacity duration-500", !isBrickLoaded ? "opacity-0" : "opacity-100")} />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

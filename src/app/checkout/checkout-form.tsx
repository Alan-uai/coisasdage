'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { User } from 'firebase/auth';
import { createPreference, type PreferenceCartItem } from './actions';
import type { CartItem } from '@/lib/types';
import { addressSchema } from './form-schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';

declare global {
    interface Window {
        MercadoPago: any;
    }
}

export function CheckoutForm({ user, cartItems, subtotal }: { user: User, cartItems: CartItem[], subtotal: number }) {
    const [preferenceId, setPreferenceId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        if (!user || cartItems.length === 0) {
            setError('Usuário não autenticado ou carrinho vazio.');
            return;
        }
        
        setIsLoading(true);
        setError(null);

        const serializableCartItems: PreferenceCartItem[] = cartItems.map(item => ({
            id: item.id,
            productName: item.productName,
            selectedColor: item.selectedColor,
            selectedSize: item.selectedSize,
            selectedMaterial: item.selectedMaterial,
            quantity: item.quantity,
            unitPriceAtAddition: item.unitPriceAtAddition,
        }));
        
        const result = await createPreference(user.uid, serializableCartItems, values, subtotal);

        if (result.preferenceId) {
            setPreferenceId(result.preferenceId);
        } else {
            setError(result.error || 'Ocorreu um erro desconhecido ao criar a preferência de pagamento.');
        }
        setIsLoading(false);
    }

    useEffect(() => {
        if (preferenceId) {
            if (window.MercadoPago) {
                const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!, {
                    locale: 'pt-BR'
                });
                
                const container = document.getElementById('wallet_container');
                if (container) container.innerHTML = '';

                mp.bricks().create('wallet', 'wallet_container', {
                    initialization: {
                        preferenceId: preferenceId,
                    },
                    customization: {
                       texts: { valueProp: 'smart_option' },
                    }
                }).catch(() => {
                    setError('Não foi possível renderizar o checkout do Mercado Pago.');
                });
            } else {
                setError('O SDK de pagamento não carregou corretamente.');
            }
        }
    }, [preferenceId]);

    const renderPaymentArea = () => {
        if (isLoading) {
            return (
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            );
        }
        if (error) {
            return <p className="text-destructive">{error}</p>;
        }
        if (preferenceId) {
            return <div id="wallet_container" className="min-h-[200px]"></div>;
        }
        return null;
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
                    ) : renderPaymentArea()}
                </CardContent>
            </Card>
        </div>
    );
}

'use client';
import { useEffect, useState } from 'react';
import { createPreference } from './actions';
import type { CartItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';

declare global {
    interface Window {
        MercadoPago: any;
    }
}

export function CheckoutForm({ cartItems, subtotal }: { cartItems: CartItem[], subtotal: number }) {
    const [preferenceId, setPreferenceId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (cartItems.length > 0) {
            createPreference(cartItems).then(result => {
                if (result.preferenceId) {
                    setPreferenceId(result.preferenceId);
                } else {
                    setError(result.error || 'Ocorreu um erro desconhecido.');
                    setIsLoading(false);
                }
            });
        }
    }, [cartItems]);

    useEffect(() => {
        if (preferenceId) {
            if (window.MercadoPago) {
                const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!, {
                    locale: 'pt-BR'
                });
                
                const container = document.getElementById('wallet_container');
                if (container) {
                    container.innerHTML = '';
                }

                mp.bricks().create('wallet', 'wallet_container', {
                    initialization: {
                        preferenceId: preferenceId,
                    },
                    customization: {
                       texts: {
                         valueProp: 'smart_option',
                       },
                    }
                }).then(() => {
                    setIsLoading(false);
                }).catch(() => {
                    setError('Não foi possível renderizar o checkout.');
                    setIsLoading(false);
                });
            } else {
                setError('O SDK de pagamento não carregou corretamente.');
                setIsLoading(false);
            }
        }
    }, [preferenceId]);

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
            <div>
                 <Card>
                    <CardHeader>
                        <CardTitle>Pagamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                         {isLoading && (
                            <div className="space-y-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        )}
                        {error && <p className="text-destructive">{error}</p>}
                        <div id="wallet_container"></div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

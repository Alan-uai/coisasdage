'use server';

import mercadopago from 'mercadopago';
import type { CartItem } from '@/lib/types';

// Configure Mercado Pago
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN!,
});

type PreferenceResult = {
  preferenceId?: string;
  error?: string;
}

export async function createPreference(cartItems: CartItem[]): Promise<PreferenceResult> {
    if (!process.env.MP_ACCESS_TOKEN) {
        console.error("Mercado Pago access token not configured.");
        return { error: 'O servidor de pagamento não está configurado.' };
    }

    if (!cartItems || cartItems.length === 0) {
        return { error: 'O carrinho está vazio.' };
    }
    
    try {
        const items = cartItems.map(item => ({
            id: item.id,
            title: item.productName,
            description: `${item.selectedColor} / ${item.selectedSize} / ${item.selectedMaterial}`,
            quantity: item.quantity,
            currency_id: 'BRL',
            unit_price: item.unitPriceAtAddition,
        }));

        const preference = {
            items: items,
            back_urls: {
                success: `${process.env.NEXT_PUBLIC_APP_URL}/payment-status?status=success`,
                failure: `${process.env.NEXT_PUBLIC_APP_URL}/payment-status?status=failure`,
                pending: `${process.env.NEXT_PUBLIC_APP_URL}/payment-status?status=pending`,
            },
            auto_return: 'approved' as 'approved',
        };

        const response = await mercadopago.preferences.create(preference);
        
        return { preferenceId: response.body.id };

    } catch (error) {
        console.error('Error creating Mercado Pago preference:', error);
        return { error: 'Não foi possível iniciar o pagamento. Tente novamente.' };
    }
}

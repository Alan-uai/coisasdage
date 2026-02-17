'use server';

import { MercadoPagoConfig, Preference } from 'mercadopago';

// Define a serializable type for items passed from client to server action
export type PreferenceCartItem = {
    id: string;
    productName: string;
    selectedColor: string;
    selectedSize: string;
    selectedMaterial: string;
    quantity: number;
    unitPriceAtAddition: number;
};

type PreferenceResult = {
  preferenceId?: string;
  error?: string;
}

export async function createPreference(cartItems: PreferenceCartItem[]): Promise<PreferenceResult> {
    if (!process.env.MP_ACCESS_TOKEN) {
        console.error("Mercado Pago access token not configured.");
        return { error: 'O servidor de pagamento não está configurado.' };
    }

    if (!cartItems || cartItems.length === 0) {
        return { error: 'O carrinho está vazio.' };
    }
    
    try {
        const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
        const preference = new Preference(client);

        const items = cartItems.map(item => ({
            id: item.id,
            title: item.productName,
            description: `${item.selectedColor} / ${item.selectedSize} / ${item.selectedMaterial}`,
            quantity: item.quantity,
            currency_id: 'BRL',
            unit_price: item.unitPriceAtAddition,
        }));

        const response = await preference.create({
            body: {
                items: items,
                back_urls: {
                    success: `${process.env.NEXT_PUBLIC_APP_URL}/payment-status?status=success`,
                    failure: `${process.env.NEXT_PUBLIC_APP_URL}/payment-status?status=failure`,
                    pending: `${process.env.NEXT_PUBLIC_APP_URL}/payment-status?status=pending`,
                },
                auto_return: 'approved',
            }
        });
        
        return { preferenceId: response.id };

    } catch (error) {
        console.error('Error creating Mercado Pago preference:', error);
        return { error: 'Não foi possível iniciar o pagamento. Tente novamente.' };
    }
}

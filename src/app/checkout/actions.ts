'use server';

import { MercadoPagoConfig, Preference } from 'mercadopago';
import { z } from 'zod';
import { addressSchema } from './form-schema';

// Define a serializable type for items passed from client to server action
export type PreferenceCartItem = {
    id: string;
    productName: string;
    selectedColor: string;
    selectedSize: string;
    selectedMaterial: string;
    quantity: number;
    unitPriceAtAddition: number;
    imageUrl: string;
};

type AddressData = z.infer<typeof addressSchema>;

type PreferenceResult = {
  preferenceId?: string;
  error?: string;
}

export async function createPreference(
    userId: string,
    userEmail: string,
    userName: string | null,
    cartItems: PreferenceCartItem[],
    addressData: AddressData,
    orderId: string
): Promise<PreferenceResult> {
    if (!process.env.MP_ACCESS_TOKEN) {
        console.error("Mercado Pago access token not configured.");
        return { error: 'O servidor de pagamento não está configurado.' };
    }

    if (!cartItems || cartItems.length === 0) {
        return { error: 'O carrinho está vazio.' };
    }
    
    try {
        // Create the Mercado Pago Preference
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
        
        const nameParts = (userName || 'Comprador Anônimo').split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ' ';

        const payer = {
            email: userEmail,
            name: firstName,
            surname: lastName,
            identification: {
                type: 'CPF',
                number: addressData.cpf,
            },
            address: {
                street_name: addressData.streetName,
                street_number: parseInt(addressData.streetNumber, 10),
                zip_code: addressData.zipCode,
            }
        };

        const response = await preference.create({
            body: {
                items: items,
                payer: payer,
                external_reference: orderId, // Links the MP payment to the Firestore Order ID
                notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
                back_urls: {
                    success: `${process.env.NEXT_PUBLIC_APP_URL}/payment-status?status=success&order_id=${orderId}`,
                    failure: `${process.env.NEXT_PUBLIC_APP_URL}/payment-status?status=failure&order_id=${orderId}`,
                    pending: `${process.env.NEXT_PUBLIC_APP_URL}/payment-status?status=pending&order_id=${orderId}`,
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

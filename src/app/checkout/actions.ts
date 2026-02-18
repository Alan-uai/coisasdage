'use server';

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
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

type PaymentResult = {
    success: boolean;
    status?: string;
    status_detail?: string;
    payment_id?: number;
    qr_code?: string;
    qr_code_base64?: string;
    error?: string;
};

/**
 * Creates a preference to initialize the Payment Brick.
 * Using a preference is the recommended way to initialize Bricks with total and items.
 */
export async function createPreference(
    userId: string,
    userEmail: string,
    userName: string | null,
    cartItems: PreferenceCartItem[],
    addressData: AddressData,
    orderId: string
): Promise<PreferenceResult> {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    
    if (!accessToken) {
        return { error: 'Token de acesso (MP_ACCESS_TOKEN) não encontrado no servidor.' };
    }

    if (!cartItems || cartItems.length === 0) {
        return { error: 'O carrinho está vazio.' };
    }
    
    try {
        const client = new MercadoPagoConfig({ accessToken });
        const preference = new Preference(client);

        const items = cartItems.map(item => ({
            id: item.id,
            title: item.productName,
            description: `${item.selectedColor} / ${item.selectedSize}`,
            quantity: item.quantity,
            currency_id: 'BRL',
            unit_price: item.unitPriceAtAddition,
        }));
        
        const response = await preference.create({
            body: {
                items: items,
                payer: {
                    email: userEmail,
                    name: userName || 'Cliente',
                },
                external_reference: orderId,
                // Simplified for initial setup to avoid validation errors
                auto_return: 'approved',
            }
        });
        
        if (!response.id) {
            throw new Error('ID da preferência não retornado pelo Mercado Pago.');
        }

        return { preferenceId: response.id };

    } catch (error: any) {
        console.error('Mercado Pago preference error:', error);
        return { error: `Erro ao iniciar pagamento: ${error.message || 'Verifique as credenciais.'}` };
    }
}

/**
 * Processes the payment using the Checkout API (v1/payments).
 * This is called by the Payment Brick onSubmit callback.
 */
export async function processPayment(formData: any, orderId: string, userEmail: string): Promise<PaymentResult> {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    
    if (!accessToken) {
        return { success: false, error: 'Token de acesso não configurado no servidor.' };
    }

    try {
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);

        // Map the brick's formData to the Mercado Pago Payment API request body
        const response = await payment.create({
            body: {
                transaction_amount: formData.transaction_amount,
                token: formData.token, // Present for card payments
                description: formData.description || `Pedido ${orderId}`,
                installments: formData.installments,
                payment_method_id: formData.payment_method_id,
                issuer_id: formData.issuer_id,
                payer: {
                    email: userEmail,
                    ...formData.payer,
                },
                external_reference: orderId,
            }
        });

        // Pix specific data extraction from point_of_interaction
        const poi = response.point_of_interaction;
        const qrCode = poi?.transaction_data?.qr_code;
        const qrCodeBase64 = poi?.transaction_data?.qr_code_base64;

        return {
            success: true,
            status: response.status,
            status_detail: response.status_detail,
            payment_id: response.id,
            qr_code: qrCode,
            qr_code_base64: qrCodeBase64,
        };
    } catch (error: any) {
        console.error('Mercado Pago payment processing error:', error);
        return { 
            success: false, 
            error: error.message || 'Erro ao processar o pagamento. Verifique os dados e tente novamente.' 
        };
    }
}

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
        return { error: 'Token de acesso não configurado no servidor.' };
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
            }
        });
        
        if (!response.id) {
            throw new Error('ID da preferência não retornado.');
        }

        return { preferenceId: response.id };

    } catch (error: any) {
        console.error('Mercado Pago preference error:', error);
        return { error: `Erro ao iniciar pagamento: ${error.message}` };
    }
}

/**
 * Processes the payment using the Checkout API (v1/payments).
 * Correctly extracts and merges data from the Payment Brick.
 */
export async function processPayment(
    paymentData: any, 
    orderId: string, 
    userEmail: string, 
    amount: number
): Promise<PaymentResult> {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    
    if (!accessToken) {
        return { success: false, error: 'Token de acesso não configurado.' };
    }

    try {
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);

        // Map the brick's paymentData to the Mercado Pago Payment API request body
        // Ensure critical attributes like transaction_amount and payment_method_id are present
        const response = await payment.create({
            body: {
                ...paymentData, // Spreading the data received from the Brick (includes token, payment_method_id, installments, etc.)
                transaction_amount: amount, // Overwrite with server-calculated amount for security
                description: `Pedido ${orderId} - Artesã Aconchegante`,
                external_reference: orderId,
                payer: {
                    ...paymentData.payer,
                    email: userEmail,
                },
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
        // Error details can be complex in Mercado Pago SDK
        const errorMessage = error.message || (error.cause && error.cause[0]?.description) || 'Erro ao processar o pagamento.';
        return { 
            success: false, 
            error: errorMessage
        };
    }
}

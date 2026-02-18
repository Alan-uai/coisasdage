
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
    merchant_order_id?: number | string;
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
        return { error: 'Token de acesso não configurado no servidor (.env).' };
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
                    name: userName?.split(' ')[0] || 'Cliente',
                    surname: userName?.split(' ').slice(1).join(' ') || 'Artesã',
                    identification: {
                        type: 'CPF',
                        number: addressData.cpf.replace(/\D/g, ''),
                    },
                    address: {
                        street_name: addressData.streetName,
                        street_number: parseInt(addressData.streetNumber, 10),
                        zip_code: addressData.zipCode.replace(/\D/g, ''),
                    }
                },
                external_reference: orderId,
                statement_descriptor: "ARTESAACONCHEG",
                binary_mode: false,
            }
        });
        
        if (!response.id) {
            throw new Error('ID da preferência não retornado pela API.');
        }

        return { preferenceId: response.id };

    } catch (error: any) {
        console.error('Mercado Pago preference error:', error);
        return { error: `Erro ao iniciar pagamento: ${error.message || 'Erro desconhecido'}` };
    }
}

/**
 * Processes the payment using the Checkout API (v1/payments).
 */
export async function processPayment(
    paymentData: any, 
    orderId: string, 
    userEmail: string, 
    amount: number
): Promise<PaymentResult> {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    
    if (!accessToken) {
        return { success: false, error: 'Token de acesso não configurado no servidor (.env).' };
    }

    try {
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);

        const response = await payment.create({
            body: {
                ...paymentData, 
                transaction_amount: Number(amount.toFixed(2)), 
                description: `Pedido ${orderId} - Artesã Aconchegante`,
                external_reference: orderId,
                payer: {
                    ...paymentData.payer,
                    email: userEmail,
                },
            }
        });

        const poi = response.point_of_interaction;
        const qrCode = poi?.transaction_data?.qr_code;
        const qrCodeBase64 = poi?.transaction_data?.qr_code_base64;

        // Extract merchant order ID if available in the response
        // Sometimes it's inside the 'order' object, sometimes it's returned as 'merchant_order_id'
        const merchantOrderId = response.order?.id || (response as any).merchant_order_id;

        return {
            success: true,
            status: response.status,
            status_detail: response.status_detail,
            payment_id: response.id,
            merchant_order_id: merchantOrderId,
            qr_code: qrCode,
            qr_code_base64: qrCodeBase64,
        };
    } catch (error: any) {
        console.error('Mercado Pago payment processing error:', error);
        
        let errorMessage = 'Erro ao processar o pagamento.';
        
        if (error.message?.includes('Unauthorized use of live credentials') || error.status === 401 || error.status === 403) {
            errorMessage = 'Sua conta do Mercado Pago ainda não foi homologada para usar chaves de Produção (APP_USR). Por favor, use as chaves de Teste (TEST) ou preencha o formulário de "Go Live" no painel do Mercado Pago.';
        } else {
            errorMessage = error.message || (error.cause && error.cause[0]?.description) || errorMessage;
        }

        return { 
            success: false, 
            error: errorMessage
        };
    }
}

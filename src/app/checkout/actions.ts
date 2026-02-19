'use server';

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { z } from 'zod';
import { addressSchema } from './form-schema';
import { headers } from 'next/headers';

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

    try {
        const client = new MercadoPagoConfig({ accessToken });
        const preference = new Preference(client);

        // Get the host for the notification URL
        const headersList = await headers();
        const host = headersList.get('host');
        const protocol = host?.includes('localhost') ? 'http' : 'https';
        const notificationUrl = `${protocol}://${host}/api/webhooks/mercadopago`;

        const response = await preference.create({
            body: {
                items: cartItems.map(item => ({
                    id: item.id,
                    title: item.productName,
                    description: `${item.selectedColor} / ${item.selectedSize}`,
                    quantity: item.quantity,
                    currency_id: 'BRL',
                    unit_price: item.unitPriceAtAddition,
                })),
                payer: {
                    email: userEmail,
                    name: userName?.split(' ')[0] || 'Cliente',
                    surname: userName?.split(' ').slice(1).join(' ') || 'Artesã',
                    identification: {
                        type: 'CPF',
                        number: addressData.cpf.replace(/\D/g, ''),
                    },
                },
                external_reference: orderId,
                notification_url: notificationUrl,
                statement_descriptor: "ARTESAACONCHEG",
            }
        });
        
        if (!response.id) throw new Error('Falha ao gerar ID da preferência.');

        return { preferenceId: response.id };
    } catch (error: any) {
        console.error('Preference creation error:', error);
        return { error: `Erro ao iniciar pagamento: ${error.message}` };
    }
}

export async function processPayment(
    paymentData: any, 
    orderId: string, 
    userEmail: string, 
    amount: number
): Promise<PaymentResult> {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    
    if (!accessToken) {
        return { success: false, error: 'Token não configurado.' };
    }

    try {
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);

        const response = await payment.create({
            body: {
                ...paymentData, 
                transaction_amount: Number(amount.toFixed(2)), 
                description: `Pedido ${orderId}`,
                external_reference: orderId,
                payer: { ...paymentData.payer, email: userEmail },
            }
        });

        // Try to get the Merchant Order ID (the "ORD..." one)
        const merchantOrderId = response.order?.id || (response as any).merchant_order_id;

        return {
            success: true,
            status: response.status,
            status_detail: response.status_detail,
            payment_id: response.id,
            merchant_order_id: merchantOrderId,
            qr_code: response.point_of_interaction?.transaction_data?.qr_code,
            qr_code_base64: response.point_of_interaction?.transaction_data?.qr_code_base64,
        };
    } catch (error: any) {
        console.error('Payment processing error:', error);
        return { success: false, error: error.message || 'Erro ao processar pagamento.' };
    }
}

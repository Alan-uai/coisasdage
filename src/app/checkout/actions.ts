'use server';

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { z } from 'zod';
import { addressSchema } from './form-schema';
import { headers } from 'next/headers';
import axios from 'axios';

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
    payment_id?: number | string;
    merchant_order_id?: number | string;
    qr_code?: string;
    qr_code_base64?: string;
    error?: string;
};

const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const ARTESA_WPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";

/**
 * Notifica a Artesã privadamente sobre uma nova solicitação.
 */
export async function notifyAdminNewRequest(requestId: string, clientName: string, productName: string) {
    if (!WHAPI_TOKEN) return;

    try {
        await axios.post('https://gate.whapi.cloud/messages/text', {
            to: ARTESA_WPP,
            body: `🧶 *Nova Solicitação Sob Demanda!*\n\nCliente: ${clientName}\nProduto: ${productName}\n\n*ID para Comando: #${requestId.toUpperCase()}*\n\n_Quando fechar o valor, responda aqui com:_ \n#${requestId.toUpperCase()} Aprovado [valor]`
        }, {
            headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` }
        });
    } catch (e) {
        console.error('Erro ao notificar admin via Whapi:', e);
    }
}

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
                external_reference: `${userId}|${orderId}`,
                notification_url: notificationUrl,
                statement_descriptor: "COISAS DAGE",
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

        const merchantOrderId = response.order?.id || (response as any).merchant_order_id || null;

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

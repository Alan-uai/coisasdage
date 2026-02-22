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
    qrCodeBase64?: string;
    error?: string;
};

const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const ARTESA_WPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const GROUP_ID = process.env.WHATSAPP_GROUP_ID; // Credencial para o grupo "Pedidos"

/**
 * Notifica a Artesã sobre uma nova solicitação, com imagem e link para o cliente.
 * Prioriza o envio para o grupo "Pedidos" se o ID estiver configurado.
 */
export async function notifyAdminNewRequest(requestId: string, clientName: string, productName: string, imageUrl: string, clientPhone?: string) {
    if (!WHAPI_TOKEN) return;

    const destination = GROUP_ID || ARTESA_WPP;
    const commandId = requestId; // Usando o ID completo do Firestore

    let caption = `🧶 *Nova Solicitação Sob Demanda!*\n\n`;
    caption += `Cliente: *${clientName}*\n`;

    if (clientPhone) {
        const cleanPhone = clientPhone.replace(/\D/g, '');
        // Assume código do Brasil se não especificado
        const fullPhone = cleanPhone.length > 11 ? cleanPhone : `55${cleanPhone}`;
        caption += `Conversar: https://wa.me/${fullPhone}\n`;
    }

    caption += `Produto: *${productName}*\n\n`;
    caption += `*ID para Comando: #${commandId}*\n\n`;
    caption += `_Para aprovar, responda com:_\n#${commandId} Aprovado [dias]`;

    try {
        // Tenta enviar uma imagem com a legenda construída
        await axios.post('https://gate.whapi.cloud/messages/image', {
            to: destination,
            media: imageUrl,
            caption: caption,
        }, {
            headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` }
        });
    } catch (e: any) {
        console.error('Erro ao notificar admin (com imagem) via Whapi:', e?.response?.data || e?.message);
        
        // Fallback para mensagem de texto se o envio da imagem falhar
        try {
             await axios.post('https://gate.whapi.cloud/messages/text', {
                to: destination,
                body: caption // Envia a mesma legenda como texto puro
            }, {
                headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` }
            });
        } catch (fallbackError) {
            console.error('Erro no fallback de notificação de admin via Whapi:', fallbackError);
        }
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
                    phone: {
                        area_code: addressData.phone.replace(/\D/g, '').substring(0, 2),
                        number: addressData.phone.replace(/\D/g, '').substring(2),
                    },
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
    amount: number,
    userId: string
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
                external_reference: `${userId}|${orderId}`,
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
            qrCodeBase64: response.point_of_interaction?.transaction_data?.qr_code_base64,
        };
    } catch (error: any) {
        console.error('Payment processing error:', error);
        return { success: false, error: error.message || 'Erro ao processar pagamento.' };
    }
}

/**
 * Notifica a Artesã sobre um novo pedido PAGO de pronta entrega.
 */
export async function notifyAdminNewOrder(orderId: string, clientName: string, items: { productName: string }[], isTest: boolean = false) {
    if (!WHAPI_TOKEN) return;

    // Se houver um ID de grupo, envia para o grupo, caso contrário para o número privado
    const destination = GROUP_ID || ARTESA_WPP;
    const commandId = orderId; // Usando o ID completo do Firestore
    const productList = items.map(item => `- ${item.productName}`).join('\n');

    let messageBody = '';
    if (isTest) {
        messageBody += "🧪 *ESTE É UM PEDIDO DE TESTE*\n\n";
    }
    messageBody += `📦 *Novo Pedido Pago (Pronta Entrega)!*\n\nCliente: *${clientName}*\n\nItens:\n${productList}\n\n*ID do Pedido: #${commandId}*\n\nQuando o pacote estiver pronto para envio, responda aqui com:\n` + "`" + `#${commandId} Pronto` + "`";

    try {
        await axios.post('https://gate.whapi.cloud/messages/text', {
            to: destination,
            body: messageBody
        }, {
            headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` }
        });
    } catch (e) {
        console.error('Erro ao notificar admin sobre novo pedido via Whapi:', e);
    }
}

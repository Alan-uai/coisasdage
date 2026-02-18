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
 * Creates a preference to initialize the Payment Brick with the correct total and items.
 */
export async function createPreference(
    userId: string,
    userEmail: string,
    userName: string | null,
    cartItems: PreferenceCartItem[],
    addressData: AddressData,
    orderId: string
): Promise<PreferenceResult> {
    if (!process.env.MP_ACCESS_TOKEN) {
        console.error("Mercado Pago access token not configured in .env");
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
        
        const nameParts = (userName || 'Comprador Anônimo').split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ' ';

        const response = await preference.create({
            body: {
                items: items,
                payer: {
                    email: userEmail,
                    name: firstName,
                    surname: lastName,
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

/**
 * Processes the payment using the Checkout API (v1/payments).
 * This is called by the Payment Brick onSubmit callback.
 */
export async function processPayment(formData: any, orderId: string, userEmail: string): Promise<PaymentResult> {
    if (!process.env.MP_ACCESS_TOKEN) {
        return { success: false, error: 'O servidor de pagamento não está configurado.' };
    }

    try {
        const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
        const payment = new Payment(client);

        const response = await payment.create({
            body: {
                transaction_amount: formData.transaction_amount,
                token: formData.token,
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

        // Pix specific data extraction
        const pointOfInteraction = response.point_of_interaction;
        const qrCode = pointOfInteraction?.transaction_data?.qr_code;
        const qrCodeBase64 = pointOfInteraction?.transaction_data?.qr_code_base64;

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
        return { success: false, error: error.message || 'Erro ao processar o pagamento.' };
    }
}

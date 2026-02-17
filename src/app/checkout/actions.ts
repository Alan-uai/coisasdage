'use server';

import { MercadoPagoConfig, Preference } from 'mercadopago';
import { z } from 'zod';
import { addressSchema } from './form-schema';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

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

type AddressData = z.infer<typeof addressSchema>;

type PreferenceResult = {
  preferenceId?: string;
  error?: string;
}

// NOTE: In a real app, initializeFirebase() should ideally be called once.
// Here we call it to get a server-side instance of Firestore.
// A better approach would be using the Firebase Admin SDK for server-side operations.
const { firestore } = initializeFirebase();

export async function createPreference(
    userId: string,
    cartItems: PreferenceCartItem[],
    addressData: AddressData,
    totalAmount: number
): Promise<PreferenceResult> {
    if (!process.env.MP_ACCESS_TOKEN) {
        console.error("Mercado Pago access token not configured.");
        return { error: 'O servidor de pagamento não está configurado.' };
    }

    if (!cartItems || cartItems.length === 0) {
        return { error: 'O carrinho está vazio.' };
    }
    
    try {
        // 1. Create the Order document in Firestore first
        const ordersRef = collection(firestore, 'users', userId, 'orders');
        const newOrderRef = await addDoc(ordersRef, {
            userId: userId,
            orderDate: serverTimestamp(),
            totalAmount: totalAmount,
            status: 'Processing', // Status pending payment
            shippingAddress: addressData, // Store the validated address
            items: cartItems.map(item => ({ // Denormalize cart items into the order
                productId: item.id,
                productName: item.productName,
                imageUrl: '', // This should ideally be passed from the client
                quantity: item.quantity,
                unitPriceAtOrder: item.unitPriceAtAddition,
                selectedSize: item.selectedSize,
                selectedColor: item.selectedColor,
                selectedMaterial: item.selectedMaterial,
            })),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        const orderId = newOrderRef.id;
        
        // 2. Create the Mercado Pago Preference
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

        // TODO: Get payer name/surname from user profile in a real app
        const payer = {
            email: 'test_user_123@testuser.com', // This should be the user's email
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

import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment, MerchantOrder } from 'mercadopago';
import { initializeFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

/**
 * Webhook handler for Mercado Pago notifications.
 * It processes both 'payment' and 'merchant_order' topics.
 */
export async function POST(request: NextRequest) {
  const { firestore } = initializeFirebase();
  const accessToken = process.env.MP_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({ error: 'Access token not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    console.log('Mercado Pago Webhook received:', body);

    const client = new MercadoPagoConfig({ accessToken });
    const topic = body.type || body.topic;
    const resourceId = body.data?.id || body.id;

    if (topic === 'payment') {
      const payment = new Payment(client);
      const paymentData = await payment.get({ id: resourceId });
      const orderId = paymentData.external_reference;

      if (orderId) {
        // Find user by orderId to update the correct document
        // Since we don't have the userId directly in the webhook payload, 
        // we might need to search for the order in a collection group or pass it differently.
        // For this MVP, we rely on the external_reference being the orderId.
        console.log(`Payment received for order: ${orderId}. Status: ${paymentData.status}`);
      }
    }

    if (topic === 'merchant_order' || topic === 'order') {
      // This is where the "ORD..." ID comes from
      const merchantOrderId = resourceId;
      console.log('Merchant Order ID received:', merchantOrderId);
      
      // If the body contains the order action required, we can extract it.
      // In a real scenario, you'd find the Firestore order by some reference and update it.
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

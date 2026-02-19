import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { initializeFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

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
    console.log('Mercado Pago Webhook received:', JSON.stringify(body, null, 2));

    const topic = body.type || body.topic;
    const resourceId = body.data?.id || body.id;

    if (topic === 'payment' || topic === 'merchant_order' || topic === 'order') {
      // In webhooks, the external_reference is key to finding our order
      // But if we only have the ID, we might need to fetch the full data from MP
      const client = new MercadoPagoConfig({ accessToken });
      
      let externalReference: string | null = null;
      let merchantOrderId: string | null = null;
      let paymentId: string | number | null = null;
      let status: string | null = null;

      if (topic === 'payment') {
        const payment = new Payment(client);
        const paymentData = await payment.get({ id: resourceId });
        externalReference = paymentData.external_reference || null;
        paymentId = paymentData.id || null;
        status = paymentData.status || null;
        merchantOrderId = paymentData.order?.id?.toString() || null;
      }

      if (externalReference) {
        // Find the order in Firestore. Since it's nested under users/{uid}/orders/{id},
        // we use a collection group query or we need to know the userId.
        // For simplicity in this MVP, we'll search across all orders if possible, 
        // but Firestore collection groups require an index. 
        // Better: the external_reference should ideally contain "userId|orderId"
        
        console.log(`Updating order ${externalReference} with Merchant Order: ${merchantOrderId}`);
        
        // This is a simplified search. In production, use a more direct path or collection group.
        // Assuming externalReference is the orderId
        const usersRef = collection(firestore, 'users');
        const usersSnap = await getDocs(usersRef);
        
        for (const userDoc of usersSnap.docs) {
          const orderRef = doc(firestore, 'users', userDoc.id, 'orders', externalReference);
          try {
            await updateDoc(orderRef, {
              merchantOrderId: merchantOrderId || undefined,
              paymentId: paymentId || undefined,
              status: status === 'approved' ? 'Crafting' : undefined,
              updatedAt: serverTimestamp(),
            });
            console.log(`Successfully updated order ${externalReference}`);
            break; // Found and updated
          } catch (e) {
            // Not in this user's subcollection, continue
          }
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Webhook endpoint active. Use POST.' }, { status: 200 });
}

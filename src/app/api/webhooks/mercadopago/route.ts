import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { notifyAdminNewOrder } from '@/app/checkout/actions';

export const dynamic = 'force-dynamic';

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

    // SIMULAÇÃO DE TESTE DO MERCADO PAGO
    if (resourceId === '123456' || resourceId === 123456) {
        console.log('Mercado Pago URL Test (ID 123456) successful');
        return NextResponse.json({ test: 'success' }, { status: 200 });
    }

    if (topic === 'payment') {
      const client = new MercadoPagoConfig({ accessToken });
      const payment = new Payment(client);
      const paymentData = await payment.get({ id: resourceId });
      
      const externalReference = paymentData.external_reference || null;
      const paymentId = paymentData.id || null;
      const status = paymentData.status || null;
      const merchantOrderId = paymentData.order?.id?.toString() || null;
      const isLive = paymentData.live_mode ?? true; // Assume live if not present

      if (externalReference && externalReference.includes('|')) {
        const [userId, orderId] = externalReference.split('|');
        const orderRef = doc(firestore, 'users', userId, 'orders', orderId);
        
        const isApproved = status === 'approved';
        
        // Atualiza o pedido com o status de pagamento e a trava de envio.
        await updateDoc(orderRef, {
          merchantOrderId: merchantOrderId || undefined,
          paymentId: paymentId || undefined,
          status: isApproved ? 'IN_PRODUCTION' : undefined,
          shippingAllowed: isApproved ? false : undefined,
          updatedAt: serverTimestamp(),
        });
        
        if (isApproved) {
            console.log(`Successfully updated order ${orderId} to status IN_PRODUCTION.`);
            const orderSnap = await getDoc(orderRef);
            if (orderSnap.exists()) {
                const orderData = orderSnap.data();
                // Notifica a artesã sobre o novo pedido, indicando se é um teste.
                await notifyAdminNewOrder(orderId, orderData.userName, orderData.items, !isLive);
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

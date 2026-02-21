import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { initializeFirebase } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { automateShippingLabel } from '@/lib/mercado-livre';

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
    // Se o ID for o padrão de teste 123456, respondemos 200 OK imediatamente
    if (resourceId === '123456' || resourceId === 123456) {
        console.log('Mercado Pago URL Test (ID 123456) successful');
        return NextResponse.json({ test: 'success' }, { status: 200 });
    }

    if (topic === 'payment' || topic === 'merchant_order' || topic === 'order') {
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

      // Se temos nossa referência combinada (userId|orderId), podemos atualizar diretamente
      if (externalReference && externalReference.includes('|')) {
        const [userId, orderId] = externalReference.split('|');
        const orderRef = doc(firestore, 'users', userId, 'orders', orderId);
        
        const isApproved = status === 'approved';
        
        await updateDoc(orderRef, {
          merchantOrderId: merchantOrderId || undefined,
          paymentId: paymentId || undefined,
          status: isApproved ? 'Crafting' : undefined,
          updatedAt: serverTimestamp(),
        });
        
        console.log(`Successfully updated order ${orderId} via direct path`);

        // AUTOMAÇÃO WHAPI CLOUD: Dispara envio de etiqueta se aprovado
        if (isApproved && merchantOrderId) {
            // Chamada não bloqueante para o webhook responder rápido
            automateShippingLabel(merchantOrderId, orderId).catch(console.error);
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

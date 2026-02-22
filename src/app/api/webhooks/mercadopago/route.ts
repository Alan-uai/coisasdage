
import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, runTransaction, collection, writeBatch, increment } from 'firebase/firestore';
import { notifyAdminNewOrder } from '@/app/checkout/actions';
import type { Order, OrderItemSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Decrements stock for ready-made items in an order using a Firestore transaction.
 */
async function decrementStock(orderItems: OrderItemSummary[]) {
    const { firestore } = initializeFirebase();
    if (!orderItems || orderItems.length === 0) return;

    try {
        await runTransaction(firestore, async (transaction) => {
            for (const item of orderItems) {
                // Only decrement stock for items marked as ready-made
                if (item.readyMade) {
                    // Acessa o inventário pela ID da variante específica (productId) em vez do ID do grupo.
                    const inventoryRef = doc(firestore, 'product_inventory', item.productId);
                    const inventoryDoc = await transaction.get(inventoryRef);

                    if (!inventoryDoc.exists()) {
                        // A mensagem de erro agora reflete a busca por variante.
                        throw `Estoque para a variante do produto ${item.productName} (ID: ${item.productId}) não encontrado.`;
                    }

                    const currentQuantity = inventoryDoc.data().quantity;
                    if (currentQuantity < item.quantity) {
                        throw `Estoque insuficiente para ${item.productName} (Variante ID: ${item.productId}). Pedido: ${item.quantity}, Disponível: ${currentQuantity}.`;
                    }

                    const newQuantity = currentQuantity - item.quantity;
                    transaction.update(inventoryRef, { quantity: newQuantity });
                }
            }
        });
        console.log("Estoque decrementado com sucesso para o pedido (por variante).");
    } catch (error) {
        console.error("Erro na transação de decremento de estoque:", error);
        // Em um cenário real, aqui você poderia notificar o admin sobre a falha para reconciliação manual.
        // Por exemplo: enviar um e-mail/whatsapp de alerta.
        throw new Error('Falha ao atualizar o estoque. A venda foi concluída, mas o estoque precisa de verificação manual.');
    }
}


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
      const isLive = paymentData.live_mode ?? true;

      if (externalReference && externalReference.includes('|')) {
        const [userId, orderId] = externalReference.split('|');
        const orderRef = doc(firestore, 'users', userId, 'orders', orderId);
        
        const isApproved = status === 'approved';
        
        const updatePayload: { [key: string]: any } = {
          updatedAt: serverTimestamp(),
        };

        if (merchantOrderId) {
          updatePayload.merchantOrderId = merchantOrderId;
        }
        if (paymentId) {
          updatePayload.paymentId = paymentId;
        }
        if (isApproved) {
          updatePayload.status = 'IN_PRODUCTION';
          updatePayload.shippingAllowed = false;
        }
        
        await updateDoc(orderRef, updatePayload);
        
        if (isApproved) {
            console.log(`Successfully updated order ${orderId} to status IN_PRODUCTION.`);
            const orderSnap = await getDoc(orderRef);

            if (orderSnap.exists()) {
                const orderData = orderSnap.data() as Order;

                // Decrement stock atomically
                await decrementStock(orderData.items);

                if (orderData.shippingMethod !== 'pickup') {
                    await notifyAdminNewOrder(orderId, orderData.userName, orderData.items, !isLive);
                }
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

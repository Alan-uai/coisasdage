
'use server';

import axios from 'axios';
import { Firestore, DocumentReference, updateDoc } from 'firebase/firestore';

/**
 * @fileOverview Integração robusta com Mercado Livre Envios e Automação Whapi Cloud.
 */

const ML_API = "https://api.mercadolibre.com";
const ML_CLIENT_ID = process.env.ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const ML_REFRESH_TOKEN = process.env.ML_REFRESH_TOKEN;
const ARTESA_WPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;

/**
 * Atualiza o access_token usando o refresh_token.
 */
async function getAccessToken(): Promise<string> {
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET || !ML_REFRESH_TOKEN) {
    throw new Error('Credenciais do Mercado Livre não configuradas no .env');
  }

  try {
    const response = await axios.post(
      `${ML_API}/oauth/token`,
      {
        grant_type: 'refresh_token',
        client_id: ML_CLIENT_ID,
        client_secret: ML_CLIENT_SECRET,
        refresh_token: ML_REFRESH_TOKEN,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data.access_token;
  } catch (error: any) {
    console.error('Error refreshing ML token:', error.response?.data || error.message);
    throw new Error('Falha na autenticação com Mercado Livre.');
  }
}

/**
 * BUSCAR SHIPMENT ID A PARTIR DO MERCHANT ORDER ID
 */
export async function getShipmentIdFromOrder(merchantOrderId: string) {
  try {
    const accessToken = await getAccessToken();
    const response = await axios.get(`${ML_API}/merchant_orders/${merchantOrderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const shipmentId = response.data.shipments?.[0]?.id;
    return shipmentId?.toString() || null;
  } catch (error) {
    console.error('Erro ao buscar Shipment ID:', error);
    return null;
  }
}

/**
 * BUSCAR ETIQUETA PDF
 */
export async function getMLShipmentLabel(shipmentId: string) {
  try {
    const accessToken = await getAccessToken();
    
    const res = await axios.get(`${ML_API}/shipment_labels`, {
      params: {
        shipment_ids: shipmentId,
        response_type: 'pdf',
      },
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
    });

    const base64 = Buffer.from(res.data).toString('base64');
    
    return {
      success: true,
      base64
    };
  } catch (error: any) {
    console.error('Error fetching ML label:', error.response?.data || error.message);
    return { success: false, error: 'Não foi possível gerar a etiqueta.' };
  }
}

/**
 * Envia o PDF da etiqueta diretamente para o WhatsApp da artesã
 */
export async function sendLabelToAdmin(labelBase64: string, orderId: string) {
    if (!WHAPI_TOKEN) return;

    try {
        const shortId = orderId.slice(-6).toUpperCase();
        await axios.post('https://gate.whapi.cloud/messages/document', {
            to: ARTESA_WPP,
            media: `data:application/pdf;base64,${labelBase64}`,
            filename: `etiqueta-${shortId}.pdf`,
            caption: `📦 Pedido #${shortId}\nProduto finalizado com sucesso.\n\n🖨️ A etiqueta de envio está em anexo. Assim que imprimir e postar, o rastreio será atualizado automaticamente.`
        }, {
            headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` }
        });
    } catch (e) {
        console.error('Erro ao enviar etiqueta via Whapi:', e);
    }
}


/**
 * Orquestra a geração da etiqueta, atualização do pedido no Firestore e notificação para a artesã.
 * Este é o novo fluxo logístico central.
 */
export async function generateLabelAndNotify(db: Firestore, orderRef: DocumentReference, merchantOrderId: string, orderId: string) {
  try {
    const orderDoc = (await orderRef.get()).data();
    if (!orderDoc || orderDoc.status !== 'READY' || !orderDoc.shippingAllowed) {
        throw new Error(`O pedido ${orderId} não está pronto para envio ou a trava de segurança está ativa.`);
    }

    const shipmentId = await getShipmentIdFromOrder(merchantOrderId);
    if (!shipmentId) throw new Error(`Shipment ID não encontrado para o Merchant Order ${merchantOrderId}.`);

    const [labelData, trackingInfo] = await Promise.all([
        getMLShipmentLabel(shipmentId),
        getMLShipmentTrackingByShipmentId(shipmentId) 
    ]);
    
    if (!labelData.success || !labelData.base64) throw new Error('Falha ao gerar o PDF da etiqueta.');

    await updateDoc(orderRef, {
      shipmentId: shipmentId,
      status: 'LABEL_GENERATED',
      trackingNumber: trackingInfo.success ? trackingInfo.trackingNumber : undefined,
      labelUrl: '', // O PDF é enviado diretamente, não há URL pública.
    });

    await sendLabelToAdmin(labelData.base64, orderId);

    console.log(`Etiqueta do pedido ${orderId} gerada e enviada via Whapi.`);
  } catch (error: any) {
    console.error(`Falha na automação de etiqueta para o pedido ${orderId}:`, error.message);
    throw error; // Re-throw para que o webhook do Whapi possa tratar
  }
}

/**
 * BUSCAR STATUS E RASTREAMENTO por Merchant Order ID (com correção).
 */
export async function getMLShipmentTracking(merchantOrderId: string) {
  try {
    const shipmentId = await getShipmentIdFromOrder(merchantOrderId);
    if (!shipmentId) {
      return { success: false, error: 'Shipment ID não encontrado.' };
    }
    return await getMLShipmentTrackingByShipmentId(shipmentId);
  } catch (error: any) {
    console.error('Error fetching ML tracking:', error.response?.data || error.message);
    return { success: false, error: 'Falha ao buscar rastreio.' };
  }
}

/**
 * Função interna para buscar rastreamento com o ID do envio.
 */
async function getMLShipmentTrackingByShipmentId(shipmentId: string) {
  try {
    const accessToken = await getAccessToken();
    const response = await axios.get(`${ML_API}/shipments/${shipmentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const envio = response.data;
    return {
      success: true,
      status: envio.status,
      description: envio.status_history?.slice(-1)[0]?.description || envio.status,
      trackingNumber: envio.tracking_number,
      trackingUrl: envio.tracking_url,
    };
  } catch (error: any) {
    return { success: false, error: 'Falha ao buscar detalhes do envio.' };
  }
}


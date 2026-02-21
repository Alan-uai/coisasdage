
'use server';

import axios from 'axios';

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
            caption: `📦 *Etiqueta Gerada!*\nPedido: #${shortId}\n\n_Imprima e prepare o pacote._`
        }, {
            headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` }
        });
    } catch (e) {
        console.error('Erro ao enviar etiqueta via Whapi:', e);
    }
}

/**
 * ENVIO AUTOMÁTICO PARA WHAPI CLOUD
 */
export async function automateShippingLabel(merchantOrderId: string, orderId: string) {
  if (!WHAPI_TOKEN) return;

  try {
    const shipmentId = await getShipmentIdFromOrder(merchantOrderId);
    if (!shipmentId) throw new Error('Shipment ID não encontrado.');

    const labelData = await getMLShipmentLabel(shipmentId);
    if (!labelData.success || !labelData.base64) throw new Error('Falha ao gerar PDF.');

    await sendLabelToAdmin(labelData.base64, orderId);

    console.log(`Etiqueta do pedido ${orderId} enviada via Whapi.`);
  } catch (error: any) {
    console.error('Falha na automação Whapi:', error.message);
  }
}

/**
 * BUSCAR STATUS E RASTREAMENTO
 */
export async function getMLShipmentTracking(shipmentId: string) {
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
    console.error('Error fetching ML tracking:', error.response?.data || error.message);
    return { success: false, error: 'Falha ao buscar rastreio.' };
  }
}

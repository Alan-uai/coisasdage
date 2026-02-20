
'use server';

import axios from 'axios';

/**
 * @fileOverview Integração com Mercado Livre Envios usando Server Actions.
 * As chaves devem estar configuradas no arquivo .env
 */

const ML_CLIENT_ID = process.env.ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const ML_REFRESH_TOKEN = process.env.ML_REFRESH_TOKEN;

/**
 * Atualiza o access_token usando o refresh_token configurado.
 */
async function getAccessToken(): Promise<string> {
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET || !ML_REFRESH_TOKEN) {
    throw new Error('Credenciais do Mercado Livre não configuradas no .env');
  }

  const response = await axios.post(
    'https://api.mercadolibre.com/oauth/token',
    {
      grant_type: 'refresh_token',
      client_id: ML_CLIENT_ID,
      client_secret: ML_CLIENT_SECRET,
      refresh_token: ML_REFRESH_TOKEN,
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  return response.data.access_token;
}

/**
 * Busca detalhes de um pedido no Mercado Livre.
 */
export async function getMLOrder(orderId: string) {
  try {
    const accessToken = await getAccessToken();
    const res = await axios.get(`https://api.mercadolibre.com/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { success: true, data: res.data };
  } catch (error: any) {
    console.error('Error fetching ML order:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || 'Falha ao buscar pedido' };
  }
}

/**
 * Busca detalhes de um envio (shipment).
 */
export async function getMLShipment(shipmentId: string) {
  try {
    const accessToken = await getAccessToken();
    const res = await axios.get(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { success: true, data: res.data };
  } catch (error: any) {
    console.error('Error fetching ML shipment:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || 'Falha ao buscar envio' };
  }
}

/**
 * Gera a etiqueta de envio em formato Base64 (PDF).
 */
export async function getMLShipmentLabel(shipmentId: string) {
  try {
    const accessToken = await getAccessToken();
    const res = await axios.get(`https://api.mercadolibre.com/shipment_labels`, {
      params: {
        shipment_ids: shipmentId,
        response_type: 'pdf',
      },
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
    });

    return {
      success: true,
      base64: Buffer.from(res.data).toString('base64'),
    };
  } catch (error: any) {
    console.error('Error fetching ML label:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || 'Falha ao gerar etiqueta' };
  }
}

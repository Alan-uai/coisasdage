'use server';

import axios from 'axios';

/**
 * @fileOverview Integração robusta com Mercado Livre Envios.
 * Gerencia tokens, criação de envios, etiquetas e rastreamento.
 */

const ML_API = "https://api.mercadolibre.com";
const ML_CLIENT_ID = process.env.ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const ML_REFRESH_TOKEN = process.env.ML_REFRESH_TOKEN;
const ARTESA_WPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";

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
 * BUSCAR ETIQUETA PDF E GERAR LINK WHATSAPP
 */
export async function getMLShipmentLabel(shipmentId: string) {
  try {
    const accessToken = await getAccessToken();
    
    // O Mercado Livre retorna a etiqueta em PDF
    const res = await axios.get(`${ML_API}/shipment_labels`, {
      params: {
        shipment_ids: shipmentId,
        response_type: 'pdf',
      },
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
    });

    const base64 = Buffer.from(res.data).toString('base64');
    
    // Gera link do WhatsApp para a artesã com a instrução automática
    const mensagem = encodeURIComponent(
      `Olá! O pedido com Shipment ID ${shipmentId} foi marcado como ENVIADO. 🚚\n\nAqui está a etiqueta para impressão (gerada automaticamente pelo sistema).`
    );
    const whatsappLink = `https://wa.me/${ARTESA_WPP}?text=${mensagem}`;

    return {
      success: true,
      base64,
      whatsappLink
    };
  } catch (error: any) {
    console.error('Error fetching ML label:', error.response?.data || error.message);
    return { success: false, error: 'Não foi possível gerar a etiqueta automática.' };
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

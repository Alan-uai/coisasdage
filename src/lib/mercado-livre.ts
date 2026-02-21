
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
}

/**
 * 1️⃣ CRIAR ENVIO (Shipment)
 * Necessário que o produto/vendedor tenha Mercado Envios ativo.
 */
export async function createMLShipment(orderId: string, items: any[], address: any) {
  try {
    const accessToken = await getAccessToken();
    const response = await axios.post(
      `${ML_API}/shipments`,
      {
        receiver_address: address,
        items: items.map(item => ({
          id: item.productId,
          quantity: item.quantity
        }))
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    return { success: true, shipmentId: response.data.id };
  } catch (error: any) {
    console.error('Error creating ML shipment:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || 'Falha ao criar envio' };
  }
}

/**
 * 2️⃣ GERAR ETIQUETA PDF (Base64)
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
    const url = `data:application/pdf;base64,${base64}`;
    
    // Gera link do WhatsApp para a artesã com o link da etiqueta (simulado)
    const mensagem = encodeURIComponent(
      `Etiqueta de envio pronta para o Shipment ID: ${shipmentId} 😊\n\nPor favor, imprima e anexe ao pacote.`
    );
    const whatsappLink = `https://wa.me/${ARTESA_WPP}?text=${mensagem}`;

    return {
      success: true,
      base64,
      whatsappLink
    };
  } catch (error: any) {
    console.error('Error fetching ML label:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || 'Falha ao gerar etiqueta' };
  }
}

/**
 * 3️⃣ ATUALIZAR STATUS E RASTREAMENTO
 */
export async function getMLShipmentTracking(shipmentId: string) {
  try {
    const accessToken = await getAccessToken();
    const response = await axios.get(`${ML_API}/shipments/${shipmentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const envio = response.data;
    const eventos = envio.tracking_events?.map((e: any) => ({
      status: e.status,
      description: e.description,
      location: e.location,
      date: e.date
    })) || [];

    return {
      success: true,
      status: envio.status,
      substatus: envio.substatus,
      trackingNumber: envio.tracking_number,
      trackingUrl: envio.tracking_url,
      events: eventos
    };
  } catch (error: any) {
    console.error('Error updating ML status:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || 'Falha ao buscar rastreio' };
  }
}

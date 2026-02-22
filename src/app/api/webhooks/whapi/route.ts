import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collectionGroup, query, getDocs, updateDoc, serverTimestamp, doc } from 'firebase/firestore';
import axios from 'axios';
import { generateLabelAndNotify } from '@/lib/mercado-livre';

export const dynamic = 'force-dynamic';

const ARTESA_WPP = process.env.NEXT_PUBLIC_APP_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const TEST_ID = process.env.WHAPI_TEST_ID || "teste";
const AUTHORIZED_NUMBERS_RAW = process.env.AUTHORIZED_NUMBERS || "";

/**
 * Função unificada para processar atualizações do Whapi Cloud.
 * Suporta múltiplos usuários autorizados via AUTHORIZED_NUMBERS no .env.
 */
async function processWhapiWebhook(request: NextRequest) {
    if (!WHAPI_TOKEN) {
        return NextResponse.json({ error: 'Whapi Token não configurado' }, { status: 500 });
    }

    try {
        const body = await request.json();
        
        const message = body.messages?.[0] || 
                        body.chats_updates?.[0]?.after_update?.last_message ||
                        body.chats_updates?.[0]?.before_update?.last_message ||
                        body.last_message || 
                        body.after_update?.last_message || 
                        body.chats?.[0]?.last_message;

        if (!message) {
            return NextResponse.json({ status: 'ignorado: sem conteúdo de mensagem' });
        }

        const adminNumberOnly = ARTESA_WPP.replace(/\D/g, '');
        const authorizedNumbers = AUTHORIZED_NUMBERS_RAW.split(',')
            .map(n => n.trim().replace(/\D/g, ''))
            .filter(n => n.length > 0);

        const senderId = message.from || "";
        const senderNumber = senderId.split('@')[0].replace(/\D/g, '');
        
        const isFromMe = !!message.from_me;
        const isAdminNumber = senderNumber === adminNumberOnly;
        const isAuthorizedNumber = authorizedNumbers.includes(senderNumber);
        
        const isSelfChat = message.chat_id?.includes(adminNumberOnly);
        const isAuthorized = isFromMe || isAdminNumber || isAuthorizedNumber || isSelfChat;
        
        if (!isAuthorized) {
            return NextResponse.json({ status: 'ignorado: remetente não autorizado', sender: senderNumber });
        }

        const textRaw = typeof message.text === 'string' ? message.text : (message.text?.body || '');
        const text = textRaw.trim();
        
        if (!text || !text.startsWith('#')) {
            return NextResponse.json({ status: 'não é um comando' });
        }

        const textLower = text.toLowerCase();
        const testCommand = `#${TEST_ID.toLowerCase()}`;
        const chatId = message.chat_id || `${adminNumberOnly}@s.whatsapp.net`;
        const isGroup = chatId.includes('@g.us');

        // 1. Comando de Teste
        if (textLower === testCommand || textLower === '#teste') {
            let replyText = `✅ *Conexão Coisas da Gê OK!*\n\nO sistema reconheceu seu número como autorizado para gerenciar encomendas.`;
            
            if (isGroup) {
                replyText += `\n\n📌 *ID DESTE GRUPO*: \`${chatId}\`\n_Copie este ID para o seu .env como WHATSAPP_GROUP_ID para receber orçamentos aqui._`;
            }

            await axios.post('https://gate.whapi.cloud/messages/text', {
                to: chatId,
                body: replyText
            }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
            
            return NextResponse.json({ success: 'teste concluído' });
        }

        const { firestore } = initializeFirebase();

        // 2. Processar Comandos de Orçamento (#ID Aprovado/Recusado)
        const budgetMatch = text.match(/#(\w+)\s+(Aprovado|Recusado)(?:\s+(\d+))?/i);
        if (budgetMatch) {
            const [_, commandId, statusText, daysText] = budgetMatch;
            const status = statusText.toLowerCase() === 'aprovado' ? 'Approved' : 'Cancelled';
            const productionDays = daysText ? parseInt(daysText) : null;
            
            const q = query(collectionGroup(firestore, 'custom_requests'));
            const querySnapshot = await getDocs(q);
            
            let targetDoc: any = null;
            querySnapshot.forEach((d) => {
                if (d.id === commandId) {
                    targetDoc = d;
                }
            });

            if (!targetDoc) {
                await axios.post('https://gate.whapi.cloud/messages/text', {
                    to: chatId,
                    body: `❌ Pedido *#${commandId}* não encontrado.`
                }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
                return NextResponse.json({ error: 'Pedido não encontrado' });
            }

            await updateDoc(targetDoc.ref, {
                status,
                productionDays: productionDays || targetDoc.data().productionDays || 7,
                updatedAt: serverTimestamp()
            });

            let responseMsg = `✅ Pedido *#${commandId}* atualizado para *${statusText}*!`;
            if (status === 'Approved') {
                responseMsg += `\n⏳ Prazo: ${productionDays || 7} dias de produção.`;
                responseMsg += `\n\n_Ação confirmada por: ${senderNumber || 'Administrador'}_`;
            } else {
                responseMsg += `\n\n_A solicitação foi cancelada no sistema._`;
            }

            await axios.post('https://gate.whapi.cloud/messages/text', {
                to: chatId,
                body: responseMsg
            }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });

            return NextResponse.json({ success: true, command: 'budget_update' });
        }

        // 3. Processar Comando de Pedido Pronto (#ID Pronto) - NOVO FLUXO
        const readyMatch = text.match(/#(\w+)\s+(Pronto)/i);
        if (readyMatch) {
            const [_, commandId] = readyMatch;

            const q = query(collectionGroup(firestore, 'orders'));
            const querySnapshot = await getDocs(q);

            let targetDoc: any = null;
            querySnapshot.forEach((d) => {
                if (d.id === commandId) {
                    targetDoc = d;
                }
            });

            if (!targetDoc) {
                await axios.post('https://gate.whapi.cloud/messages/text', {
                    to: chatId,
                    body: `❌ Pedido *#${commandId}* não encontrado para marcar como pronto.`
                }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
                return NextResponse.json({ error: 'Pedido não encontrado' });
            }

            const orderData = targetDoc.data();
            const orderRef = targetDoc.ref;

            if (orderData.status !== 'IN_PRODUCTION') {
                 await axios.post('https://gate.whapi.cloud/messages/text', {
                    to: chatId,
                    body: `⚠️ Pedido *#${commandId}* não está "Em Produção". Status atual: ${orderData.status}. Ação cancelada.`
                }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
                return NextResponse.json({ error: 'Status do pedido inválido para esta ação.' });
            }

            // Atualiza status para 'READY' e libera a trava de segurança para envio
            await updateDoc(orderRef, {
                status: 'READY',
                shippingAllowed: true,
                updatedAt: serverTimestamp()
            });

            // Envia resposta inicial e inicia a geração da etiqueta em background
            await axios.post('https://gate.whapi.cloud/messages/text', {
                to: chatId,
                body: `✅ Pedido *#${commandId}* marcado como *Pronto*. \n\nIniciando geração de etiqueta... Você receberá em breve.`
            }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
            
            // Chama a função de logística (não bloqueante para o webhook)
            generateLabelAndNotify(firestore, orderRef, orderData.merchantOrderId, targetDoc.id)
              .catch(async (e) => {
                console.error(`Erro no processo de etiqueta para ${targetDoc.id}:`, e);
                await axios.post('https://gate.whapi.cloud/messages/text', {
                    to: chatId,
                    body: `❌ Falha ao gerar etiqueta para o pedido *#${commandId}*. Verifique os logs.`
                }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
              });

            return NextResponse.json({ success: true, command: 'order_ready_triggered' });
        }
        
        // Se nenhum comando correspondeu
        return NextResponse.json({ status: 'formato inválido' });

    } catch (error: any) {
        console.error('Whapi Webhook Error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function POST(request: NextRequest) {
    return processWhapiWebhook(request);
}

export async function PATCH(request: NextRequest) {
    return processWhapiWebhook(request);
}

export async function GET() {
    return NextResponse.json({ status: 'active', message: 'Whapi Webhook endpoint is ready.' }, { status: 200 });
}

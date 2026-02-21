import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collectionGroup, query, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import axios from 'axios';

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
        
        // Estratégia de extração flexível: procura em 'messages', 'chats_updates' ou no corpo direto
        const message = body.messages?.[0] || 
                        body.chats_updates?.[0]?.after_update?.last_message ||
                        body.chats_updates?.[0]?.before_update?.last_message ||
                        body.last_message || 
                        body.after_update?.last_message || 
                        body.chats?.[0]?.last_message;

        if (!message) {
            return NextResponse.json({ status: 'ignorado: sem conteúdo de mensagem' });
        }

        // Verificação de Segurança Expandida
        const adminNumberOnly = ARTESA_WPP.replace(/\D/g, '');
        const authorizedNumbers = AUTHORIZED_NUMBERS_RAW.split(',')
            .map(n => n.trim().replace(/\D/g, ''))
            .filter(n => n.length > 0);

        // Identifica quem enviou a mensagem
        const senderId = message.from || "";
        const senderNumber = senderId.split('@')[0].replace(/\D/g, '');
        
        const isFromMe = !!message.from_me;
        const isAdminNumber = senderNumber === adminNumberOnly;
        const isAuthorizedNumber = authorizedNumbers.includes(senderNumber);
        
        // No caso de chat pessoal direto com a Whapi (self-chat)
        const isSelfChat = message.chat_id?.includes(adminNumberOnly);

        // Um usuário é autorizado se:
        // 1. A mensagem foi enviada pelo próprio celular conectado (from_me)
        // 2. O número do remetente é o número da artesã configurado
        // 3. O número do remetente está na lista de autorizados (AUTHORIZED_NUMBERS)
        // 4. É o chat pessoal da artesã
        const isAuthorized = isFromMe || isAdminNumber || isAuthorizedNumber || isSelfChat;
        
        if (!isAuthorized) {
            return NextResponse.json({ status: 'ignorado: remetente não autorizado', sender: senderNumber });
        }

        // Extrai o texto da mensagem de forma segura (string ou objeto Whapi)
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

        // 2. Processar Comandos de Pedidos (#ID Aprovado/Recusado)
        const match = text.match(/#(\w+)\s+(Aprovado|Recusado)(?:\s+(\d+))?/i);
        if (!match) return NextResponse.json({ status: 'formato inválido' });

        const [_, requestIdShort, statusText, daysText] = match;
        const status = statusText.toLowerCase() === 'aprovado' ? 'Approved' : 'Cancelled';
        const productionDays = daysText ? parseInt(daysText) : null;

        const { firestore } = initializeFirebase();
        const requestIdLower = requestIdShort.toLowerCase();
        
        const q = query(collectionGroup(firestore, 'custom_requests'));
        const querySnapshot = await getDocs(q);
        
        let targetDoc: any = null;
        querySnapshot.forEach((d) => {
            if (d.id.toLowerCase().startsWith(requestIdLower)) {
                targetDoc = d;
            }
        });

        if (!targetDoc) {
            await axios.post('https://gate.whapi.cloud/messages/text', {
                to: chatId,
                body: `❌ Pedido *#${requestIdShort.toUpperCase()}* não encontrado.`
            }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
            return NextResponse.json({ error: 'Pedido não encontrado' });
        }

        await updateDoc(targetDoc.ref, {
            status,
            productionDays: productionDays || targetDoc.data().productionDays || 7,
            updatedAt: serverTimestamp()
        });

        let responseMsg = `✅ Pedido *#${requestIdShort.toUpperCase()}* atualizado para *${statusText}*!`;
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

        return NextResponse.json({ success: true });

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

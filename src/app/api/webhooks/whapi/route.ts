import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collectionGroup, query, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import axios from 'axios';

export const dynamic = 'force-dynamic';

const ARTESA_WPP = process.env.NEXT_PUBLIC_APP_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const TEST_ID = process.env.WHAPI_TEST_ID || "teste";

/**
 * Função unificada para processar atualizações do Whapi Cloud.
 * Suporta POST (mensagens de grupos e chats) e PATCH (atualizações de chat pessoal).
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

        // Verificação de Segurança: Somente o Admin (Artesã) pode disparar comandos
        const adminNumberOnly = ARTESA_WPP.replace(/\D/g, '');
        const isFromMe = !!message.from_me;
        const isSelfChat = message.chat_id?.includes(adminNumberOnly);
        
        // Se não for do admin, ignoramos por segurança
        if (!isFromMe && !isSelfChat) {
            return NextResponse.json({ status: 'ignorado: não é do admin' });
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

        // 1. Comando de Teste Personalizado (Busca no .env)
        if (textLower === testCommand || textLower === '#teste') {
            let replyText = `✅ *Conexão Coisas da Gê OK!*\n\nO sistema recebeu seu comando via ${request.method}.`;
            
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
            responseMsg += `\n\n_O cliente já pode finalizar o pagamento pelo site._`;
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

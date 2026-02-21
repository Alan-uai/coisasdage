
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
 * Suporta tanto POST (messages) quanto PATCH (chats/updates).
 */
async function processWhapiWebhook(request: NextRequest) {
    if (!WHAPI_TOKEN) {
        return NextResponse.json({ error: 'Whapi Token não configurado' }, { status: 500 });
    }

    try {
        const body = await request.json();
        
        // ESTRATÉGIA DE EXTRAÇÃO ROBUSTA:
        // 1. Procura em 'messages' (padrão POST)
        // 2. Procura em 'last_message' (padrão PATCH/chats)
        // 3. Procura em 'after_update' (padrão updates)
        let message = body.messages?.[0] || 
                      body.last_message || 
                      body.after_update?.last_message || 
                      body.chats?.[0]?.last_message;

        if (!message) {
            return NextResponse.json({ status: 'ignorado: sem conteúdo de mensagem' });
        }

        // 1. Verificação de Segurança (Proprietário da Loja)
        // Aceita se for enviado por você (from_me) ou se o ID do chat for o seu número
        const adminNumberOnly = ARTESA_WPP.replace(/\D/g, '');
        const isFromMe = !!message.from_me;
        const isSelfChat = message.chat_id?.includes(adminNumberOnly);
        
        if (!isFromMe && !isSelfChat) {
            return NextResponse.json({ status: 'ignorado: não é do admin' });
        }

        // Extrai o texto da mensagem
        const text = (typeof message.text === 'string' ? message.text : message.text?.body)?.trim();
        
        if (!text || !text.startsWith('#')) {
            return NextResponse.json({ status: 'não é um comando' });
        }

        const textLower = text.toLowerCase();
        const testCommand = `#${TEST_ID.toLowerCase()}`;

        // 2. Processar Comando de Teste Personalizado (#WHAPI_TEST_ID)
        if (textLower === testCommand || textLower === '#teste') {
            await axios.post('https://gate.whapi.cloud/messages/text', {
                to: message.chat_id || `${adminNumberOnly}@s.whatsapp.net`,
                body: `✅ *Conexão Coisas da Gê OK!*\n\nO sistema está pronto para processar seus comandos.\n\nUse:\n#ID Aprovado [dias]\n#ID Recusado`
            }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
            return NextResponse.json({ success: 'teste concluído' });
        }

        // 3. Processar Comandos de Pedidos (#ID Aprovado/Recusado)
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
                to: message.chat_id || `${adminNumberOnly}@s.whatsapp.net`,
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
        if (status === 'Approved' && productionDays) {
            responseMsg += `\n⏳ Prazo: ${productionDays} dias de produção.`;
        }

        await axios.post('https://gate.whapi.cloud/messages/text', {
            to: message.chat_id || `${adminNumberOnly}@s.whatsapp.net`,
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

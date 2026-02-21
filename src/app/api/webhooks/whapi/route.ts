
import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collectionGroup, query, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import axios from 'axios';

export const dynamic = 'force-dynamic';

const ARTESA_WPP = process.env.NEXT_PUBLIC_APP_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const TEST_ID = process.env.WHAPI_TEST_ID || "teste";

/**
 * Webhook Whapi Cloud robusto: Processa tanto o evento 'messages' quanto 'chats'.
 */
export async function POST(request: NextRequest) {
    if (!WHAPI_TOKEN) {
        return NextResponse.json({ error: 'Whapi Token not set' }, { status: 500 });
    }

    try {
        const body = await request.json();
        
        // ESTRATÉGIA DE EXTRAÇÃO ROBUSTA
        // O Whapi pode enviar a mensagem em 'messages[0]' OU em 'last_message' (dentro de chats ou updates)
        let message = body.messages?.[0] || 
                      body.last_message || 
                      body.after_update?.last_message || 
                      body.chats?.[0]?.last_message;

        // Se não houver conteúdo de mensagem, ignora o webhook silenciosamente
        if (!message) {
            return NextResponse.json({ status: 'ignored: no message content' });
        }

        // 1. Verificação de Segurança (Proprietário da Loja)
        // Só aceita se a mensagem for sua (enviada pelo seu próprio número logado na Whapi)
        if (!message.from_me) {
            return NextResponse.json({ status: 'ignored: not from admin' });
        }

        // Verifica se o chat_id contém o seu número configurado (limpa caracteres não numéricos)
        const adminNumberOnly = ARTESA_WPP.replace(/\D/g, '');
        const isAdminChat = message.chat_id.includes(adminNumberOnly);
        
        if (!isAdminChat) {
            return NextResponse.json({ status: 'ignored: not admin chat' });
        }

        // Extrai o texto da mensagem (suporta diferentes formatos de objeto de texto)
        const text = (typeof message.text === 'string' ? message.text : message.text?.body)?.trim();
        
        if (!text || !text.startsWith('#')) {
            return NextResponse.json({ status: 'not a command' });
        }

        // 2. Processar Comando de Teste Personalizado (#WHAPI_TEST_ID)
        const textLower = text.toLowerCase();
        const testCommand = `#${TEST_ID.toLowerCase()}`;

        if (textLower === testCommand || textLower === '#teste') {
            await axios.post('https://gate.whapi.cloud/messages/text', {
                to: message.chat_id,
                body: `✅ *Conexão Coisas da Gê OK!*\n\nO sistema está pronto para processar seus comandos.\n\nUse:\n#ID Aprovado [dias]\n#ID Recusado`
            }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
            return NextResponse.json({ success: 'test' });
        }

        // 3. Processar Comandos de Pedidos (#ID Aprovado/Recusado)
        const match = text.match(/#(\w+)\s+(Aprovado|Recusado)(?:\s+(\d+))?/i);
        if (!match) return NextResponse.json({ status: 'invalid format' });

        const [_, requestIdShort, statusText, daysText] = match;
        const status = statusText.toLowerCase() === 'aprovado' ? 'Approved' : 'Cancelled';
        const productionDays = daysText ? parseInt(daysText) : null;

        const { firestore } = initializeFirebase();
        const requestIdLower = requestIdShort.toLowerCase();
        
        // Buscar o pedido no Firestore usando collectionGroup (procura em todos os usuários)
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
                to: message.chat_id,
                body: `❌ Pedido *#${requestIdShort.toUpperCase()}* não encontrado.`
            }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
            return NextResponse.json({ error: 'Not found' });
        }

        // Atualizar o status e prazo no Firestore
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
            to: message.chat_id,
            body: responseMsg
        }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Whapi Webhook Error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

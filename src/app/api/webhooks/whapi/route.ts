
import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collectionGroup, query, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import axios from 'axios';

export const dynamic = 'force-dynamic';

const ARTESA_WPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const TEST_ID = process.env.WHAPI_TEST_ID || "teste";

/**
 * Webhook Whapi Cloud: O "Controle Remoto" via WhatsApp.
 */
export async function POST(request: NextRequest) {
    if (!WHAPI_TOKEN) {
        return NextResponse.json({ error: 'Whapi Token not set' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const message = body.messages?.[0];

        // Só aceita se a mensagem for sua e enviada no chat pessoal
        if (!message || !message.from_me) {
            return NextResponse.json({ status: 'ignored' });
        }

        // Verifica se o ID do chat contém o seu número de artesã (ex: 55... dentro de 55...@s.whatsapp.net)
        const isAdminChat = message.chat_id.includes(ARTESA_WPP);
        if (!isAdminChat) {
            return NextResponse.json({ status: 'ignored: not admin chat' });
        }

        const text = message.text?.body?.trim();
        if (!text || !text.startsWith('#')) {
            return NextResponse.json({ status: 'not a command' });
        }

        // 1. Simulação de Teste Dinâmico (usando a credencial WHAPI_TEST_ID)
        const textLower = text.toLowerCase();
        const testCommand = `#${TEST_ID.toLowerCase()}`;

        if (textLower === testCommand) {
            await axios.post('https://gate.whapi.cloud/messages/text', {
                to: message.chat_id,
                body: `✅ *Conexão OK!*\n\nO sistema está pronto para processar seus comandos. Use #ID Aprovado [dias] ou #ID Recusado.`
            }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
            return NextResponse.json({ success: 'test' });
        }

        // 2. Processar Comandos Reais (#ID Aprovado/Recusado)
        // Regex simples: #ID STATUS [DIAS]
        // Ex: #A1B2C3 Aprovado 10
        const match = text.match(/#(\w+)\s+(Aprovado|Recusado)(?:\s+(\d+))?/i);
        if (!match) return NextResponse.json({ status: 'invalid format' });

        const [_, requestIdShort, statusText, daysText] = match;
        const status = statusText.toLowerCase() === 'aprovado' ? 'Approved' : 'Cancelled';
        const productionDays = daysText ? parseInt(daysText) : null;

        const { firestore } = initializeFirebase();
        const requestIdLower = requestIdShort.toLowerCase();
        
        // Buscar no Firestore
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

        // Atualizar o documento no Firestore
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

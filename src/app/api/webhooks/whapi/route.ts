
import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collectionGroup, query, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import axios from 'axios';

export const dynamic = 'force-dynamic';

const ARTESA_WPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;

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

        const isAdminChat = message.chat_id.includes(ARTESA_WPP);
        if (!isAdminChat) {
            return NextResponse.json({ status: 'ignored: not admin chat' });
        }

        const text = message.text?.body?.trim();
        if (!text || !text.startsWith('#')) {
            return NextResponse.json({ status: 'not a command' });
        }

        // Regex simples: #ID STATUS [DIAS]
        // Ex: #A1B2C3 Aprovado 10
        const match = text.match(/#(\w+)\s+(Aprovado|Recusado)(?:\s+(\d+))?/i);
        if (!match) return NextResponse.json({ status: 'invalid format' });

        const [_, requestIdShort, statusText, daysText] = match;
        const status = statusText.toLowerCase() === 'aprovado' ? 'Approved' : 'Cancelled';
        const productionDays = daysText ? parseInt(daysText) : null;

        const { firestore } = initializeFirebase();
        const requestIdLower = requestIdShort.toLowerCase();
        
        // Simulação de Teste
        if (requestIdLower === 'teste') {
            await axios.post('https://gate.whapi.cloud/messages/text', {
                to: ARTESA_WPP,
                body: `✅ *Conexão OK!*\n\nO sistema está pronto para processar seus comandos.`
            }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
            return NextResponse.json({ success: 'test' });
        }

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
                to: ARTESA_WPP,
                body: `❌ Pedido *#${requestIdShort.toUpperCase()}* não encontrado.`
            }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
            return NextResponse.json({ error: 'Not found' });
        }

        // Atualizar
        await updateDoc(targetDoc.ref, {
            status,
            productionDays: productionDays || targetDoc.data().productionDays || 7,
            updatedAt: serverTimestamp()
        });

        let responseMsg = `✅ Pedido *#${requestIdShort.toUpperCase()}* atualizado para *${statusText}*!`;
        if (productionDays) responseMsg += `\n⏳ Prazo: ${productionDays} dias de produção.`;

        await axios.post('https://gate.whapi.cloud/messages/text', {
            to: ARTESA_WPP,
            body: responseMsg
        }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Whapi Webhook Error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

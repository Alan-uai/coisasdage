import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collectionGroup, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import axios from 'axios';

export const dynamic = 'force-dynamic';

const ARTESA_WPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;

/**
 * Webhook Whapi Cloud: O "Controle Remoto" via WhatsApp.
 * Escuta comandos #ID STATUS enviados pela própria artesã para ela mesma.
 */
export async function POST(request: NextRequest) {
    if (!WHAPI_TOKEN) {
        return NextResponse.json({ error: 'Whapi Token not set' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const message = body.messages?.[0];

        // 1. SEGURANÇA: Só aceita se a mensagem foi enviada pela artesã (from_me) 
        // E de preferência no chat com ela mesma (chat_id contém o número dela)
        if (!message || !message.from_me) {
            return NextResponse.json({ status: 'ignored' });
        }

        // Verifica se a mensagem foi enviada no chat pessoal ("Você")
        // O chat_id da própria artesã na Whapi costuma ser o número dela + @s.whatsapp.net
        const isAdminChat = message.chat_id.includes(ARTESA_WPP);
        if (!isAdminChat) {
            return NextResponse.json({ status: 'ignored: not admin chat' });
        }

        const text = message.text?.body?.trim();
        if (!text || !text.startsWith('#')) {
            return NextResponse.json({ status: 'not a command' });
        }

        // SIMULAÇÃO DE TESTE
        if (text.toUpperCase() === '#TESTE APROVADO' || text.toUpperCase() === '#TESTE') {
            await axios.post('https://gate.whapi.cloud/messages/text', {
                to: ARTESA_WPP,
                body: `✅ *Teste de Conexão Bem-Sucedido!*\n\nO sistema de controle remoto está pronto para processar seus comandos reais.`
            }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
            return NextResponse.json({ success: 'test' });
        }

        // Regex para capturar: #ID STATUS [VALOR]
        // Ex: #A1B2C3 Aprovado 150.00
        const match = text.match(/#(\w+)\s+(Aprovado|Recusado)(?:\s+([\d,.]+))?/i);
        if (!match) return NextResponse.json({ status: 'invalid format' });

        const [_, requestIdShort, statusText, priceText] = match;
        const status = statusText.toLowerCase() === 'aprovado' ? 'Approved' : 'Cancelled';
        const finalPrice = priceText ? parseFloat(priceText.replace(',', '.')) : null;

        const { firestore } = initializeFirebase();

        // Buscar a solicitação no Firestore usando o ID do documento
        const requestId = requestIdShort.toLowerCase();
        const q = query(collectionGroup(firestore, 'custom_requests'));
        const querySnapshot = await getDocs(q);
        
        let targetDoc: any = null;

        querySnapshot.forEach((d) => {
            // Verifica se o ID do documento começa com o ID enviado (ID curto ou total)
            if (d.id.toLowerCase().startsWith(requestId)) {
                targetDoc = d;
            }
        });

        if (!targetDoc) {
            await axios.post('https://gate.whapi.cloud/messages/text', {
                to: ARTESA_WPP,
                body: `❌ Pedido *#${requestIdShort.toUpperCase()}* não encontrado no sistema.`
            }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
            return NextResponse.json({ error: 'Not found' });
        }

        // Atualizar Firestore com o novo status e preço
        await updateDoc(targetDoc.ref, {
            status,
            finalPrice: finalPrice || targetDoc.data().finalPrice || targetDoc.data().totalBasePrice,
            updatedAt: serverTimestamp()
        });

        let responseMessage = `✅ Pedido *#${requestIdShort.toUpperCase()}* atualizado para *${statusText}*!`;
        if (finalPrice) responseMessage += `\n💰 Valor Atualizado: R$ ${finalPrice.toFixed(2).replace('.', ',')}`;

        await axios.post('https://gate.whapi.cloud/messages/text', {
            to: ARTESA_WPP,
            body: responseMessage
        }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Whapi Webhook Error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

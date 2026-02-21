
import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collectionGroup, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import axios from 'axios';
import { getMLShipmentLabel, sendLabelToAdmin } from '@/lib/mercado-livre';

export const dynamic = 'force-dynamic';

const ARTESA_WPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;

export async function POST(request: NextRequest) {
    if (!WHAPI_TOKEN) {
        return NextResponse.json({ error: 'Whapi Token not set' }, { status: 500 });
    }

    try {
        const body = await request.json();
        
        // Whapi Cloud envia as mensagens em um array 'messages'
        const message = body.messages?.[0];
        if (!message || !message.from_me || message.chat_id !== `${ARTESA_WPP}@s.whatsapp.net`) {
            // Se não for uma mensagem enviada pela artesã para ela mesma, ignoramos
            return NextResponse.json({ status: 'ignored' });
        }

        const text = message.text?.body?.trim();
        if (!text || !text.startsWith('#')) {
            return NextResponse.json({ status: 'not a command' });
        }

        // Regex para capturar: #ID STATUS [PREÇO]
        // Ex: #A1B2C3 Aprovado 150.00
        const match = text.match(/#(\w+)\s+(Aprovado|Recusado)(?:\s+([\d,.]+))?/i);
        if (!match) return NextResponse.json({ status: 'invalid format' });

        const [_, requestIdShort, statusText, priceText] = match;
        const status = statusText.toLowerCase() === 'aprovado' ? 'Approved' : 'Cancelled';
        const finalPrice = priceText ? parseFloat(priceText.replace(',', '.')) : null;

        const { firestore } = initializeFirebase();

        // Buscar a solicitação pelo ID curto (no Firestore os IDs são longos, mas usamos o ID total do documento)
        // Como o usuário enviou um ID que enviamos via Whapi, ele será o ID do documento.
        const requestId = requestIdShort.toLowerCase();
        
        // Procurar em custom_requests
        const q = query(collectionGroup(firestore, 'custom_requests'));
        const querySnapshot = await getDocs(q);
        
        let targetDoc: any = null;
        let userId: string = '';

        querySnapshot.forEach((d) => {
            if (d.id.toLowerCase().startsWith(requestId)) {
                targetDoc = d;
                // O caminho do documento é users/{userId}/custom_requests/{requestId}
                userId = d.ref.path.split('/')[1];
            }
        });

        if (!targetDoc) {
            await axios.post('https://gate.whapi.cloud/messages/text', {
                to: ARTESA_WPP,
                body: `❌ Pedido #${requestIdShort} não encontrado.`
            }, { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` } });
            return NextResponse.json({ error: 'Not found' });
        }

        // Atualizar Firestore
        await updateDoc(targetDoc.ref, {
            status,
            finalPrice: finalPrice || targetDoc.data().totalBasePrice,
            updatedAt: serverTimestamp()
        });

        // Se foi aprovado, podemos disparar a criação de algo ou apenas avisar
        let responseMessage = `✅ Pedido #${requestIdShort} atualizado para *${statusText}*!`;
        if (finalPrice) responseMessage += `\nNovo valor: R$ ${finalPrice.toFixed(2)}`;

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

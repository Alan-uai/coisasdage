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
        
        // 1. Comando de Teste
        if (textLower === testCommand || textLower === '#teste') {
            return NextResponse.json({ success: 'teste concluído' });
        }

        const { firestore } = initializeFirebase();

        // 2. Processar Comandos de Orçamento (#ID Aprovado/Recusado)
        const budgetMatch = text.match(/#(\w+)\s+(Aprovado|Recusado)(?:\s+(.*))?/i);
        if (budgetMatch) {
            const [_, commandId, statusText, optionalPart] = budgetMatch;
            const isApproved = statusText.toLowerCase() === 'aprovado';
            const status = isApproved ? 'Approved' : 'Cancelled';

            const q = query(collectionGroup(firestore, 'custom_requests'));
            const querySnapshot = await getDocs(q);

            let targetDoc: any = null;
            querySnapshot.forEach((d) => {
                if (d.id === commandId) {
                    targetDoc = d;
                }
            });

            if (!targetDoc) {
                console.log(`[WHAPI] Orçamento com ID ${commandId} não encontrado.`);
                return NextResponse.json({ error: 'Pedido não encontrado' });
            }

            const updateData: any = {
                status,
                updatedAt: serverTimestamp()
            };

            if (isApproved) {
                const productionDays = optionalPart ? parseInt(optionalPart.trim(), 10) : null;
                updateData.productionDays = productionDays || targetDoc.data().productionDays || 7;
            } else { // É Recusado/Cancelado
                const reason = optionalPart ? optionalPart.trim() : null;
                if (reason) {
                    updateData.adminNotes = reason;
                }
            }
            
            await updateDoc(targetDoc.ref, updateData);

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
                console.log(`[WHAPI] Pedido com ID ${commandId} não encontrado para marcar como pronto.`);
                return NextResponse.json({ error: 'Pedido não encontrado' });
            }

            const orderData = targetDoc.data();
            const orderRef = targetDoc.ref;

            if (orderData.status !== 'IN_PRODUCTION') {
                console.log(`[WHAPI] Pedido ${commandId} não está em produção. Status: ${orderData.status}`);
                return NextResponse.json({ error: 'Status do pedido inválido para esta ação.' });
            }

            // Atualiza status para 'READY' e libera a trava de segurança para envio
            await updateDoc(orderRef, {
                status: 'READY',
                shippingAllowed: true,
                updatedAt: serverTimestamp()
            });
            
            // Chama a função de logística (não bloqueante para o webhook)
            generateLabelAndNotify(firestore, orderRef, orderData.merchantOrderId, targetDoc.id)
              .catch(async (e) => {
                console.error(`Erro no processo de etiqueta para ${targetDoc.id}:`, e);
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

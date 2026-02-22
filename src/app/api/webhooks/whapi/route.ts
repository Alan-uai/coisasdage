import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collectionGroup, query, getDocs, updateDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import axios from 'axios';
import { generateLabelAndNotify } from '@/lib/mercado-livre';

export const dynamic = 'force-dynamic';

const ARTESA_WPP = process.env.NEXT_PUBLIC_APP_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const TEST_ID = process.env.WHAPI_TEST_ID || "teste";
const AUTHORIZED_NUMBERS_RAW = process.env.AUTHORIZED_NUMBERS || "";

/**
 * Sends a reply message via Whapi.
 */
async function sendReply(chatId: string, text: string) {
    if (!WHAPI_TOKEN) return;
    try {
        await axios.post('https://gate.whapi.cloud/messages/text', {
            to: chatId,
            body: text,
        }, {
            headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` }
        });
    } catch (error) {
        console.error("Erro ao enviar resposta via Whapi:", error);
    }
}

/**
 * Função unificada para processar atualizações do Whapi Cloud.
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
        const chatId = message.chat_id || senderId; // Use chat_id for replies
        const senderNumber = senderId.split('@')[0].replace(/\D/g, '');
        
        const isFromMe = !!message.from_me;
        const isAdminNumber = senderNumber === adminNumberOnly;
        const isAuthorizedNumber = authorizedNumbers.includes(senderNumber);
        
        const isSelfChat = chatId.includes(adminNumberOnly);
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
        
        if (textLower === testCommand || textLower === '#teste') {
            await sendReply(chatId, "✅ Teste do webhook concluído com sucesso!");
            return NextResponse.json({ success: 'teste concluído' });
        }

        const { firestore } = initializeFirebase();

        // NOVO: Comando de Estoque (#estoque <ID> <QTD>)
        const stockMatch = text.match(/^#estoque\s+(\S+)\s+(\d+)/i);
        if (stockMatch) {
            const [_, productId, quantityStr] = stockMatch;
            const quantity = parseInt(quantityStr, 10);
            
            if (isNaN(quantity)) {
                await sendReply(chatId, `❌ Quantidade inválida para o comando de estoque.`);
                return NextResponse.json({ error: 'Quantidade inválida' });
            }

            const inventoryRef = doc(firestore, 'product_inventory', productId);
            await setDoc(inventoryRef, { quantity }, { merge: true });

            return NextResponse.json({ success: true, command: 'stock_update' });
        }

        // Processar Comandos de Orçamento (#ID Aprovado/Recusado)
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
                await sendReply(chatId, `❌ Orçamento com ID #${commandId} não encontrado.`);
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
            await sendReply(chatId, `✅ Orçamento #${commandId} foi atualizado para *${status}*.`);
            return NextResponse.json({ success: true, command: 'budget_update' });
        }

        // Processar Comando de Pedido Pronto (#ID Pronto)
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
                await sendReply(chatId, `❌ Pedido com ID #${commandId} não encontrado.`);
                return NextResponse.json({ error: 'Pedido não encontrado' });
            }

            const orderData = targetDoc.data();
            const orderRef = targetDoc.ref;

            if (orderData.status !== 'IN_PRODUCTION') {
                await sendReply(chatId, `⚠️ Pedido #${commandId} não está em produção. Status atual: ${orderData.status}`);
                return NextResponse.json({ error: 'Status do pedido inválido para esta ação.' });
            }

            await updateDoc(orderRef, {
                status: 'READY',
                shippingAllowed: true,
                updatedAt: serverTimestamp()
            });
            
            await sendReply(chatId, `⏳ Processando logística para o pedido #${commandId}... A etiqueta será enviada em breve.`);
            generateLabelAndNotify(firestore, orderRef, orderData.merchantOrderId, targetDoc.id)
              .catch(async (e) => {
                console.error(`Erro no processo de etiqueta para ${targetDoc.id}:`, e);
                await sendReply(chatId, `🚨 Erro ao gerar etiqueta para #${commandId}: ${e.message}`);
              });

            return NextResponse.json({ success: true, command: 'order_ready_triggered' });
        }
        
        await sendReply(chatId, `❓ Comando inválido. Formatos aceitos:\n- #estoque <ID> <QTD>\n- #<ID_ORCAMENTO> Aprovado/Recusado\n- #<ID_PEDIDO> Pronto`);
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

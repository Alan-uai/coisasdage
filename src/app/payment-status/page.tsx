'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Suspense, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Order } from '@/lib/types';

function PaymentStatusContent() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    const paramPaymentId = searchParams.get('payment_id');
    const paramMerchantOrderId = searchParams.get('merchant_order_id');
    const orderId = searchParams.get('order_id');
    
    const { user } = useUser();
    const firestore = useFirestore();

    // Monitor the order in real-time to see webhook updates
    const orderDocRef = useMemoFirebase(() => 
        (user && firestore && orderId) ? doc(firestore, 'users', user.uid, 'orders', orderId) : null,
        [user, firestore, orderId]
    );
    const { data: orderData } = useDoc<Order>(orderDocRef);

    const statusConfig = {
        success: {
            icon: <CheckCircle2 className="size-16 text-green-500" />,
            title: 'Pagamento Aprovado!',
            description: 'Seu pedido foi recebido e já estamos preparando tudo.'
        },
        failure: {
            icon: <XCircle className="size-16 text-destructive" />,
            title: 'Pagamento Recusado',
            description: 'Não foi possível processar seu pagamento. Por favor, tente novamente.'
        },
        pending: {
            icon: <AlertCircle className="size-16 text-yellow-500" />,
            title: 'Pagamento Pendente',
            description: 'Seu pagamento está em análise. Avisaremos assim que for aprovado.'
        }
    };

    const currentStatus = status === 'success' || status === 'failure' || status === 'pending'
        ? statusConfig[status]
        : {
            icon: <AlertCircle className="size-16 text-muted-foreground" />,
            title: 'Status Desconhecido',
            description: 'Houve um problema ao verificar seu pagamento.'
        };

    const displayPaymentId = orderData?.paymentId || paramPaymentId;
    const displayMerchantOrderId = orderData?.merchantOrderId || (paramMerchantOrderId !== 'null' ? paramMerchantOrderId : null);

    return (
        <div className="flex flex-col flex-1 items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardHeader className="items-center text-center">
                    {currentStatus.icon}
                    <CardTitle className="text-2xl font-bold mt-4">{currentStatus.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-6">
                    {(displayPaymentId || displayMerchantOrderId) && (
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-2 text-blue-800 text-sm text-left">
                            <div className="flex items-center gap-2 font-bold mb-1">
                                <Info className="size-5 shrink-0" />
                                <span>Dados para Homologação (Go Live)</span>
                            </div>
                            {displayPaymentId && <p><strong>ID do Pagamento:</strong> {displayPaymentId}</p>}
                            {displayMerchantOrderId ? (
                                <p><strong>Merchant Order ID (ORD...):</strong> {displayMerchantOrderId}</p>
                            ) : (
                                <p className="text-xs italic opacity-70">Aguardando Merchant Order via Webhook...</p>
                            )}
                            <p className="text-xs italic opacity-80 pt-1">Use esses IDs para o formulário do Mercado Pago.</p>
                        </div>
                    )}

                    <p className="text-muted-foreground">{currentStatus.description}</p>
                    <Button asChild className="w-full">
                        <Link href={status === 'failure' ? '/checkout' : '/orders'}>
                            {status === 'failure' ? 'Tentar Novamente' : 'Ver Meus Pedidos'}
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

export default function PaymentStatusPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-1 items-center justify-center p-4">
                <div className="animate-pulse text-muted-foreground">Carregando status...</div>
            </div>
        }>
            <PaymentStatusContent />
        </Suspense>
    );
}

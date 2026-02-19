'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Suspense } from 'react';

function PaymentStatusContent() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    const paymentId = searchParams.get('payment_id');
    const merchantOrderId = searchParams.get('merchant_order_id');

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

    return (
        <div className="flex flex-col flex-1 items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardHeader className="items-center text-center">
                    {currentStatus.icon}
                    <CardTitle className="text-2xl font-bold mt-4">{currentStatus.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-6">
                    {(paymentId || merchantOrderId) && (
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-2 text-blue-800 text-sm text-left">
                            <div className="flex items-center gap-2 font-bold mb-1">
                                <Info className="size-5 shrink-0" />
                                <span>Dados para Homologação (Go Live)</span>
                            </div>
                            {paymentId && <p><strong>ID do Pagamento:</strong> {paymentId}</p>}
                            {merchantOrderId && merchantOrderId !== 'null' && merchantOrderId !== 'undefined' && (
                                <p><strong>Merchant Order ID (ORD...):</strong> {merchantOrderId}</p>
                            )}
                            <p className="text-xs italic opacity-80 pt-1">Copie esses IDs para o formulário do Mercado Pago.</p>
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

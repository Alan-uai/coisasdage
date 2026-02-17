'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PaymentStatusPage() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status');

    const statusConfig = {
        success: {
            icon: <CheckCircle2 className="size-16 text-green-500" />,
            title: 'Pagamento Aprovado!',
            description: 'Seu pedido foi recebido e já estamos preparando tudo. Você pode acompanhar o status na página "Meus Pedidos".'
        },
        failure: {
            icon: <XCircle className="size-16 text-destructive" />,
            title: 'Pagamento Recusado',
            description: 'Não foi possível processar seu pagamento. Por favor, tente novamente ou use outro método de pagamento.'
        },
        pending: {
            icon: <AlertCircle className="size-16 text-yellow-500" />,
            title: 'Pagamento Pendente',
            description: 'Seu pagamento está pendente de confirmação. Avisaremos assim que for aprovado.'
        }
    };

    const currentStatus = status === 'success' || status === 'failure' || status === 'pending'
        ? statusConfig[status]
        : {
            icon: <AlertCircle className="size-16 text-muted-foreground" />,
            title: 'Status de Pagamento Desconhecido',
            description: 'Ocorreu um problema ao verificar o status do seu pagamento.'
        };

    return (
        <div className="flex flex-col flex-1 items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardHeader className="items-center text-center">
                    {currentStatus.icon}
                    <CardTitle className="text-2xl font-bold mt-4">{currentStatus.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-6">
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

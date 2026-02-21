
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      <header className="text-center space-y-4">
        <ShieldCheck className="size-12 text-primary mx-auto" />
        <h1 className="text-4xl font-bold font-headline">Termos e Condições</h1>
        <p className="text-muted-foreground">Diretrizes da Artesã para uma experiência harmoniosa.</p>
      </header>

      <main className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
        <ScrollArea className="h-[60vh] rounded-md border p-6 bg-card">
          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-bold">1. Natureza Artesanal</h2>
              <p>
                Cada peça da <strong>Coisas da Gê</strong> é única e feita à mão. Pequenas variações em cores, texturas ou dimensões são características intrínsecas ao processo artesanal e não constituem defeitos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">2. Pedidos Sob Demanda</h2>
              <p>
                Produtos personalizados ou sob encomenda possuem prazos de produção específicos, acordados via WhatsApp. A produção inicia-se apenas após a confirmação do pagamento ou sinal.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">3. Pagamentos e Reembolsos</h2>
              <p>
                Utilizamos o Mercado Pago para transações seguras. Em caso de cancelamento de pedidos sob demanda após o início da confecção, reservamo-nos o direito de reter o valor referente aos materiais já utilizados.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">4. Entrega e Logística</h2>
              <p>
                Utilizamos o Mercado Envios para garantir segurança na entrega. O prazo de entrega começa a contar a partir da postagem do produto pronto. Não nos responsabilizamos por atrasos decorrentes de greves ou problemas operacionais dos Correios/Transportadoras.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold">5. Privacidade</h2>
              <p>
                Seus dados de navegação e endereço são utilizados exclusivamente para o processamento de seus pedidos e melhoria da sua experiência no site. Não compartilhamos informações com terceiros.
              </p>
            </section>
          </div>
        </ScrollArea>
        <p className="mt-8 text-xs text-center text-muted-foreground italic">
          Última atualização: {new Date().toLocaleDateString('pt-BR')}
        </p>
      </main>
    </div>
  );
}

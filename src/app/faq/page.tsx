import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { HelpCircle } from "lucide-react";

export default function FaqPage() {
  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-col items-center text-center">
        <HelpCircle className="size-12 text-primary mb-4" />
        <h1 className="text-4xl font-bold tracking-tight font-headline">Perguntas Frequentes</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Tire suas dúvidas mais comuns sobre nossos produtos e políticas.
        </p>
      </header>
      <main className="flex-1 flex justify-center">
        <div className="w-full max-w-2xl">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg text-left">Vende fiado?</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">
                Não, todas as compras devem ser pagas integralmente no momento do pedido para que a produção artesanal seja iniciada.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg text-left">Se eu fornecer o material (linha), ganho desconto?</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">
                Não oferecemos descontos para o fornecimento de material pelo cliente. O valor dos nossos produtos está majoritariamente no tempo, na técnica e no trabalho manual dedicado a cada peça exclusiva.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </main>
    </div>
  );
}

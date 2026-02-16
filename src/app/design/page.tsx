import { DesignForm } from "./design-form";
import { Palette } from "lucide-react";

export default function DesignPage() {
  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-col items-center text-center">
        <Palette className="size-12 text-primary mb-4" />
        <h1 className="text-4xl font-bold tracking-tight font-headline">Visualize Seu Tapete</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Descreva o tapete dos seus sonhos e nossa IA criará uma visualização para você. 
          Inclua detalhes como estilo, cores, padrões e o ambiente onde ele ficará.
        </p>
      </header>
      <main className="flex-1 flex justify-center">
        <div className="w-full max-w-4xl">
          <DesignForm />
        </div>
      </main>
    </div>
  );
}

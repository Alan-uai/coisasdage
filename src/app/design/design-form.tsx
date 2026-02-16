'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { visualizeCustomRugDesignAction } from './actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Sparkles, Image as ImageIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  description: z.string().min(20, {
    message: "Por favor, forneça uma descrição com pelo menos 20 caracteres.",
  }),
});

type DesignResult = {
  imageUrl: string;
  designDescription: string;
};

export function DesignForm() {
  const [result, setResult] = useState<DesignResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setError(null);
    setResult(null);

    const result = await visualizeCustomRugDesignAction(values);
    
    setIsLoading(false);

    if (result.success && result.data) {
      setResult(result.data);
    } else {
      setError(result.error || "Ocorreu um erro ao gerar o design. Tente novamente.");
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg font-semibold">Descreva seu design</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ex: um tapete redondo de lã em tons de verde sálvia e creme, com um padrão sutil de folhas, para uma sala de estar aconchegante."
                        className="min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Gerar Design
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
             <Skeleton className="w-full aspect-video rounded-lg" />
             <Skeleton className="h-4 w-3/4 mt-4" />
             <Skeleton className="h-4 w-1/2 mt-2" />
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-6 text-center text-destructive">
            <p className="font-semibold">Erro!</p>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <h3 className="text-2xl font-bold font-headline mb-4 text-center">Seu Design Personalizado!</h3>
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-full aspect-video overflow-hidden rounded-lg border">
                <Image src={result.imageUrl} alt={result.designDescription} fill className="object-contain" />
              </div>
              <p className="text-muted-foreground text-center italic mt-2">{result.designDescription}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !result && !error && (
        <div className="text-center text-muted-foreground py-10 border-2 border-dashed rounded-lg flex flex-col items-center justify-center">
          <ImageIcon className="size-12 mb-4" />
          <p className="font-semibold">Seu design aparecerá aqui</p>
          <p className="text-sm">Preencha o formulário acima para começar.</p>
        </div>
      )}
    </div>
  );
}

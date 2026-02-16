'use server';

import { visualizeCustomRugDesign } from '@/ai/flows/visualize-custom-rug-design';
import { z } from 'zod';

const formSchema = z.object({
  description: z.string(),
});

type State = {
  success: boolean;
  data?: {
    imageUrl: string;
    designDescription: string;
  };
  error?: string | null;
}

export async function visualizeCustomRugDesignAction(
  values: z.infer<typeof formSchema>
): Promise<State> {
  const validatedFields = formSchema.safeParse(values);

  if (!validatedFields.success) {
    return { 
      success: false,
      error: 'Entrada inválida.',
    };
  }

  try {
    const result = await visualizeCustomRugDesign(validatedFields.data);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: 'Falha ao visualizar o design. Por favor, tente novamente mais tarde.',
    };
  }
}

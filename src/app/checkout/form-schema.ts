import { z } from 'zod';

export const addressSchema = z.object({
  cpf: z.string().min(11, { message: "CPF deve ter pelo menos 11 dígitos." }).max(14, { message: "CPF inválido."}),
  streetName: z.string().min(3, { message: "Nome da rua é obrigatório." }),
  streetNumber: z.string().min(1, { message: "Número é obrigatório." }),
  zipCode: z.string().min(8, { message: "CEP deve ter pelo menos 8 dígitos." }).max(9, { message: "CEP inválido."}),
  city: z.string().min(2, { message: "Cidade é obrigatória." }),
  state: z.string().min(2, { message: "Estado (UF) é obrigatório." }).max(2, { message: "Use a sigla do estado (ex: SP)."}),
});

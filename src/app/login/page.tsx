import { LogIn } from 'lucide-react';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center p-4">
      <div className="flex flex-col items-center text-center max-w-sm w-full">
        <LogIn className="size-12 text-primary mb-4" />
        <h1 className="text-4xl font-bold tracking-tight font-headline">Acesse sua Conta</h1>
        <p className="text-muted-foreground mt-2">
          Faça login com sua conta Google para ver seus pedidos e salvar suas criações.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}

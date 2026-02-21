
'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, updateDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { 
  Dialog as ShadDialog,
  DialogContent as ShadContent,
  DialogHeader as ShadHeader,
  DialogTitle as ShadTitle,
  DialogDescription as ShadDescription,
  DialogFooter as ShadFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldCheck, Loader2 } from 'lucide-react';
import type { UserProfile } from '@/lib/types';

export function TermsAgreementDialog() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [open, setOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  // Memoize the profile document reference to prevent infinite re-renders
  const profileRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  
  const { data: profile, isLoading } = useDoc<UserProfile>(profileRef);

  useEffect(() => {
    // Show dialog if user is logged in, profile is loaded, and terms are NOT accepted
    if (user && profile && !profile.termsAccepted) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [user, profile]);

  const handleAccept = () => {
    if (!user || !firestore) return;
    setIsAccepting(true);

    const userRef = doc(firestore, 'users', user.uid);
    updateDocumentNonBlocking(userRef, {
      termsAccepted: true,
    });
    
    // The real-time listener will close the dialog once Firestore updates
  };

  // If no user or already accepted, render nothing
  if (!user || (profile && profile.termsAccepted)) return null;

  return (
    <ShadDialog open={open} onOpenChange={() => {}}>
      <ShadContent className="max-w-2xl sm:max-w-[600px] [&>button]:hidden">
        <ShadHeader className="space-y-4">
          <ShieldCheck className="size-10 text-primary mx-auto" />
          <ShadTitle className="text-2xl text-center">Bem-vinda(o) ao nosso Ateliê!</ShadTitle>
          <ShadDescription className="text-center">
            Para continuar, por favor leia e aceite nossas diretrizes de compra artesanal.
          </ShadDescription>
        </ShadHeader>

        <div className="py-4">
          <ScrollArea className="h-[300px] border rounded-md p-4 bg-muted/30">
            <div className="space-y-4 text-sm leading-relaxed">
              <p className="font-bold">1. Natureza Artesanal</p>
              <p>Entendo que cada peça é feita à mão e pode apresentar pequenas variações que a tornam única.</p>
              
              <p className="font-bold">2. Pedidos Sob Demanda</p>
              <p>Aceito que prazos de produção são acordados via WhatsApp e a confecção só inicia após o pagamento.</p>

              <p className="font-bold">3. Logística</p>
              <p>Concordo com a utilização do Mercado Pago e Mercado Envios para maior segurança na transação.</p>

              <p className="font-bold">4. Privacidade</p>
              <p>Autorizo o uso dos meus dados apenas para o processamento das minhas encomendas.</p>
            </div>
          </ScrollArea>
        </div>

        <ShadFooter className="sm:justify-center">
          <Button 
            onClick={handleAccept} 
            className="w-full sm:w-auto px-8 h-12 text-lg font-bold"
            disabled={isAccepting}
          >
            {isAccepting ? <Loader2 className="animate-spin mr-2" /> : null}
            Concordo e Desejo Continuar
          </Button>
        </ShadFooter>
      </ShadContent>
    </ShadDialog>
  );
}

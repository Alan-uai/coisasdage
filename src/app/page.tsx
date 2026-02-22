
import Image from 'next/image';
import { getProducts, getLogoUrl } from '@/lib/cloudinary';
import { Instagram, Facebook, Twitter, Mail, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';
import { ProductListClient } from '@/components/product-list-client';

export default async function ProductsPage() {
  const [logoUrl, products] = await Promise.all([
    getLogoUrl(),
    getProducts()
  ]);

  // Configurações vindas do .env
  const socialLinks = {
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "#",
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || "#",
    twitter: process.env.NEXT_PUBLIC_TWITTER_URL || "#",
  };

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
  const whatsappLink = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}`;

  const contactInfo = {
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "ola@coisasdage.com.br",
    phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "+55 (11) 99999-9999",
    location: process.env.NEXT_PUBLIC_LOCATION_TEXT || "Feito à mão no interior de SP",
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8 space-y-12">
        <header className="text-center">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="Coisas da Gê"
              width={300}
              height={100}
              className="mx-auto"
              priority
            />
          ) : (
            <h1 className="text-4xl font-bold tracking-tight font-headline">Coisas da Gê</h1>
          )}
          <p className="text-muted-foreground mt-2">Explore nossas criações feitas à mão com amor.</p>
        </header>
        
        <ProductListClient allProducts={products} />

        <footer className="mt-20 pt-12 border-t border-primary/20 bg-primary text-primary-foreground -mx-4 sm:-mx-6 lg:-mx-8 px-8 py-12 rounded-t-3xl">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="space-y-6">
              <h3 className="text-xs uppercase tracking-widest opacity-70 font-bold">Redes Sociais</h3>
              <div className="flex gap-6">
                <Link href={socialLinks.instagram} target="_blank" className="hover:opacity-80 transition-opacity"><Instagram className="size-6" /></Link>
                <Link href={socialLinks.facebook} target="_blank" className="hover:opacity-80 transition-opacity"><Facebook className="size-6" /></Link>
                <Link href={socialLinks.twitter} target="_blank" className="hover:opacity-80 transition-opacity"><Twitter className="size-6" /></Link>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs uppercase tracking-widest opacity-70 font-bold">Contato</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="size-5 text-accent" />
                  <span className="text-sm">{contactInfo.email}</span>
                </div>
                <Link href={whatsappLink} target="_blank" className="flex items-center gap-3 group">
                  <Phone className="size-5 text-accent" />
                  <span className="text-sm group-hover:underline">{contactInfo.phone}</span>
                </Link>
                <div className="flex items-center gap-3">
                  <MapPin className="size-5 text-accent" />
                  <span className="text-sm">{contactInfo.location}</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs uppercase tracking-widest opacity-70 font-bold">Institucional</h3>
              <div className="flex flex-col gap-3 text-sm">
                <Link href="/terms" className="hover:underline">Termos e Condições</Link>
                <Link href="/faq" className="hover:underline">Perguntas Frequentes (FAQ)</Link>
              </div>
            </div>

            <div className="space-y-6 lg:text-right">
              <h3 className="text-xl font-bold font-headline">Coisas da Gê</h3>
              <p className="text-xs opacity-60 leading-relaxed">
                Cada peça é única, feita com cuidado e dedicação para levar aconchego ao seu lar.
              </p>
              <div className="pt-4 text-[10px] opacity-40">
                © {new Date().getFullYear()} Coisas da Gê. Todos os direitos reservados.
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

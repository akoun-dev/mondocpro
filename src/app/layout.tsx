import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MondocPro — Votre santé, à domicile",
  description:
    "MondocPro : prise de rendez-vous médicaux au cabinet ou à domicile, épargne santé Tokens et sensibilisations — Yopougon, Songon, PK22, N'Dotré (Côte d'Ivoire).",
  icons: {
    icon: "/img/mondocpro.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      {/* suppressHydrationWarning : l'environnement d'exécution (extension navigateur /
          script d'intégration du preview) injecte des attributs (ex. bis_status,
          __processed_*) sur <body> après le rendu serveur, ce qui provoque un faux
          mismatch d'hydratation. Voir BUG-001 (.ai/BUGS.md) et ADR-002 pour le design. */}
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

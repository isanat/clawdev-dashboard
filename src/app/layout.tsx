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
  title: "CLAWDEV - Autonomous Agent Dashboard v6.0",
  description: "Dashboard profissional para o agente autônomo CLAWDEV. Monitoramento em tempo real, OODA loop ativo, chat AI com fallbacks e sistema de auto-aprendizado.",
  keywords: ["CLAWDEV", "Autonomous Agent", "OODA Loop", "AI", "Monitoring", "Dashboard"],
  authors: [{ name: "CLAWDEV Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "CLAWDEV Dashboard",
    description: "Autonomous Agent Dashboard with real-time monitoring",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

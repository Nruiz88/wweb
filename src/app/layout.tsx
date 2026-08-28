import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#111b21" },
    { media: "(prefers-color-scheme: light)", color: "#111b21" },
  ],
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: {
    default: "Boti - Tu asistente de WhatsApp",
    template: "%s | Boti",
  },
  description:
    "Boti es tu asistente virtual de WhatsApp. Responde automaticamente tus clientes, 24 horas, los 7 dias. Sin contratar a nadie, sin saber de codigo.",
  keywords: [
    "WhatsApp bot",
    "respuestas automaticas WhatsApp",
    "bot de atencion al cliente",
    "bot WhatsApp Argentina",
    "Evolution API",
    "atencion al cliente",
    "automatizacion WhatsApp",
    "boti",
  ],
  authors: [{ name: "Boti" }],
  creator: "Boti",
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Boti",
    title: "Boti - Tu asistente de WhatsApp",
    description:
      "Responde automaticamente tus clientes por WhatsApp, 24/7. Sin saber de codigo, en 2 minutos.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Boti - Tu asistente de WhatsApp",
    description:
      "Responde automaticamente tus clientes por WhatsApp, 24/7.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}

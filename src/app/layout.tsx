import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-label",
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
    "Boti es tu asistente virtual de WhatsApp. Responde automáticamente tus clientes, 24 horas, los 7 días. Sin contratar a nadie, sin saber de código.",
  keywords: [
    "WhatsApp bot",
    "respuestas automáticas WhatsApp",
    "bot de atención al cliente",
    "bot WhatsApp Argentina",
    "Evolution API",
    "atención al cliente",
    "automatización WhatsApp",
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
      "Responde automáticamente tus clientes por WhatsApp, 24/7. Sin saber de código, en 2 minutos.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Boti - Tu asistente de WhatsApp",
    description:
      "Responde automáticamente tus clientes por WhatsApp, 24/7.",
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
      className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}

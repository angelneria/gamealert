import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

const appUrl = process.env.APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: "GameAlert — Juegos Gratis y Chollos en Steam, Epic y GOG",
    template: "%s | GameAlert",
  },
  description:
    "Alertas de juegos gratis y rebajados en Steam, Epic Games y GOG. Te avisamos en Discord en cuanto aparecen — y solo si pasan tu nota mínima de Metacritic. Gratis de verdad: ni F2P ni demos.",
  keywords: [
    "juegos gratis",
    "juegos gratis pc",
    "descargar juegos gratis pc",
    "juegos gratis steam",
    "epic games regala juegos",
    "epic games gratis",
    "juegos gratis epic games store",
    "gog gratis",
    "steam ofertas",
    "ofertas epic games store",
    "juegos rebajados pc",
    "chollos steam",
    "juegos baratos pc",
    "alertas juegos gratis",
    "free games pc",
    "Metacritic",
    "PC gaming España",
  ],
  authors: [{ name: "GameAlert" }],
  creator: "GameAlert",
  publisher: "GameAlert",
  category: "games",
  metadataBase: new URL(appUrl),
  openGraph: {
    title: "GameAlert — Juegos Gratis y Chollos en Steam, Epic y GOG",
    description:
      "Te avisamos en Discord en cuanto un juego se vuelve gratis o cae de precio. Solo si pasa tu nota mínima.",
    type: "website",
    siteName: "GameAlert",
    locale: "es_ES",
    url: appUrl,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "GameAlert — Juegos gratis y chollos en Steam, Epic y GOG",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GameAlert — Juegos Gratis y Chollos",
    description:
      "Alertas de juegos gratis y rebajados en Steam, Epic y GOG, con filtro de Metacritic.",
    images: ["/opengraph-image"],
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
  alternates: {
    canonical: appUrl,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "GameAlert",
    description:
      "Alertas de juegos gratis y rebajados para Steam, Epic Games y GOG, con filtro de calidad por Metacritic y avisos por Discord y email.",
    url: appUrl,
    applicationCategory: "Application",
    operatingSystem: "Web",
    inLanguage: "es",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
    featureList: [
      "Alertas de juegos gratis en tiempo real",
      "Chollos: rebajas que bajan hasta tu precio",
      "Filtro de calidad por Metacritic",
      "Notificaciones por Discord y email",
      "Plataformas: Steam, Epic Games, GOG",
    ],
  };

  return (
    <html
      lang="es"
      className="dark"
      style={{
        // @ts-expect-error CSS variables from next/font
        "--font-body": inter.style.fontFamily,
        "--font-display": spaceGrotesk.style.fontFamily,
        "--font-mono": jetbrainsMono.style.fontFamily,
      }}
    >
      <body
        className={`${inter.className} ${spaceGrotesk.className} ${jetbrainsMono.className} bg-[var(--bg)] text-[var(--text)] min-h-screen antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}

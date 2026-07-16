import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const SITE_URL = "https://attribmaster.com";
const DESCRIPTION =
  "Devenez maître de votre attribution marketing avec des données réelles, fiables et sans approximation.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "AttribMaster",
  description: DESCRIPTION,
  openGraph: {
    title: "AttribMaster",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "AttribMaster",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AttribMaster",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

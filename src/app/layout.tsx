import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import AuthGuard from "@/components/AuthGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stride",
  description: "Daily notes, tasks, and timeblocking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `(function(){try{var darkIds=['neutral-dark','cool-dark','warm-dark','midnight-blue','ocean','forest','aurora','sunset'];var s=localStorage.getItem('stride-theme');if(s==='dark')s='warm-dark';if(s==='light')s='neutral-light';if(!s||s==='system')s='neutral-dark';if(darkIds.indexOf(s)!==-1)document.documentElement.classList.add('dark');}catch(e){}})();` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClientLayout>
          <AuthGuard>
            {children}
          </AuthGuard>
        </ClientLayout>
      </body>
    </html>
  );
}
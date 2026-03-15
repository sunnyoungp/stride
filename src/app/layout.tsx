import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Sidebar } from "@/components/Sidebar";
import { QuickAdd } from "@/components/QuickAdd";

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
    <html lang="en">
      <head>
        {/* Init dark mode before first paint to prevent flicker */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('stride-theme');var p=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s===null&&p))document.documentElement.classList.add('dark');}catch(e){}})();` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
          <aside className="h-screen w-[220px] flex-none overflow-hidden">
            <Sidebar />
          </aside>
          <main className="h-screen flex-1 overflow-hidden bg-[var(--bg)]">
            {children}
          </main>
        </div>
        <QuickAdd />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "모임 수첩 - 모임 일정 관리 및 항공권 특가 정보",
  description: "친구들과의 모임 일정 관리와 항공권 특가·프로모션 정보를 한곳에서 확인하고 공유하는 모임 수첩 서비스입니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  localStorage.removeItem('app_theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (prefersDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden w-full">
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Script
          id="prevent-zoom"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('touchstart', function(event) {
                if (event.touches.length > 1) {
                  event.preventDefault();
                }
              }, { passive: false });

              var lastTouchEnd = 0;
              document.addEventListener('touchend', function(event) {
                var now = Date.now();
                if (now - lastTouchEnd <= 300) {
                  event.preventDefault();
                }
                lastTouchEnd = now;
              }, false);

              document.addEventListener('gesturestart', function(event) {
                event.preventDefault();
              });
            `,
          }}
        />
      </body>
    </html>
  );
}

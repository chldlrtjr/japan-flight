import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "일본특가모아 (JapanFlight) - 일본 항공권 특가·프로모션 한눈에 모아보기",
  description: "도쿄, 오사카, 후쿠오카, 삿포로, 마쓰야마, 가고시마 등 일본 전 노선 항공권 공식 특가 및 보도자료를 한곳에서 비교하고 확인하세요.",
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
    <html lang="ko" className="h-full antialiased bg-slate-50">
      <body className="min-h-full flex flex-col bg-slate-50 overflow-x-hidden w-full">
        {children}
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

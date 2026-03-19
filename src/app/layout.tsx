import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Work_Sans } from "next/font/google";

const WorkSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nový Knín Trek",
  description: "Sledování trasy pro 50km trek",
  manifest: "/manifest.json",
};

// Nový způsob definice viewportu a barev
export const viewport: Viewport = {
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body className={`${WorkSans.variable} antialiased`}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/sw.js');
        });
      }
    `,
          }}
        />
      </body>
    </html>
  );
}

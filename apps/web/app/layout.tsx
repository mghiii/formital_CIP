import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital CIP",
  description: "Authentification et roles pour la plateforme Digital CIP"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const storedTheme = localStorage.getItem("digital-cip-theme");
                const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                if (storedTheme === "dark" || (!storedTheme && prefersDark)) {
                  document.documentElement.classList.add("dark");
                }
              } catch {}
            `
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

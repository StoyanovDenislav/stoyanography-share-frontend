import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import GlobalHeader from "./components/GlobalHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stoyanography Share",
  description:
    "Secure photo sharing platform with encrypted storage and email privacy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200`}
      >
        <ThemeProvider>
          <AuthProvider>
            <GlobalHeader />
            <div className="flex-1">
              {/* main content */}
              <div className="app-container py-6">{children}</div>
            </div>
            <footer className="bg-gray-900 dark:bg-gray-950 text-gray-400 py-6 mt-auto">
              <div className="app-container text-center">
                <p className="text-sm">
                  Made with ❤️ by Denislav Stoyanov, owner of Stoyanography
                </p>
              </div>
            </footer>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

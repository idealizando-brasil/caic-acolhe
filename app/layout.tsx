import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "CAIC Acolhe", description: "Acolhimento escolar integrado e seguro" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="pt-BR"><body>{children}</body></html>; }

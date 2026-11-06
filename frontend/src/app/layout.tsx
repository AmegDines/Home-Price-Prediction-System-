import type { Metadata } from "next";
import "./globals.css";
import "./figma-design.css";

export const metadata: Metadata = {
  title: "Niva | Bengaluru home intelligence",
  description:
    "Estimate Bengaluru home values, explore local listings, and get AI pricing guidance for your home.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

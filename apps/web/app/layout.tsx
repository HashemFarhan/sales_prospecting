import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Tempus Sales Copilot",
  description: "Rank providers, retrieve evidence, and generate meeting scripts."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

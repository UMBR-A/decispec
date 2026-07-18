import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from "../lib/config/brand";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: `${BRAND.productName} — ${BRAND.tagline}`,
  description: BRAND.shortDescription,
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: `${BRAND.productName} — ${BRAND.tagline}`,
    description: BRAND.shortDescription,
    type: "website",
    images: [{ url: "/og.png", width: 1667, height: 909, alt: BRAND.socialPreviewAlt }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.productName} — ${BRAND.tagline}`,
    description: BRAND.shortDescription,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

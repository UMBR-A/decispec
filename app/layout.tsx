import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from "../lib/config/brand";
import { resolveMetadataBase } from "../lib/config/site-url";

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  alternates: { canonical: "/" },
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
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to main content</a>{children}</body></html>;
}

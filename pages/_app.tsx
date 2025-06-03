import type { AppProps } from "next/app";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";

import "@/public/styles/font.css";
import "@/public/styles/global.css";

import { Analytics } from "@vercel/analytics/react";
import { Montserrat, Overpass_Mono, Source_Serif_4 } from "next/font/google";
import localFont from "next/font/local";

const gothamsm = localFont({
  variable: "--font-gothamsm",
  src: "./GothamSSm-Book.woff",
});

const catamaran = localFont({
  variable: "--font-catamaran",
  src: "./Catamaran.ttf",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const overpass = Overpass_Mono({
  subsets: ["latin"],
  variable: "--font-overpass",
});

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-sourceSerif4",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider>
      <div
        className={`${gothamsm.variable} ${catamaran.variable} ${montserrat.variable} ${overpass.variable} ${sourceSerif4.variable} w-full h-full`}
      >
        <Component {...pageProps} />

        <Toaster />
      </div>
      <Analytics />
    </ClerkProvider>
  );
}

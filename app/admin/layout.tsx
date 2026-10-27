import type { Metadata } from "next"
import "../globals.css"
import { Roboto } from "next/font/google"

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-roboto",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Admin | HansariaConnect",
    template: "%s | HansariaConnect Admin",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${roboto.variable} font-sans`}>
      {children}
    </div>
  )
}

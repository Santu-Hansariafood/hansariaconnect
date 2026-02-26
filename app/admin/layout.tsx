import type { Metadata } from "next"

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
  return children
}


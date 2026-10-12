import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
export const metadata: Metadata = {
  title: "gocrm",
  applicationName: "gocrm",
  appleWebApp: { title: "gocrm" },
  description:
    "gocrm: clientes, contactos y oportunidades, con conversaciones privadas.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}

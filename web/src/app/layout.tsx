import type { Metadata } from "next";
import { Navigation } from "@/components/navigation";
import { Themes } from "@/components/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ryo Explorer — Inside the chain",
    template: "%s | Ryo Explorer",
  },
  description:
    "Public Ryo blockchain data, native chain status and developer API. Privacy-conscious by design.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Themes>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <Navigation />
          <main id="main-content" tabIndex={-1} className="main-content">
            {children}
          </main>
        </Themes>
      </body>
    </html>
  );
}

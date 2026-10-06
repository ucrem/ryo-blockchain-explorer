import type { Metadata } from "next";
import { SearchBox } from "@/components/search-box";
import { Navigation } from "@/components/navigation";
import { Themes } from "@/components/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ryo Blockchain Explorer",
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
            <SearchBox />
            {children}
          </main>
        </Themes>
      </body>
    </html>
  );
}

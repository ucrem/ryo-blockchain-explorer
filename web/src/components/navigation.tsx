import Image from "next/image";
import { Menu } from "lucide-react";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme";

export function Navigation() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a href="/" className="brand" aria-label="Ryo Explorer home">
          <Image
            src="/brand/ryo-wordmark.svg"
            width={140}
            height={47}
            alt="Ryo Currency"
            priority
          />
          <span className="brand-subtitle">
            BLOCKCHAIN
            <br />
            EXPLORER
          </span>
        </a>
        <div id="header-search-slot" className="header-search-slot" />
        <nav className="desktop-navigation" aria-label="Main navigation">
          <NavLinks />
        </nav>
        <div className="header-tools">
          <ThemeToggle />
          <details className="mobile-menu">
            <summary aria-label="Open navigation">
              <Menu aria-hidden="true" />
            </summary>
            <nav aria-label="Mobile navigation">
              <NavLinks />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

import { Menu, Shield } from "lucide-react";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme";
export function Navigation() {
  return (
    <>
      <aside className="sidebar">
        <a href="/" className="brand" aria-label="Ryo Explorer home">
          <span className="brand-mark">r</span>
          <span>
            ryo<span className="brand-subtitle">EXPLORER</span>
          </span>
        </a>
        <div className="sidebar-label">EXPLORE</div>
        <nav aria-label="Main navigation">
          <NavLinks />
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <Shield size={20} aria-hidden="true" />
            <p>
              See the chain.
              <br />
              <strong>Respect the privacy.</strong>
            </p>
          </div>
          <div className="sidebar-version">
            <span>
              EXPLORER <b>v0.4.0</b>
            </span>
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <header className="mobile-header">
        <a href="/" className="brand" aria-label="Ryo Explorer home">
          <span className="brand-mark">r</span>
          <span>
            ryo<span className="brand-subtitle">EXPLORER</span>
          </span>
        </a>
        <div className="mobile-tools">
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
      </header>
    </>
  );
}

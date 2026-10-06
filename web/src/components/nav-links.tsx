"use client";
import {
  ArrowUpRight,
  Blocks,
  Code2,
  LayoutDashboard,
  ListOrdered,
  ScanSearch,
} from "lucide-react";
import { usePathname } from "next/navigation";
export function NavLinks() {
  const current = usePathname();
  return (
    <>
      {[
        { href: "/", label: "Overview", icon: LayoutDashboard },
        { href: "/mempool", label: "Mempool", icon: ListOrdered },
        { href: "/tools", label: "Tools", icon: ScanSearch },
        { href: "/developers", label: "Developer API", icon: Code2 },
        {
          href: "https://github.com/ucrem/ryo-blockchain-explorer",
          label: "Source code",
          icon: Blocks,
        },
      ].map(({ href, label, icon: Icon }) => (
        <a
          key={href}
          href={href}
          className="nav-link"
          aria-current={
            current === href ||
            (href === "/" &&
              /^\/(blocks|transactions|search)(?:\/|$)/.test(current))
              ? "page"
              : undefined
          }
          rel={href.startsWith("https:") ? "noreferrer" : undefined}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
          {href.startsWith("https:") && (
            <ArrowUpRight size={14} className="ml-auto" aria-hidden="true" />
          )}
        </a>
      ))}
    </>
  );
}

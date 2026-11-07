import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Only Farts · WoW Forever dashboard",
    template: "%s · Only Farts",
  },
  description:
    "Only Farts tracks four World of Warcraft: Forever characters: rankings, Gear Score, level progression and history.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

function Puff() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden className="brand-mark">
      <circle cx="11" cy="18" r="7" fill="currentColor" opacity="0.55" />
      <circle cx="18" cy="13" r="8" fill="currentColor" opacity="0.8" />
      <circle cx="23" cy="20" r="6" fill="currentColor" />
    </svg>
  );
}

const REPO_URL = "https://github.com/raduiliescu-vibecodes/Only-farts";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand">
              <Puff />
              <span className="brand-name">Only Farts</span>
            </Link>
            <nav aria-label="Primary" className="nav">
              <Link href="/">Dashboard</Link>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                Source<span aria-hidden> ↗</span>
              </a>
            </nav>
          </div>
        </header>
        <main id="main" className="container main">
          {children}
        </main>
        <footer className="site-footer">
          <div className="container">
            <p>
              Character data comes from{" "}
              <a href="https://www.aotc.gg" target="_blank" rel="noopener noreferrer">
                AOTC.gg
              </a>{" "}
              profiles. Only Farts is a fan project and is not affiliated with AOTC.gg or Blizzard
              Entertainment. World of Warcraft is a trademark of Blizzard Entertainment, Inc.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

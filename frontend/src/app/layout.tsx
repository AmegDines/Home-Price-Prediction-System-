import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bengaluru Nest AI | Home Price Prediction & Seller Marketplace",
  description:
    "Instantly predict home prices in Bengaluru using our advanced machine learning model, or list your home with smart, AI-driven market valuations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        {/* Sticky Glassmorphic Navbar */}
        <header className="mainHeader">
          <div className="headerContainer">
            <div className="logoGroup">
              <div className="logoIcon">
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <span className="logoText">
                Bengaluru<span className="logoAccent">Nest AI</span>
              </span>
            </div>

            <nav className="navLinks">
              <a href="#predictor" className="navItem">
                Estimate Value
              </a>
              <a href="#sell-home" className="navItem">
                Sell Your Home
              </a>
              <a href="#listings" className="navItem">
                Browse Properties
              </a>
            </nav>

            <a href="#predictor" className="ctaButton">
              Get Valuation
            </a>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="contentWrapper">{children}</main>

        {/* Footer — model accuracy pulled live from API in page.tsx stats bar */}
        <footer className="mainFooter">
          <div className="footerContainer">
            <div className="footerInfo">
              <div className="logoGroup">
                <span className="logoText">
                  Bengaluru<span className="logoAccent">Nest AI</span>
                </span>
              </div>
              <p className="footerDesc">
                High-fidelity machine learning property valuations and
                double-sided real estate matching in Bengaluru, Karnataka.
                All predictions are served by a FastAPI backend — no
                client-side model coefficients.
              </p>
            </div>

            <div className="footerLinks">
              <div className="linkGroup">
                <h4 className="groupTitle">Marketplace</h4>
                <a href="#predictor" className="fLink">
                  Price Predictor
                </a>
                <a href="#sell-home" className="fLink">
                  List Your Property
                </a>
                <a href="#listings" className="fLink">
                  Recent Listings
                </a>
              </div>
              <div className="linkGroup">
                <h4 className="groupTitle">Hotspots</h4>
                <a href="#listings?loc=Whitefield" className="fLink">
                  Whitefield
                </a>
                <a href="#listings?loc=Indira%20Nagar" className="fLink">
                  Indira Nagar
                </a>
                <a href="#listings?loc=HSR%20Layout" className="fLink">
                  HSR Layout
                </a>
              </div>
              <div className="linkGroup">
                <h4 className="groupTitle">API</h4>
                <a
                  href={
                    (process.env.NEXT_PUBLIC_API_BASE_URL ??
                      "http://localhost:8000") + "/docs"
                  }
                  className="fLink"
                  target="_blank"
                  rel="noreferrer"
                >
                  API Docs (Swagger)
                </a>
                <a
                  href={
                    (process.env.NEXT_PUBLIC_API_BASE_URL ??
                      "http://localhost:8000") + "/api/health"
                  }
                  className="fLink"
                  target="_blank"
                  rel="noreferrer"
                >
                  Model Health
                </a>
              </div>
            </div>
          </div>

          <div className="footerBottom">
            <p>
              &copy; {new Date().getFullYear()} Bengaluru Nest AI. Predictions
              powered by a server-side ML model — accuracy shown live in the
              stats bar above.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

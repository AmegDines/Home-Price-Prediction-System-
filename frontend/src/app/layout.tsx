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
  description: "Instantly predict home prices in Bengaluru using our advanced machine learning model, or list your home with smart, AI-driven market valuations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {/* Sticky Glassmorphic Navbar */}
        <header className="mainHeader">
          <div className="headerContainer">
            <div className="logoGroup">
              <div className="logoIcon">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <span className="logoText">Bengaluru<span className="logoAccent">Nest AI</span></span>
            </div>

            <nav className="navLinks">
              <a href="#predictor" className="navItem">Estimate Value</a>
              <a href="#sell-home" className="navItem">Sell Your Home</a>
              <a href="#listings" className="navItem">Browse Properties</a>
            </nav>
            
            <a href="#predictor" className="ctaButton">Get Valuation</a>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="contentWrapper">{children}</main>

        {/* Elegant light-theme footer */}
        <footer className="mainFooter">
          <div className="footerContainer">
            <div className="footerInfo">
              <div className="logoGroup">
                <span className="logoText">Bengaluru<span className="logoAccent">Nest AI</span></span>
              </div>
              <p className="footerDesc">
                Providing high-fidelity, machine learning-driven property valuations and double-sided real estate matching in Bengaluru, Karnataka.
              </p>
            </div>
            
            <div className="footerLinks">
              <div className="linkGroup">
                <h4 className="groupTitle">Marketplace</h4>
                <a href="#predictor" className="fLink">Price Predictor</a>
                <a href="#list-home" className="fLink">List Your Property</a>
                <a href="#listings" className="fLink">Recent Listings</a>
              </div>
              <div className="linkGroup">
                <h4 className="groupTitle">Hotspots</h4>
                <a href="#listings?loc=Whitefield" className="fLink">Whitefield</a>
                <a href="#listings?loc=Indira%20Nagar" className="fLink">Indira Nagar</a>
                <a href="#listings?loc=HSR%20Layout" className="fLink">HSR Layout</a>
              </div>
            </div>
          </div>
          <div className="footerBottom">
            <p>&copy; {new Date().getFullYear()} Bengaluru Nest AI. Engineered for premium real estate insights.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}

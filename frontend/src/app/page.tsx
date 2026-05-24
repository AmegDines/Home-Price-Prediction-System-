"use client";

import React, { useState, useEffect, useCallback } from "react";
import { locations } from "@/data/locations";
import CustomDropdown from "@/components/CustomDropdown";
import ListingCard from "@/components/ListingCard";
import { predictHomePriceClient, PredictionResult } from "@/utils/predictor";
import { getStoredListings, addStoredListing, HomeListing, analyzeAskingPrice } from "@/utils/listings";
import styles from "./page.module.css";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"predictor" | "seller">("predictor");

  // ── Buyer Predictor state ──────────────────────────────────────────────────
  const [predictorLoc, setPredictorLoc] = useState("");
  const [predictorSqft, setPredictorSqft] = useState(1200);
  const [predictorBhk, setPredictorBhk] = useState(2);
  const [predictorBath, setPredictorBath] = useState(2);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);

  // ── Seller Hub state ───────────────────────────────────────────────────────
  const [sellerTitle, setSellerTitle] = useState("");
  const [sellerLoc, setSellerLoc] = useState("");
  const [sellerSqft, setSellerSqft] = useState(1200);
  const [sellerBhk, setSellerBhk] = useState(2);
  const [sellerBath, setSellerBath] = useState(2);
  const [sellerBalcony, setSellerBalcony] = useState(1);
  const [sellerPrice, setSellerPrice] = useState(80);
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [listingSuccess, setListingSuccess] = useState(false);
  const [sellerValuation, setSellerValuation] = useState<PredictionResult | null>(null);

  // ── Listings state ─────────────────────────────────────────────────────────
  const [listings, setListings] = useState<HomeListing[]>([]);
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterBhk, setFilterBhk] = useState("all");
  const [filterPrice, setFilterPrice] = useState("all");

  // ── Helper: switch tab & scroll to the interactive section ────────────────
  const switchToTab = useCallback((tab: "predictor" | "seller") => {
    setActiveTab(tab);
    setTimeout(() => {
      const el = document.getElementById("interactive-section");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }, []);

  // ── Respond to hash in URL (navbar links use #sell-home) ──────────────────
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === "#sell-home") {
        switchToTab("seller");
      } else if (window.location.hash === "#predictor") {
        switchToTab("predictor");
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [switchToTab]);

  // ── Load listings on mount ─────────────────────────────────────────────────
  useEffect(() => {
    setListings(getStoredListings());
  }, []);

  // ── Live AI valuation for seller as they type ──────────────────────────────
  useEffect(() => {
    if (sellerLoc && sellerSqft > 0 && sellerBhk > 0 && sellerBath > 0) {
      setSellerValuation(predictHomePriceClient(sellerLoc, sellerSqft, sellerBhk, sellerBath));
    } else {
      setSellerValuation(null);
    }
  }, [sellerLoc, sellerSqft, sellerBhk, sellerBath]);

  // ── Buyer predict ──────────────────────────────────────────────────────────
  const handleEstimatePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!predictorLoc) { alert("Please select a location first."); return; }
    setLoading(true);
    setPrediction(null);
    setTimeout(() => {
      setPrediction(predictHomePriceClient(predictorLoc, predictorSqft, predictorBhk, predictorBath));
      setLoading(false);
    }, 650);
  };

  // ── Seller submit ──────────────────────────────────────────────────────────
  const handleListHome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerLoc) { alert("Please select a location."); return; }
    if (!sellerTitle || !sellerName || !sellerPhone) { alert("Please fill in all details."); return; }

    addStoredListing({ title: sellerTitle, location: sellerLoc, bhk: sellerBhk, bath: sellerBath,
      total_sqft: sellerSqft, balcony: sellerBalcony, asking_price_lakhs: sellerPrice,
      seller_name: sellerName, seller_phone: sellerPhone });

    setListings(getStoredListings());
    setListingSuccess(true);
    setSellerTitle(""); setSellerLoc(""); setSellerSqft(1200); setSellerBhk(2);
    setSellerBath(2); setSellerBalcony(1); setSellerPrice(80); setSellerName(""); setSellerPhone("");
    setTimeout(() => setListingSuccess(false), 5000);
    setTimeout(() => {
      document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" });
    }, 600);
  };

  const fmt = (lakhs: number) =>
    lakhs >= 100 ? `₹ ${(lakhs / 100).toFixed(2)} Cr` : `₹ ${lakhs.toFixed(1)} L`;

  const fmtFull = (lakhs: number) =>
    lakhs >= 100 ? `₹ ${(lakhs / 100).toFixed(2)} Crores` : `₹ ${lakhs.toFixed(1)} Lakhs`;

  const filteredListings = listings.filter((item) => {
    if (filterLocation !== "all" && item.location.toLowerCase() !== filterLocation.toLowerCase()) return false;
    if (filterBhk !== "all") {
      const n = parseInt(filterBhk);
      if (n === 4 && item.bhk >= 4) { /* pass */ }
      else if (item.bhk !== n) return false;
    }
    if (filterPrice !== "all") {
      const p = item.asking_price_lakhs;
      if (filterPrice === "budget" && p > 60) return false;
      if (filterPrice === "mid" && (p < 60 || p > 150)) return false;
      if (filterPrice === "premium" && p < 150) return false;
    }
    return true;
  });

  const listedLocations = Array.from(new Set(listings.map((i) => i.location))).sort();

  return (
    <div className={styles.mainContainer}>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className={styles.heroSection}>
        <div className={styles.badge}>
          <span className={styles.badgeDot}></span>
          AI-Powered Real Estate Platform
        </div>

        <h1 className={styles.heroTitle}>
          Smart Home Price Prediction<br />
          in <span className={styles.heroAccent}>Bengaluru</span>
        </h1>

        <p className={styles.heroSubtitle}>
          Get instant, data-driven property valuations based on 7,400+ real Bengaluru
          transactions — or list your home with live AI market comparison.
        </p>

        {/* Stats Bar */}
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statNum}>7,430+</span>
            <span className={styles.statLabel}>Transactions Analysed</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statItem}>
            <span className={styles.statNum}>240+</span>
            <span className={styles.statLabel}>Bengaluru Localities</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statItem}>
            <span className={styles.statNum}>74.8%</span>
            <span className={styles.statLabel}>Model Accuracy (R²)</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statItem}>
            <span className={styles.statNum}>Instant</span>
            <span className={styles.statLabel}>Zero-Latency Results</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className={styles.tabsContainer}>
          <button
            id="tab-predictor"
            className={`${styles.tabBtn} ${activeTab === "predictor" ? styles.tabActive : ""}`}
            onClick={() => switchToTab("predictor")}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            AI Price Calculator
          </button>
          <button
            id="tab-seller"
            className={`${styles.tabBtn} ${activeTab === "seller" ? styles.tabActive : ""}`}
            onClick={() => switchToTab("seller")}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            Seller Portal
          </button>
        </div>
      </section>

      {/* ── Interactive Area ────────────────────────────────────────────────── */}
      <section className={styles.interactiveArea} id="interactive-section">

        {activeTab === "predictor" ? (
          /* ─ BUYER PREDICTOR ─ */
          <div className={styles.gridSplitter}>
            <form className={styles.featureCard} onSubmit={handleEstimatePrice} id="predictor">
              <div className={styles.cardHeader}>
                <div className={styles.cardIconWrap} style={{ background: "linear-gradient(135deg,#4f46e5,#818cf8)" }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                </div>
                <div>
                  <h2 className={styles.cardTitle}>Estimate Home Price</h2>
                  <p className={styles.cardDesc}>Enter property features for an instant AI-powered valuation.</p>
                </div>
              </div>

              <CustomDropdown selectedLocation={predictorLoc} onChange={setPredictorLoc} locationsList={locations} />

              <div className="sliderWrapper">
                <div className="sliderHeader">
                  <label className="customInputLabel">Total Area</label>
                  <span className="sliderValueText">{predictorSqft.toLocaleString()} sqft</span>
                </div>
                <input type="range" className="sliderControl" min="300" max="6000" step="50"
                  value={predictorSqft} onChange={(e) => setPredictorSqft(parseInt(e.target.value))} />
                <div className={styles.sliderMarks}>
                  <span>300</span><span>1,500</span><span>3,000</span><span>4,500</span><span>6,000</span>
                </div>
              </div>

              <div className={styles.twoColGrid}>
                <div className="customInputGroup">
                  <label className="customInputLabel">BHK Size</label>
                  <div className={styles.chipGroup}>
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button key={v} type="button"
                        className={`${styles.chip} ${predictorBhk === v ? styles.chipActive : ""}`}
                        onClick={() => setPredictorBhk(v)}>{v === 5 ? "5+" : v}</button>
                    ))}
                  </div>
                </div>

                <div className="customInputGroup">
                  <label className="customInputLabel">Bathrooms</label>
                  <div className={styles.chipGroup}>
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button key={v} type="button"
                        className={`${styles.chip} ${predictorBath === v ? styles.chipActive : ""}`}
                        onClick={() => setPredictorBath(v)}>{v === 5 ? "5+" : v}</button>
                    ))}
                  </div>
                </div>
              </div>

              <button type="submit" className={styles.actionBtn}>
                {loading
                  ? <><span className={styles.spinner}></span> Analysing…</>
                  : <><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Predict Home Price</>
                }
              </button>
            </form>

            {/* Result Panel */}
            <div className={styles.resultPane}>
              {loading ? (
                <div className={styles.emptyState}>
                  <div className={styles.pulseRing}></div>
                  <div className={styles.emptyTitle} style={{ marginTop: "1.5rem" }}>Running AI Model…</div>
                  <p className={styles.emptyText}>Analysing location premiums, market trends and property metrics.</p>
                </div>
              ) : prediction ? (
                <div className={styles.resultContent}>
                  <div className={styles.resultLabel}>Estimated Market Value</div>
                  <div className={styles.resultBigVal}>{fmtFull(prediction.predictedPriceLakhs)}</div>
                  <div className={styles.perSqftPill}>₹ {prediction.pricePerSqft.toLocaleString("en-IN")} / sqft avg.</div>

                  <div className={styles.rangeBar}>
                    <div className={styles.rangeEnd}>
                      <span className={styles.rangeEndLabel}>Min</span>
                      <span className={styles.rangeEndVal}>{fmt(prediction.priceRangeMin)}</span>
                    </div>
                    <div className={styles.rangeLine}>
                      <div className={styles.rangeDot}></div>
                    </div>
                    <div className={styles.rangeEnd} style={{ textAlign: "right" }}>
                      <span className={styles.rangeEndLabel}>Max</span>
                      <span className={styles.rangeEndVal}>{fmt(prediction.priceRangeMax)}</span>
                    </div>
                  </div>

                  <div className={styles.metricsReport}>
                    <div className={styles.metricRow}>
                      <span className={styles.metricLabel}>Location</span>
                      <span className={styles.metricVal}>{predictorLoc}</span>
                    </div>
                    <div className={styles.metricRow}>
                      <span className={styles.metricLabel}>Configuration</span>
                      <span className={styles.metricVal}>{predictorBhk} BHK · {predictorBath} Bath · {predictorSqft.toLocaleString()} sqft</span>
                    </div>
                    <div className={styles.metricRow}>
                      <span className={styles.metricLabel}>Data Source</span>
                      <span className={styles.metricVal}>7,430 verified Bengaluru transactions</span>
                    </div>
                  </div>

                  <button className={styles.recalcBtn} onClick={() => setPrediction(null)}>
                    ← Recalculate
                  </button>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIllustration}>
                    <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
                      <circle cx="40" cy="40" r="38" stroke="#e2e8f0" strokeWidth="2"/>
                      <rect x="22" y="38" width="8" height="20" rx="2" fill="#cbd5e1"/>
                      <rect x="34" y="28" width="8" height="30" rx="2" fill="#94a3b8"/>
                      <rect x="46" y="20" width="8" height="38" rx="2" fill="#4f46e5"/>
                      <line x1="18" y1="60" x2="62" y2="60" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className={styles.emptyTitle}>Price Dashboard</div>
                  <p className={styles.emptyText}>Choose your location, area, and configuration, then hit <strong>Predict</strong> to see an AI-driven valuation.</p>
                </div>
              )}
            </div>
          </div>

        ) : (
          /* ─ SELLER PORTAL ─ */
          <div className={styles.gridSplitter} id="sell-home">
            <form className={styles.featureCard} onSubmit={handleListHome}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIconWrap} style={{ background: "linear-gradient(135deg,#10b981,#34d399)" }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                </div>
                <div>
                  <h2 className={styles.cardTitle}>List Your Home for Sale</h2>
                  <p className={styles.cardDesc}>Reach Bengaluru buyers. Get real-time AI pricing guidance as you list.</p>
                </div>
              </div>

              {listingSuccess && (
                <div className={styles.successBanner}>
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  Property listed successfully! It now appears on the Listings Board below.
                </div>
              )}

              <div className={styles.formGrid}>
                <div className={`customInputGroup ${styles.colSpan2}`}>
                  <label className="customInputLabel">Listing Title</label>
                  <input type="text" className="customTextInput"
                    placeholder="e.g. Spacious 3 BHK in Gated Society with Club House"
                    value={sellerTitle} onChange={(e) => setSellerTitle(e.target.value)} required />
                </div>

                <div className={styles.colSpan2}>
                  <CustomDropdown selectedLocation={sellerLoc} onChange={setSellerLoc} locationsList={locations} />
                </div>

                <div className={styles.colSpan2}>
                  <div className="sliderWrapper">
                    <div className="sliderHeader">
                      <label className="customInputLabel">Total Area</label>
                      <span className="sliderValueText">{sellerSqft.toLocaleString()} sqft</span>
                    </div>
                    <input type="range" className="sliderControl" min="300" max="6000" step="50"
                      value={sellerSqft} onChange={(e) => setSellerSqft(parseInt(e.target.value))} />
                  </div>
                </div>

                <div className="customInputGroup">
                  <label className="customInputLabel">BHK Size</label>
                  <div className={styles.chipGroup}>
                    {[1, 2, 3, 4].map((v) => (
                      <button key={v} type="button"
                        className={`${styles.chip} ${sellerBhk === v ? styles.chipActive : ""}`}
                        onClick={() => setSellerBhk(v)}>{v} BHK</button>
                    ))}
                  </div>
                </div>

                <div className="customInputGroup">
                  <label className="customInputLabel">Bathrooms</label>
                  <div className={styles.chipGroup}>
                    {[1, 2, 3, 4].map((v) => (
                      <button key={v} type="button"
                        className={`${styles.chip} ${sellerBath === v ? styles.chipActive : ""}`}
                        onClick={() => setSellerBath(v)}>{v}</button>
                    ))}
                  </div>
                </div>

                <div className="customInputGroup">
                  <label className="customInputLabel">Balconies</label>
                  <div className={styles.chipGroup}>
                    {[0, 1, 2, 3].map((v) => (
                      <button key={v} type="button"
                        className={`${styles.chip} ${sellerBalcony === v ? styles.chipActive : ""}`}
                        onClick={() => setSellerBalcony(v)}>{v}</button>
                    ))}
                  </div>
                </div>

                <div className="customInputGroup">
                  <div className="sliderHeader">
                    <label className="customInputLabel">Asking Price</label>
                    <span className="sliderValueText" style={{ color: "var(--accent-color)", backgroundColor: "var(--accent-light-bg)" }}>
                      {fmtFull(sellerPrice)}
                    </span>
                  </div>
                  <input type="range" className="sliderControl" min="15" max="600" step="5"
                    value={sellerPrice} onChange={(e) => setSellerPrice(parseInt(e.target.value))} />
                </div>

                <div className={styles.colSpan2}>
                  <div className={styles.sectionDivider}>
                    <span>Seller Contact</span>
                  </div>
                </div>

                <div className="customInputGroup">
                  <label className="customInputLabel">Your Name</label>
                  <input type="text" className="customTextInput" placeholder="e.g. Ramesh Kumar"
                    value={sellerName} onChange={(e) => setSellerName(e.target.value)} required />
                </div>

                <div className="customInputGroup">
                  <label className="customInputLabel">Phone Number</label>
                  <input type="tel" className="customTextInput" placeholder="+91 98450 00000"
                    value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} required />
                </div>
              </div>

              <button type="submit" className={`${styles.actionBtn} ${styles.actionBtnGreen}`}>
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                List Property Now
              </button>
            </form>

            {/* Seller Valuation Panel */}
            <div className={styles.resultPane}>
              {sellerValuation ? (
                <div className={styles.resultContent}>
                  <div className={styles.resultLabel}>Live AI Valuation</div>
                  <div className={styles.resultBigVal} style={{ color: "var(--accent-color)" }}>
                    {fmtFull(sellerValuation.predictedPriceLakhs)}
                  </div>
                  <div className={styles.perSqftPill} style={{ background: "var(--accent-light-bg)", color: "var(--accent-dark)" }}>
                    ₹ {sellerValuation.pricePerSqft.toLocaleString("en-IN")} / sqft market rate
                  </div>

                  {/* Deal analysis badge */}
                  {(() => {
                    const a = analyzeAskingPrice(sellerPrice, sellerValuation.predictedPriceLakhs);
                    const colors: Record<string, { bg: string; text: string }> = {
                      "deal-below": { bg: "#d1fae5", text: "#065f46" },
                      "deal-fair": { bg: "#eef2ff", text: "#3730a3" },
                      "deal-premium": { bg: "#fef3c7", text: "#92400e" },
                    };
                    const c = colors[a.badgeClass] || colors["deal-fair"];
                    return (
                      <div className={styles.dealAnalysisCard} style={{ background: c.bg, color: c.text }}>
                        <strong>{a.badgeText}</strong>
                        <p style={{ marginTop: "0.25rem", fontSize: "0.82rem", opacity: 0.85 }}>
                          {a.badgeClass === "deal-below" && "Your asking price is below market — buyers will love this!"}
                          {a.badgeClass === "deal-fair" && "Your price aligns with AI market value. Well positioned!"}
                          {a.badgeClass === "deal-premium" && "Priced above market average. Consider adjusting to sell faster."}
                        </p>
                      </div>
                    );
                  })()}

                  <div className={styles.metricsReport}>
                    <div className={styles.metricRow}>
                      <span className={styles.metricLabel}>Your Asking Price</span>
                      <span className={styles.metricVal}>{fmtFull(sellerPrice)}</span>
                    </div>
                    <div className={styles.metricRow}>
                      <span className={styles.metricLabel}>Your Rate / sqft</span>
                      <span className={styles.metricVal}>₹ {Math.round((sellerPrice * 100000) / sellerSqft).toLocaleString("en-IN")}</span>
                    </div>
                    <div className={styles.metricRow}>
                      <span className={styles.metricLabel}>Market Rate / sqft</span>
                      <span className={styles.metricVal}>₹ {sellerValuation.pricePerSqft.toLocaleString("en-IN")}</span>
                    </div>
                    <div className={styles.metricRow}>
                      <span className={styles.metricLabel}>Location</span>
                      <span className={styles.metricVal}>{sellerLoc}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIllustration}>
                    <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
                      <circle cx="40" cy="40" r="38" stroke="#e2e8f0" strokeWidth="2"/>
                      <path d="M20 52L32 36l10 8 10-14 8 6" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="40" cy="38" r="4" fill="#10b981"/>
                    </svg>
                  </div>
                  <div className={styles.emptyTitle}>Live AI Valuation</div>
                  <p className={styles.emptyText}>Select your location and property details to see a real-time AI market valuation update here as you type.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Listings Board ──────────────────────────────────────────────────── */}
      <section className={styles.listingsSection} id="listings">
        <div className={styles.listingsTitleBlock}>
          <div>
            <h2 className={styles.listingsSectionTitle}>
              Featured Bengaluru <span>Listings</span>
            </h2>
            <p className={styles.listingsSubtitle}>Browse actively listed properties from verified sellers across Bengaluru.</p>
          </div>
          <span className={styles.listingsCount}>{filteredListings.length} of {listings.length} shown</span>
        </div>

        <div className={styles.filterControls}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Location</label>
            <select className={styles.filterSelect} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
              <option value="all">All Locations</option>
              {listedLocations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>BHK Size</label>
            <select className={styles.filterSelect} value={filterBhk} onChange={(e) => setFilterBhk(e.target.value)}>
              <option value="all">Any BHK</option>
              <option value="1">1 BHK</option>
              <option value="2">2 BHK</option>
              <option value="3">3 BHK</option>
              <option value="4">4+ BHK</option>
            </select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Budget</label>
            <select className={styles.filterSelect} value={filterPrice} onChange={(e) => setFilterPrice(e.target.value)}>
              <option value="all">Any Budget</option>
              <option value="budget">Under ₹ 60 Lakhs</option>
              <option value="mid">₹ 60 L – ₹ 1.5 Cr</option>
              <option value="premium">Over ₹ 1.5 Crores</option>
            </select>
          </div>
          <button className={styles.addListingBtn} onClick={() => switchToTab("seller")}>
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Listing
          </button>
        </div>

        <div className={styles.listingsGrid}>
          {filteredListings.length > 0 ? (
            filteredListings.map((item) => <ListingCard key={item.id} listing={item} />)
          ) : (
            <div className={styles.noMatches}>
              <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--slate-300)" }}>
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
              <div className={styles.noMatchesTitle}>No listings match your filters</div>
              <p className={styles.noMatchesText}>Try adjusting your filters or browse all available listings.</p>
              <button className={styles.resetFilterBtn} onClick={() => { setFilterLocation("all"); setFilterBhk("all"); setFilterPrice("all"); }}>
                Reset All Filters
              </button>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { locations } from "@/data/locations";
import CustomDropdown from "@/components/CustomDropdown";
import ListingCard from "@/components/ListingCard";
import { predictHomePriceClient, PredictionResult } from "@/utils/predictor";
import { getStoredListings, addStoredListing, HomeListing, analyzeAskingPrice } from "@/utils/listings";
import styles from "./page.module.css";

export default function Home() {
  // Tab State: 'predictor' (Buyer) | 'seller' (Seller)
  const [activeTab, setActiveTab] = useState<"predictor" | "seller">("predictor");

  // ==========================================
  // 1. AI Price Predictor (Buyer Form) State
  // ==========================================
  const [predictorLoc, setPredictorLoc] = useState("");
  const [predictorSqft, setPredictorSqft] = useState(1200);
  const [predictorBhk, setPredictorBhk] = useState(2);
  const [predictorBath, setPredictorBath] = useState(2);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);

  // ==========================================
  // 2. Seller Hub Form State
  // ==========================================
  const [sellerTitle, setSellerTitle] = useState("");
  const [sellerLoc, setSellerLoc] = useState("");
  const [sellerSqft, setSellerSqft] = useState(1200);
  const [sellerBhk, setSellerBhk] = useState(2);
  const [sellerBath, setSellerBath] = useState(2);
  const [sellerBalcony, setSellerBalcony] = useState(1);
  const [sellerPrice, setSellerPrice] = useState(80); // in Lakhs
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [listingSuccess, setListingSuccess] = useState(false);
  const [sellerValuation, setSellerValuation] = useState<PredictionResult | null>(null);

  // ==========================================
  // 3. Listings & Marketplace State
  // ==========================================
  const [listings, setListings] = useState<HomeListing[]>([]);
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterBhk, setFilterBhk] = useState("all");
  const [filterPrice, setFilterPrice] = useState("all");

  // Load listings on mount
  useEffect(() => {
    setListings(getStoredListings());
  }, []);

  // Live AI Valuation for Seller Hub as they enter details
  useEffect(() => {
    if (sellerLoc && sellerSqft > 0 && sellerBhk > 0 && sellerBath > 0) {
      const result = predictHomePriceClient(sellerLoc, sellerSqft, sellerBhk, sellerBath);
      setSellerValuation(result);
    } else {
      setSellerValuation(null);
    }
  }, [sellerLoc, sellerSqft, sellerBhk, sellerBath]);

  // Handle Predict price for buyer
  const handleEstimatePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!predictorLoc) {
      alert("Please select a location first.");
      return;
    }
    setLoading(true);
    setPrediction(null);

    // Simulate small premium delay for ML calculation
    setTimeout(() => {
      const result = predictHomePriceClient(
        predictorLoc,
        predictorSqft,
        predictorBhk,
        predictorBath
      );
      setPrediction(result);
      setLoading(false);
    }, 600);
  };

  // Handle Seller Submit Listing
  const handleListHome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerLoc) {
      alert("Please select a location.");
      return;
    }
    if (!sellerTitle || !sellerName || !sellerPhone) {
      alert("Please fill in all seller and listing details.");
      return;
    }

    const newListing = addStoredListing({
      title: sellerTitle,
      location: sellerLoc,
      bhk: sellerBhk,
      bath: sellerBath,
      total_sqft: sellerSqft,
      balcony: sellerBalcony,
      asking_price_lakhs: sellerPrice,
      seller_name: sellerName,
      seller_phone: sellerPhone,
    });

    // Refresh listings state
    setListings(getStoredListings());

    // Show success notification & reset form
    setListingSuccess(true);
    setSellerTitle("");
    setSellerLoc("");
    setSellerSqft(1200);
    setSellerBhk(2);
    setSellerBath(2);
    setSellerBalcony(1);
    setSellerPrice(80);
    setSellerName("");
    setSellerPhone("");

    // Clear success banner after 4 seconds
    setTimeout(() => setListingSuccess(false), 4000);
    
    // Smooth scroll down to active listings board
    setTimeout(() => {
      const listingsSec = document.getElementById("listings");
      if (listingsSec) {
        listingsSec.scrollIntoView({ behavior: "smooth" });
      }
    }, 500);
  };

  // Helper to format Lakhs/Crores
  const formatValue = (lakhs: number) => {
    if (lakhs >= 100) {
      return `₹ ${(lakhs / 100).toFixed(2)} Cr`;
    }
    return `₹ ${lakhs.toFixed(1)} Lakhs`;
  };

  // Filter listings based on controls
  const filteredListings = listings.filter((item) => {
    // 1. Filter Location
    if (filterLocation !== "all" && item.location.toLowerCase() !== filterLocation.toLowerCase()) {
      return false;
    }
    // 2. Filter BHK
    if (filterBhk !== "all") {
      const filterBhkNum = parseInt(filterBhk);
      if (filterBhkNum === 4 && item.bhk >= 4) {
        // "4+ BHK" case
      } else if (item.bhk !== filterBhkNum) {
        return false;
      }
    }
    // 3. Filter Price
    if (filterPrice !== "all") {
      const price = item.asking_price_lakhs;
      if (filterPrice === "budget" && price > 60) return false;
      if (filterPrice === "mid" && (price < 60 || price > 150)) return false;
      if (filterPrice === "premium" && price < 150) return false;
    }
    return true;
  });

  // Get unique locations in listed items to populate filter selector
  const listedLocations = Array.from(new Set(listings.map((item) => item.location))).sort();

  return (
    <div className={styles.mainContainer}>
      
      {/* Hero Header Section */}
      <section className={styles.heroSection}>
        <div className={styles.badge}>Next-Gen Real Estate Insights</div>
        <h1 className={styles.heroTitle}>
          Smart Property Valuations in <span>Bengaluru</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Estimate local real estate prices instantly with our pre-trained machine learning model, or list your house with intelligent AI market comparison.
        </p>

        {/* Tab Switcher */}
        <div className={styles.tabsContainer}>
          <button
            className={`${styles.tabBtn} ${activeTab === "predictor" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("predictor")}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
            AI Price Calculator
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "seller" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("seller")}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            Seller Portal
          </button>
        </div>
      </section>

      {/* Main Interactive Grid Area */}
      <section className={styles.interactiveArea} id="predictor">
        {activeTab === "predictor" ? (
          <div className={styles.gridSplitter}>
            
            {/* Buyer Predictor Card */}
            <form className={styles.featureCard} onSubmit={handleEstimatePrice}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Estimate Home Price</h2>
                <p className={styles.cardDesc}>Enter property features to get an instant AI valuation.</p>
              </div>

              {/* Location Custom Dropdown */}
              <CustomDropdown
                selectedLocation={predictorLoc}
                onChange={setPredictorLoc}
                locationsList={locations}
              />

              {/* total sqft slider */}
              <div className="sliderWrapper">
                <div className="sliderHeader">
                  <label className="customInputLabel">Total Area (Sq.Ft)</label>
                  <span className="sliderValueText">{predictorSqft} sqft</span>
                </div>
                <input
                  type="range"
                  className="sliderControl"
                  min="300"
                  max="6000"
                  step="50"
                  value={predictorSqft}
                  onChange={(e) => setPredictorSqft(parseInt(e.target.value))}
                />
              </div>

              {/* BHK Button Selector */}
              <div className="customInputGroup">
                <label className="customInputLabel">Size (BHK)</label>
                <div className="toggleGrid">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={`bhk-${val}`}
                      type="button"
                      className={`toggleBtn ${predictorBhk === val ? "toggleBtnActive" : ""}`}
                      onClick={() => setPredictorBhk(val)}
                    >
                      {val === 5 ? "5+" : `${val} BHK`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bathrooms Button Selector */}
              <div className="customInputGroup">
                <label className="customInputLabel">Bathrooms</label>
                <div className="toggleGrid">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={`bath-${val}`}
                      type="button"
                      className={`toggleBtn ${predictorBath === val ? "toggleBtnActive" : ""}`}
                      onClick={() => setPredictorBath(val)}
                    >
                      {val === 5 ? "5+" : val}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className={styles.actionBtn}>
                {loading ? <span className={styles.spinner}></span> : "Predict Home Price"}
              </button>
            </form>

            {/* Prediction Output Pane */}
            <div className={styles.resultPane}>
              {loading ? (
                <div className={styles.emptyState}>
                  <span className={styles.spinner} style={{ borderColor: "rgba(79, 70, 229, 0.2)", borderTopColor: "var(--primary-color)", width: 45, height: 45 }}></span>
                  <div className={styles.emptyTitle}>Running AI Model...</div>
                  <p className={styles.emptyText}>Processing historical trends, outliers, and geographic metrics for Bengaluru.</p>
                </div>
              ) : prediction ? (
                <div style={{ width: "100%", animation: "fadeIn 0.4s ease-out" }}>
                  <div className={styles.resultTitle}>Estimated Market Value</div>
                  <div className={styles.resultVal}>
                    {formatValue(prediction.predictedPriceLakhs)}
                  </div>
                  <div className={styles.pricePerSqft}>
                    Avg. Rate: ₹ {prediction.pricePerSqft.toLocaleString("en-IN")} / sqft
                  </div>

                  <div className={styles.metricsReport}>
                    <div className={styles.metricRow}>
                      <span className={styles.metricLabel}>AI Valuation Range</span>
                      <span className={styles.metricVal}>
                        {formatValue(prediction.priceRangeMin)} - {formatValue(prediction.priceRangeMax)}
                      </span>
                    </div>
                    <div className={styles.metricRow}>
                      <span className={styles.metricLabel}>Location Profile</span>
                      <span className={styles.metricVal}>{predictorLoc}</span>
                    </div>
                    <div className={styles.metricRow}>
                      <span className={styles.metricLabel}>Property Specs</span>
                      <span className={styles.metricVal}>
                        {predictorBhk} BHK, {predictorBath} Bath, {predictorSqft} Sq.Ft
                      </span>
                    </div>
                  </div>

                  <div className={styles.tagline}>
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    Statistically driven valuation based on 7,400+ cleaned Bengaluru transactions.
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
                  <div className={styles.emptyTitle}>Prediction Dashboard</div>
                  <p className={styles.emptyText}>Select your location and home parameters, and click predict to load pricing analytics.</p>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* Seller Portal tab */
          <div className={styles.gridSplitter} id="list-home">
            
            {/* Seller Form Card */}
            <form className={styles.featureCard} onSubmit={handleListHome}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>List Your Home for Sale</h2>
                <p className={styles.cardDesc}>Offer your home details to attract Bengaluru buyers with certified AI valuations.</p>
              </div>

              {listingSuccess && (
                <div className={styles.successBanner}>
                  <svg className={styles.successIcon} viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Your property listed successfully! It has been added to our Listings Board.
                </div>
              )}

              <div className={styles.formGrid}>
                {/* Title */}
                <div className={`${styles.customInputGroup} ${styles.colSpan2}`}>
                  <label className="customInputLabel">Listing Title</label>
                  <input
                    type="text"
                    className="customTextInput"
                    placeholder="e.g. Modern 3 BHK Flat in Prestigious Society"
                    value={sellerTitle}
                    onChange={(e) => setSellerTitle(e.target.value)}
                    required
                  />
                </div>

                {/* Location Selection */}
                <div className={styles.colSpan2}>
                  <CustomDropdown
                    selectedLocation={sellerLoc}
                    onChange={setSellerLoc}
                    locationsList={locations}
                  />
                </div>

                {/* total sqft slider */}
                <div className={styles.colSpan2}>
                  <div className="sliderWrapper">
                    <div className="sliderHeader">
                      <label className="customInputLabel">Total Area (Sq.Ft)</label>
                      <span className="sliderValueText">{sellerSqft} sqft</span>
                    </div>
                    <input
                      type="range"
                      className="sliderControl"
                      min="300"
                      max="6000"
                      step="50"
                      value={sellerSqft}
                      onChange={(e) => setSellerSqft(parseInt(e.target.value))}
                    />
                  </div>
                </div>

                {/* BHK count */}
                <div className="customInputGroup">
                  <label className="customInputLabel">BHK Size</label>
                  <div className="toggleGrid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                    {[1, 2, 3, 4].map((val) => (
                      <button
                        key={`sel-bhk-${val}`}
                        type="button"
                        className={`toggleBtn ${sellerBhk === val ? "toggleBtnActive" : ""}`}
                        onClick={() => setSellerBhk(val)}
                      >
                        {val} BHK
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bath count */}
                <div className="customInputGroup">
                  <label className="customInputLabel">Bathrooms</label>
                  <div className="toggleGrid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                    {[1, 2, 3, 4].map((val) => (
                      <button
                        key={`sel-bath-${val}`}
                        type="button"
                        className={`toggleBtn ${sellerBath === val ? "toggleBtnActive" : ""}`}
                        onClick={() => setSellerBath(val)}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Balcony count */}
                <div className="customInputGroup">
                  <label className="customInputLabel">Balconies</label>
                  <div className="toggleGrid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                    {[0, 1, 2, 3].map((val) => (
                      <button
                        key={`sel-balcony-${val}`}
                        type="button"
                        className={`toggleBtn ${sellerBalcony === val ? "toggleBtnActive" : ""}`}
                        onClick={() => setSellerBalcony(val)}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Asking Price */}
                <div className="customInputGroup">
                  <div className="sliderHeader">
                    <label className="customInputLabel">Asking Price (Lakhs)</label>
                    <span className="sliderValueText" style={{ color: "var(--accent-color)", backgroundColor: "var(--accent-light-bg)" }}>
                      {formatValue(sellerPrice)}
                    </span>
                  </div>
                  <input
                    type="range"
                    className="sliderControl"
                    min="15"
                    max="600"
                    step="5"
                    value={sellerPrice}
                    onChange={(e) => setSellerPrice(parseInt(e.target.value))}
                  />
                </div>

                <h3 className={styles.colSpan2} style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "0.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
                  Seller Contact Information
                </h3>

                {/* Name */}
                <div className="customInputGroup">
                  <label className="customInputLabel">Your Name</label>
                  <input
                    type="text"
                    className="customTextInput"
                    placeholder="e.g. Ramesh Kumar"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    required
                  />
                </div>

                {/* Phone */}
                <div className="customInputGroup">
                  <label className="customInputLabel">Phone Number</label>
                  <input
                    type="tel"
                    className="customTextInput"
                    placeholder="e.g. +91 98450 98765"
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value)}
                    required
                  />
                </div>

              </div>

              <button type="submit" className={styles.actionBtn} style={{ backgroundColor: "var(--accent-color)", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.15)" }}>
                List Property Now
              </button>
            </form>

            {/* Seller Live Valuation Side Panel */}
            <div className={styles.resultPane}>
              {sellerValuation ? (
                <div style={{ width: "100%", animation: "fadeIn 0.3s ease-out" }}>
                  <div className={styles.valuationPreviewCard}>
                    <div className={styles.previewTitle}>Real-time AI valuation</div>
                    <div className={styles.previewVal}>
                      {formatValue(sellerValuation.predictedPriceLakhs)}
                    </div>
                    
                    {/* Interactive price analysis showing if their asking price is a good deal! */}
                    <div className={styles.previewComparison}>
                      {(() => {
                        const analysis = analyzeAskingPrice(sellerPrice, sellerValuation.predictedPriceLakhs);
                        if (analysis.badgeClass === "deal-below") {
                          return (
                            <span>
                              Your price is{" "}
                              <span className={styles.matchGreen}>
                                {Math.abs(Math.round(analysis.differencePct))}% Below AI Value
                              </span>. This will attract buyers extremely fast!
                            </span>
                          );
                        } else if (analysis.badgeClass === "deal-premium") {
                          return (
                            <span>
                              Your price is{" "}
                              <span className={styles.matchOrange}>
                                {Math.round(analysis.differencePct)}% Above AI Value
                              </span>. Consider lowering it to match market averages.
                            </span>
                          );
                        } else {
                          return (
                            <span>
                              Your price represents{" "}
                              <span className={styles.matchBlue} style={{ color: "var(--primary-color)", fontWeight: 700 }}>
                                Fair Market Value
                              </span>. Perfect!
                            </span>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  <div className={styles.metricsReport} style={{ marginTop: "1.5rem" }}>
                    <div className={styles.metricRow}>
                      <span className={styles.metricLabel}>AI Rate per sqft</span>
                      <span className={styles.metricVal}>₹ {sellerValuation.pricePerSqft.toLocaleString("en-IN")}</span>
                    </div>
                    <div className={styles.metricRow}>
                      <span className={styles.metricLabel}>Your Asking Rate</span>
                      <span className={styles.metricVal}>₹ {Math.round((sellerPrice * 100000) / sellerSqft).toLocaleString("en-IN")}</span>
                    </div>
                    <div className={styles.metricRow}>
                      <span className={styles.metricLabel}>Property Profile</span>
                      <span className={styles.metricVal}>{sellerLoc || "Not selected"}</span>
                    </div>
                  </div>

                  <div className={styles.tagline} style={{ marginTop: "2rem" }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                      <polyline points="2 17 12 22 22 17"></polyline>
                      <polyline points="2 12 12 17 22 12"></polyline>
                    </svg>
                    Buyers see a "Certified Value" badge when listing matches our model statistics.
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <svg className={styles.emptyIcon} viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  <div className={styles.emptyTitle}>Live AI Valuation</div>
                  <p className={styles.emptyText}>Select a location and enter sqft to see an instant AI valuation preview of your home in real-time as you fill in the form.</p>
                </div>
              )}
            </div>

          </div>
        )}
      </section>

      {/* Listings and Marketplace Board Section */}
      <section className={styles.listingsHeader} id="listings">
        
        <div className={styles.listingsTitleBlock}>
          <h2 className={styles.listingsSectionTitle}>
            Featured Bengaluru <span>Listings</span>
          </h2>
          <span className={styles.listingsCount}>
            Showing {filteredListings.length} of {listings.length} properties
          </span>
        </div>

        {/* Dynamic Filters Bar */}
        <div className={styles.filterControls}>
          {/* Location filter */}
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Location</label>
            <select
              className={styles.filterSelect}
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
            >
              <option value="all">All Locations</option>
              {listedLocations.map((loc) => (
                <option key={`filter-loc-${loc}`} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* BHK size filter */}
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>BHK Size</label>
            <select
              className={styles.filterSelect}
              value={filterBhk}
              onChange={(e) => setFilterBhk(e.target.value)}
            >
              <option value="all">Any BHK</option>
              <option value="1">1 BHK</option>
              <option value="2">2 BHK</option>
              <option value="3">3 BHK</option>
              <option value="4">4+ BHK</option>
            </select>
          </div>

          {/* Budget filter */}
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Budget Range</label>
            <select
              className={styles.filterSelect}
              value={filterPrice}
              onChange={(e) => setFilterPrice(e.target.value)}
            >
              <option value="all">Any Budget</option>
              <option value="budget">Under ₹ 60 Lakhs</option>
              <option value="mid">₹ 60 Lakhs - ₹ 1.5 Cr</option>
              <option value="premium">Over ₹ 1.5 Cr</option>
            </select>
          </div>
        </div>

        {/* Listings Cards Grid */}
        <div className={styles.listingsGrid}>
          {filteredListings.length > 0 ? (
            filteredListings.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))
          ) : (
            <div className={styles.noMatches}>
              <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--slate-300)" }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              <div className={styles.noMatchesTitle}>No matching listings found</div>
              <p className={styles.noMatchesText}>
                No listings match your active filters. Try resetting the filters to view all listings.
              </p>
              <button
                className={styles.resetFilterBtn}
                onClick={() => {
                  setFilterLocation("all");
                  setFilterBhk("all");
                  setFilterPrice("all");
                }}
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

      </section>

    </div>
  );
}
